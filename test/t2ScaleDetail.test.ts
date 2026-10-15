import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, scoreKitV3 } from '../src/t2/kitv3/score';
import { hasScaleDetail, scaleDetailOf, type ScaleDetail } from '../src/t2/scaleDetail';
import { findBannedWords } from '../src/utils/parentWording';

/**
 * 量表详解（規格 `t2-v3-scale-detail-report.md`、票 D-3：達成率族）。
 * 範例那個孩子（2026-10-15 給使用者看的截圖）：48 個月，前五面都會；跑跳兩題偶爾、一題還不會；平衡球類後段卡住。
 */

function detailFor(code: string, ageM: number, override: Record<string, number> = {}, fill?: (max: number) => number): ScaleDetail {
  const bank = KITV3_BANKS[code];
  const context = { ageM };
  const answers: Record<string, number> = {};
  for (const { section, item } of askedItems(bank, context)) {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    const values = bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    const max = Math.max(...values);
    answers[item.key] = fill ? fill(max) : max;
  }
  Object.assign(answers, override);
  const score = scoreKitV3(bank, answers, context);
  const d = scaleDetailOf({ bank, answers, score, context });
  if (!d) throw new Error(`${code} 沒有详解`);
  return d;
}

const SAMPLE = { 'G6.6': 1, 'G6.8': 1, 'G6.9': 0, 'G7.4': 1, 'G7.6': 1, 'G7.7': 0, 'G7.8': 0 };

function allText(d: ScaleDetail): string {
  return [d.displayName, d.oneLiner, d.overall, ...d.kinds.map(k => k.label), ...d.facets.map(f => f.plain ?? ''),
    ...d.focus.flatMap(f => [f.plain ?? '', f.what, ...f.tips])].join('\n');
}

describe('達成率族：範例那個孩子（粗大動作）', () => {
  const d = detailFor('SXK-GM', 48, SAMPLE);

  it('總題數與三種作答', () => {
    expect(d.asked).toBe(76);
    expect(d.kinds).toEqual([{ label: '已经会', count: 69 }, { label: '偶尔会', count: 4 }, { label: '还不会', count: 3 }]);
  });

  it('七個面向的白話狀態與題數', () => {
    expect(d.facets.map(f => [f.key, f.plain, f.counts.join('/')])).toEqual([
      ['G1', '已经稳定', '12/0/0'], ['G2', '已经稳定', '12/0/0'], ['G3', '已经稳定', '11/0/0'], ['G4', '已经稳定', '12/0/0'],
      ['G5', '已经稳定', '12/0/0'], ['G6', '大部分会了，还有几项不稳', '6/2/1'], ['G7', '还在发展中，需要多练', '4/2/2'],
    ]);
  });

  it('最需要練的是平衡（較差的段）再來是跑跳；下一步是起始月齡最早的那一題', () => {
    expect(d.focus.map(f => f.key)).toEqual(['G7', 'G6']);
    expect(d.focus[0].next).toBe('能单脚站一两秒');
    expect(d.focus[1].next).toBe('能往前连续跳两三下');
    expect(d.focus[0].items).toEqual([
      { kind: 1, text: '能单脚站一两秒' }, { kind: 1, text: '能双手接住抛来的大球' },
      { kind: 2, text: '能沿着地上的直线走十步' }, { kind: 2, text: '能单脚站五秒以上' },
    ]);
  });

  it('整支 91% 是最好那段，總覽不說「各面向都好」，而是點名平衡', () => {
    expect(d.overall).toContain('76 题里已经会 69 题');
    expect(d.overall).toContain('「平衡与球类协调」还在发展中，是这次最需要练的地方');
    expect(d.overall).not.toContain('达成良好');
  });

  it('面向說明與練法取客戶原文、改寫過', () => {
    expect(d.focus[0].what).toContain('单脚站、走直线、接抛球、拍球、骑车');
    expect(d.focus[0].what).not.toContain('落后');
    expect(d.focus[0].tips).toHaveLength(4);
  });

  it('全文沒有禁字', () => {
    expect(findBannedWords(allText(d))).toEqual([]);
  });
});

