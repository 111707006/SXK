import { describe, it, expect } from 'vitest';
import {
  MAX_GUIDE_ITEMS,
  MAX_GUIDE_TEXT,
  guideFromDraft,
  guideFromStored,
  guideToDraft,
  readGuide,
} from '../src/utils/activityGuide';
import { changedFields } from '../src/utils/activityAdmin';
import { ACTIVITY_CONTENT } from '../src/t2/activityContent';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import type { ActivityGuide } from '../src/t2/types';

/**
 * 影片導引腳本的兩種讀法（Keep 規格 §4.2、K17）。
 *
 * `readGuide` 收後台送上來的：內容團隊改腳本裡的一個字，存回去的是整份腳本，所以每一段都要驗，
 * 讀不出來就說是哪一段。`guideFromStored` 讀資料庫的：只看形狀、不看上限，形狀不對當沒有腳本。
 * 兩者吐出來的都是同一個鍵順序 —— 後台用 JSON 比對「改過沒有」，順序不同就會把沒改過的當成改過。
 */

const GUIDE: ActivityGuide = {
  length: '2–3 分钟',
  intro: '今天这个活动叫「我们来爬行」。',
  principles: ['爬行练跨侧协调。', '手掌撑地练力量。'],
  prep: { 场地: '清出两到三米见方的地面。', 器材: '一块垫子。', 安全检查: '穿长裤。', 大人位置: '趴在孩子正前方。' },
  shots: [{ name: '大人示范姿势', say: '来，我们一起趴下来。' }],
  reactions: [{ if: '孩子趴着不动', then: '把玩具挪近一点。' }],
  mistakes: ['把玩具放太远。'],
  down: '距离缩短。',
  up: '爬过整个房间。',
  progress: ['能爬多远？'],
  outro: '爬行本身就是很重要的训练。',
};

const bad = (raw: unknown) => {
  const r = readGuide(raw);
  expect(r.ok, JSON.stringify(raw)).toBe(false);
  return r.ok ? '' : r.error;
};

describe('readGuide —— 後台送上來的整份腳本', () => {
  it('完整的一份原樣收下', () => {
    expect(readGuide(GUIDE)).toEqual({ ok: true, guide: GUIDE });
  });

  it('前後空白修掉；「準備」照 场地／器材／安全检查／大人位置 排；鍵的順序固定', () => {
    const { length, ...rest } = GUIDE;
    const r = readGuide({ ...rest, prep: { 大人位置: '趴着', 场地: ' 客厅 ' }, outro: ' 收尾。 ', principles: [' 一 '], length });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.guide)).toEqual(Object.keys(GUIDE));
    expect(Object.keys(r.guide.prep)).toEqual(['场地', '大人位置']);
    expect(r.guide.prep.场地).toBe('客厅');
    expect(r.guide.outro).toBe('收尾。');
    expect(r.guide.principles).toEqual(['一']);
  });

  it('不是物件就退回', () => {
    for (const raw of [null, 'x', [], 3]) expect(bad(raw)).toContain('脚本');
  });

  it('少了一段、或那一段的型別不對，說出是哪一段', () => {
    const { outro: _outro, ...noOutro } = GUIDE;
    expect(bad(noOutro)).toContain('收尾旁白');
    expect(bad({ ...GUIDE, principles: '一条' })).toContain('原理');
    expect(bad({ ...GUIDE, mistakes: ['一', 2] })).toContain('常做错');
  });

  it('「準備」只認四項，可以少、不能多', () => {
    const r = readGuide({ ...GUIDE, prep: { 器材: '垫子' } });
    expect(r.ok && r.guide.prep).toEqual({ 器材: '垫子' });
    expect(bad({ ...GUIDE, prep: { 天气: '晴' } })).toContain('天气');
    expect(bad({ ...GUIDE, prep: ['场地'] })).toContain('准备');
  });

  it('清單裡的每一則都要有字；分鏡要有名稱與旁白、反應要有如果與怎麼做', () => {
    expect(bad({ ...GUIDE, progress: ['能爬多远？', '  '] })).toContain('第 2');
    expect(bad({ ...GUIDE, shots: [{ name: '示范', say: '' }] })).toContain('分镜');
    expect(bad({ ...GUIDE, shots: [{ name: '示范' }] })).toContain('分镜');
    expect(bad({ ...GUIDE, reactions: [{ if: '不动' }] })).toContain('反应');
  });

  it('單段文字可以清空（畫面就不顯示那一段）', () => {
    const r = readGuide({ ...GUIDE, intro: '', down: ' ' });
    expect(r.ok && [r.guide.intro, r.guide.down]).toEqual(['', '']);
  });

  it('超過上限整份退回，不默默截斷', () => {
    expect(bad({ ...GUIDE, intro: 'x'.repeat(MAX_GUIDE_TEXT + 1) })).toContain(String(MAX_GUIDE_TEXT));
    expect(bad({ ...GUIDE, principles: Array.from({ length: MAX_GUIDE_ITEMS + 1 }, () => '一') })).toContain(
      String(MAX_GUIDE_ITEMS),
    );
  });
});

describe('guideFromStored —— 資料庫讀回來的', () => {
  it('JSON 字串與已解析的物件都收，形狀不對當沒有腳本', () => {
    expect(guideFromStored(JSON.stringify(GUIDE))).toEqual(GUIDE);
    expect(guideFromStored(GUIDE)).toEqual(GUIDE);
    expect(guideFromStored('{not json')).toBeNull();
    expect(guideFromStored({ ...GUIDE, shots: 'x' })).toBeNull();
    expect(guideFromStored(null)).toBeNull();
  });

  it('不看上限：資料庫裡已經有的，讀得出來就照給', () => {
    const long = { ...GUIDE, intro: 'x'.repeat(MAX_GUIDE_TEXT + 1) };
    expect(guideFromStored(long)?.intro).toHaveLength(MAX_GUIDE_TEXT + 1);
  });
});

/**
 * 後台編輯畫面的草稿（`ActivitiesPanel.tsx`）：原理、常做錯、進步指標在畫面上是「一行一條」，
 * 準備是固定四格。開了一支不改就按儲存，**什麼都不能送** —— 否則每開一次就把客戶的腳本整份重寫一次，
 * 而一段換行、一個鍵的順序不同，都會讓 `changedFields` 以為改過了。
 */
describe('guideToDraft／guideFromDraft —— 後台畫面的草稿', () => {
  it('客戶的 20 支腳本：開了不改、存回去，changedFields 一個欄位都不送', () => {
    const scripted = ACTIVITY_CONTENT.filter(e => e.guide !== null);
    expect(scripted).toHaveLength(20);
    for (const e of scripted) {
      // 伺服器給畫面的那一份是從資料庫讀回來的（`guideFromStored`），不是抽取時的物件。
      const original = { ...ACTIVITY_SEED.find(a => a.id === e.id)!, guide: guideFromStored(JSON.stringify(e.guide)) };
      const reopened = { ...original, guide: guideFromDraft(guideToDraft(original.guide!)) };
      expect(changedFields(original, reopened), e.id).toEqual({});
    }
  });

  it('一行一條：空行丟掉、前後空白修掉；準備清空的那一項拿掉', () => {
    const draft = guideToDraft(GUIDE);
    expect(draft.principles).toBe('爬行练跨侧协调。\n手掌撑地练力量。');
    const g = guideFromDraft({ ...draft, principles: ' 一 \n\n  \n二', prep: { ...draft.prep, 器材: '  ' } });
    expect(g.principles).toEqual(['一', '二']);
    expect(Object.keys(g.prep)).toEqual(['场地', '安全检查', '大人位置']);
  });

  // 整列空白是多按了一次「加一列」；只填一半的在這裡丟掉，打了一半的字就無聲無息地不見了。
  it('整列空白的分鏡／反應丟掉；只填一半的留著，由 readGuide 說是第幾則少了什麼', () => {
    const draft = guideToDraft(GUIDE);
    const g = guideFromDraft({
      ...draft,
      shots: [...draft.shots, { name: ' ', say: '' }, { name: '拿到玩具', say: '' }],
      reactions: [{ if: '', then: '  ' }, ...draft.reactions],
    });
    expect(g.shots).toEqual([...GUIDE.shots, { name: '拿到玩具', say: '' }]);
    expect(g.reactions).toEqual(GUIDE.reactions);
    expect(bad(g)).toContain('「分镜」第 2 则的旁白');
  });
});