describe('達成率族：其他情形', () => {
  it('全部都會：不展開，總覽用題庫最好那段的建議（改寫後）', () => {
    const d = detailFor('SXK-GM', 48);
    expect(d.focus).toEqual([]);
    expect(d.overall).toContain('各面向没有集中需要留意的地方');
  });

  it('整支落在需要評估的那段：總覽接上題庫的建議（含物理治疗评估）', () => {
    const d = detailFor('SXK-GM', 48, {}, () => 0);
    expect(d.focus).toHaveLength(2);
    expect(d.overall).toMatch(/物理治疗|神经动作评估|发展评估/);
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('題數太少的面向只列題數，不單獨判', () => {
    const d = detailFor('SXK-GM', 2);
    const few = d.facets.filter(f => f.fewItems);
    expect(few.length).toBeGreaterThan(0);
    expect(few.every(f => f.plain === '题数太少，这次不单独判断')).toBe(true);
  });

  it('ASQ3：五個領域、選項 10／5／0 也分得出三種作答', () => {
    const bank = KITV3_BANKS['SXK-ASQ3'];
    const asked = askedItems(bank, { ageM: 30 }).filter(a => a.section === 'gm');
    const d = detailFor('SXK-ASQ3', 30, { [asked[0].item.key]: 5, [asked[1].item.key]: 0 });
    expect(d.facets.map(f => f.key)).toEqual(['cm', 'gm', 'fm', 'ps', 'so']);
    expect(d.facets.find(f => f.key === 'gm')!.counts).toEqual([4, 1, 1]);
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('VOC：面向不分段判時，看整支分段決定要不要展開', () => {
    expect(detailFor('SXK-VOC', 30).focus).toEqual([]);
    const low = detailFor('SXK-VOC', 30, {}, () => 0);
    expect(low.focus.length).toBeGreaterThan(0);
    expect(low.facets.every(f => f.plain === null)).toBe(true);
  });

  it('LANG：沒有出題的面向（60 個月以下的 LS）不列', () => {
    expect(detailFor('SXK-LANG', 48).facets.map(f => f.key)).not.toContain('LS');
  });

});

// ── D-4：頻率族與七級 ──

/** 每支一個孩子：各段第一個面向的題全答「最差」，其餘最好（ADL 反過來：最差＝1）。 */
function worstFirstFacet(code: string, ageM: number): ScaleDetail {
  const bank = KITV3_BANKS[code];
  const context = { ageM };
  const asked = askedItems(bank, context);
  const firstFacet = scoreKitV3(bank, {}, context).facets[0]?.key;
  const answers: Record<string, number> = {};
  for (const { section, item } of asked) {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    const vals = bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    const good = bank.family === 'adl' || bank.family === 'pct' ? Math.max(...vals) : Math.min(...vals);
    const bad = bank.family === 'adl' || bank.family === 'pct' ? Math.min(...vals) : Math.max(...vals);
    const inFirst = section === firstFacet || ((item as { tags?: string[] }).tags ?? []).some(t => ['wm', 'pl'].includes(t));
    answers[item.key] = inFirst && sec.options === 'main' ? bad : good;
  }
  const score = scoreKitV3(bank, answers, context);
  const d = scaleDetailOf({ bank, answers, score, context });
  if (!d) throw new Error(`${code} 沒有详解`);
  return d;
}

const D4: Array<[string, number]> = [
  ['SXK-ASB', 48], ['SXK-ASR', 48], ['SXK-AB', 72], ['SXK-ATT', 72], ['SNAP-IV', 96], ['CHEXI', 96],
  ['SXK-LDP', 96], ['SXK-LDS', 160], ['SXK-SP', 48], ['SXK-SPb', 96], ['SXK-ADL', 48],
];

describe('頻率族與七級（D-4）', () => {
  it.each(D4)('%s：第一個面向是最需要關心的，全文（含面向名稱）沒有禁字', (code, age) => {
    const d = worstFirstFacet(code, age);
    expect(d.focus.length).toBeGreaterThan(0);
    expect(d.focus[0].items.length).toBeGreaterThan(0);
    const names = d.facets.map(f => f.name).join('\n');
    expect(findBannedWords(allText(d) + '\n' + names + '\n' + d.focus.map(f => f.name).join('\n'))).toEqual([]);
  });

  it('頻率族不講「下一步」，最常出現的題排前面', () => {
    const d = worstFirstFacet('SXK-ASB', 48);
    expect(d.mode).toBe('frequent');
    expect(d.focus.every(f => f.next === null)).toBe(true);
    expect(d.kinds.map(k => k.label)).toEqual(['很少或没有', '偶尔', '常出现']);
    expect(d.focus[0].items[0].kind).toBe(2);
  });

  it('ASR 的作答種類用「和同龄孩子比起来」的說法（原選項的「轻度／中度不同」踩禁字）', () => {
    expect(worstFirstFacet('SXK-ASR', 48).kinds.map(k => k.label)).toEqual(['和同龄孩子相近', '有一点不同', '很不一样']);
  });

  it('CHEXI：因素的題由副量表標籤組成，說明把兩個副量表接起來', () => {
    const d = worstFirstFacet('CHEXI', 96);
    const f1 = d.facets.find(f => f.key === 'F1')!;
    expect(f1.asked).toBe(13);
    expect(f1.counts[2]).toBe(13);
    const focus = d.focus.find(f => f.key === 'F1')!;
    expect(focus.what.length).toBeGreaterThan(20);
    expect(focus.tips.length).toBeGreaterThan(2);
  });

  it('ADL：七級分三種，講「下一步」', () => {
    const d = worstFirstFacet('SXK-ADL', 48);
    expect(d.mode).toBe('next');
    expect(d.kinds.map(k => k.label)).toEqual(['自己做到', '需要一点帮忙', '大人做为主']);
    expect(d.focus[0].next).not.toBeNull();
  });

  it('全部最好：頻率族不展開', () => {
    const bank = KITV3_BANKS['SXK-SP'];
    const context = { ageM: 48 };
    const answers: Record<string, number> = {};
    for (const { item } of askedItems(bank, context)) answers[item.key] = 0;
    const d = scaleDetailOf({ bank, answers, score: scoreKitV3(bank, answers, context), context })!;
    expect(d.focus).toEqual([]);
    expect(findBannedWords(d.overall)).toEqual([]);
  });
});

describe('面向名稱', () => {
  it('24 支的段落與因素名稱，經過換名之後都沒有禁字', async () => {
    const { FACET_NAME_ALIAS } = await import('../src/t2/scaleDetailCopy');
    const bad: string[] = [];
    for (const b of Object.values(KITV3_BANKS)) {
      const names = b.forms.flatMap(f => f.sections.map(s => [s.key, s.name] as const));
      for (const f of (b.scoring as { factors?: Array<{ key: string; name: string }> }).factors ?? []) names.push([f.key, f.name]);
      for (const [k, n] of names) if (findBannedWords(FACET_NAME_ALIAS[b.code]?.[k] ?? n).length) bad.push(`${b.code} ${k} ${n}`);
    }
    expect(bad).toEqual([]);
  });
});

// ── D-5：LQ、M-CHAT、EMO、TIC、QOL ──

function detailWith(code: string, ageM: number, pick: (vals: number[], section: string, key: string) => number | null, ctx: Record<string, unknown> = {}): ScaleDetail {
  const bank = KITV3_BANKS[code];
  const context = { ageM, ...ctx };
  const answers: Record<string, number | null> = {};
  for (const { section, item } of askedItems(bank, context)) {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    const vals = bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    answers[item.key] = pick(vals, section, item.key);
  }
  const d = scaleDetailOf({ bank, answers, score: scoreKitV3(bank, answers, context), context });
  if (!d) throw new Error(code);
  return d;
}

describe('D-5', () => {
  it('LQ：3／2／1 分三種，「不确定」不算；理解那一面還不行時是最需要練的', () => {
    const d = detailWith('SXK-LQ', 36, (vals, section) => (section === 'L1' ? 1 : section === 'FLAGS' ? 0 : Math.max(...vals)));
    expect(d.kinds.map(k => k.label)).toEqual(['已经可以', '偶尔可以', '还不行']);
    expect(d.focus[0].key).toBe('L1');
    expect(d.focus[0].next).not.toBeNull();
    expect(d.overall).not.toContain('带');
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('M-CHAT：沒有分面向，整份當一個；第 2、5、12 題答「是」才算要留意', () => {
    const allNo = detailWith('M-CHAT-R/F', 24, () => 0);
    // 全答「否」：除了 2、5、12 題，其餘 17 題都是要留意的那一邊。
    expect(allNo.kinds[2].count).toBe(17);
    expect(allNo.facets).toHaveLength(1);
    expect(allNo.overall).toContain('近期请专业人员当面评估');
    const typical = detailWith('M-CHAT-R/F', 24, (_v, _s, key) => (['q2', 'q5', 'q12'].includes(key) ? 0 : 1));
    expect(typical.kinds[2].count).toBe(0);
    expect(typical.focus).toEqual([]);
    expect(typical.overall).toContain('两岁时可以再做一次');
    expect(findBannedWords(allText(allNo) + allText(typical))).toEqual([]);
  });

  it('EMO：七個向度照頻率講，「功能影响」不列；向度說明是客戶的 DIMS（改寫過）', () => {
    const d = detailWith('SXK-EMO', 72, (vals, section) => (section === 'E2' ? 3 : section === 'DUR' ? 0 : 0));
    expect(d.facets.map(f => f.key)).not.toContain('IMP');
    expect(d.focus[0].key).toBe('E2');
    expect(d.focus[0].what).toContain('担心');
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('TIC：題目接上選了的那一句錨點', () => {
    const d = detailWith('SXK-TIC', 96, (vals, section) => (section === 'M' ? 3 : section === 'FLAGS' ? 0 : 0));
    expect(d.focus[0].key).toBe('M');
    expect(d.focus[0].items[0].text).toMatch(/^数量：/);
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('QOL：頻率族四段', () => {
    const d = detailWith('SXK-QOL', 72, (vals, section) => (section === 'EM' ? 3 : 0), { inSchool: true });
    expect(d.focus[0].key).toBe('EM');
    expect(findBannedWords(allText(d))).toEqual([]);
  });

  it('只剩氣質沒有量表详解（報告另一段）', () => {
    expect(Object.values(KITV3_BANKS).filter(b => !hasScaleDetail(b)).map(b => b.code)).toEqual(['ITQ/TTS/BSQ']);
  });
});
