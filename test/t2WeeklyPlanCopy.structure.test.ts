import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { findBannedWords } from './helpers/parentWording';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { TAG_SENTENCES } from '../src/t2/report/sentences';
import { ACTIVITY_TAGS } from '../src/t2/findingTags';
import {
  AGE_BAND_LABEL,
  AGE_SPLIT_NOTE,
  BELOW_WINDOW_NOTE,
  PREPARING_SENTENCE,
  STATUS_OF_BAND,
  ageBandLabel,
  reasonSentence,
  weekRangeLabel,
} from '../src/t2/weeklyCopy';
import type { PickReason } from '../src/t2/activityMatch';

/**
 * 每週活動畫面的句子與結構（票 #60）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘四件事：
 * 1. **「因為……所以練……」真的展得開**：規格 §7.3 的 `reason` 是四個欄位，畫面上要是一句話。
 * 2. **band 的說法來自全站唯一的那一份**（`statusWording.ts`）：元件與句子層都不自己寫
 *    「需要多練習」這種話 —— 那就是「同一顆紅燈五個名字」的下一次。
 * 3. **配不到活動時說「準備中」並導向專家**，而不是往上取一支孩子做不到的活動。
 * 4. **步驟有幾則顯示幾則**：不補、不截（§7.4 的內容缺口是真的缺，畫面不該幫它圓）。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 註解裡舉的反例不算真的文案。 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const view = stripComments(read('src/components/T2WeeklyPlan.tsx'));
const copy = stripComments(read('src/t2/weeklyCopy.ts'));

function reason(over: Partial<PickReason> = {}): PickReason {
  return { band: 'refer', window: { lo: 24, hi: 36 }, matchedTags: [], belowWindow: false, ...over };
}

describe('「因為……所以練……」', () => {
  it('對上 ★ 標籤時，句子裡有那一項的說法', () => {
    const sentence = reasonSentence('LANG', reason({ matchedTags: ['lang.expression'] }));
    expect(sentence).toContain('语言沟通');
    expect(sentence).toContain(STATUS_WORDING.delay.describe);
    expect(sentence).toContain(TAG_SENTENCES['lang.expression'].replace(/。$/, ''));
    // 句號與後面的逗號不該疊在一起
    expect(sentence).not.toContain('。）');
    expect(sentence.startsWith('因为')).toBe(true);
    expect(sentence).toContain('所以');
  });

  it('沒對上任何標籤時省掉中間那一段，不硬安一個上去', () => {
    const sentence = reasonSentence('LANG', reason());
    expect(sentence).not.toContain('这次看到');
    expect(sentence).toContain('语言沟通');
  });

  it('watch 與 refer 用的是 statusWording 的兩種說法，不是自己寫的', () => {
    expect(reasonSentence('ATT', reason({ band: 'watch' }))).toContain(STATUS_WORDING.borderline.describe);
    expect(reasonSentence('ATT', reason({ band: 'refer' }))).toContain(STATUS_WORDING.delay.describe);
    expect(STATUS_OF_BAND).toEqual({ clear: 'normal', watch: 'borderline', refer: 'delay' });
  });

  it('每一個 ★ 標籤都查得到句子（配對只吐得出這些）', () => {
    for (const tag of ACTIVITY_TAGS) {
      const sentence = reasonSentence('LANG', reason({ matchedTags: [tag] }));
      expect(sentence, tag).toContain(TAG_SENTENCES[tag].replace(/。$/, ''));
    }
  });

  it('產出的每一句都沒有《對照表》的禁字', () => {
    for (const tag of ACTIVITY_TAGS) {
      for (const band of ['watch', 'refer'] as const) {
        const sentence = reasonSentence('LANG', reason({ band, matchedTags: [tag] }));
        const hits = findBannedWords(sentence);
        expect(hits, `${band}/${tag}：${hits.join('、')}`).toEqual([]);
      }
    }
  });
});

describe('年齡段與週次', () => {
  it('四個年齡段各有家長讀的說法', () => {
    expect(AGE_BAND_LABEL).toEqual({ '<12': '1 岁前', '12-36': '1–3 岁', '36-72': '3–6 岁', '72+': '6 岁以上' });
    expect(ageBandLabel('36-72')).toBe('3–6 岁');
  });

  it('認不得的年齡段回空字串（畫面少一行，不是壞掉）', () => {
    expect(ageBandLabel('nope')).toBe('');
  });

  it('週次寫成「9 月 7 日 – 9 月 13 日」；認不得回空字串', () => {
    expect(weekRangeLabel('2026-09-07', '2026-09-13')).toBe('9 月 7 日 – 9 月 13 日');
    expect(weekRangeLabel('2026/09/07', '2026-09-13')).toBe('');
  });

  it('畫面標出配對用的年齡段，兩個月齡不同時多一句說明', () => {
    expect(view).toContain('ageBandLabel');
    expect(view).toContain('AGE_SPLIT_NOTE');
    expect(view).toMatch(/plan\.ageMonth !== plan\.reportAgeMonth/);
    expect(AGE_SPLIT_NOTE).toContain('现在的月龄');
    expect(AGE_SPLIT_NOTE).toContain('答题');
  });
});

describe('配不到活動時', () => {
  it('說「準備中」並導向專家（四種服務），不是往上取一支', () => {
    expect(PREPARING_SENTENCE).toContain('准备中');
    expect(view).toContain('PREPARING_SENTENCE');
    expect(view).toContain('serviceTypeDescriptors');
    expect(view).toContain('onBookService');
  });

  it('往前取的那一支會多說一句（不是安靜地給一支更早的）', () => {
    expect(view).toContain('BELOW_WINDOW_NOTE');
    expect(view).toMatch(/reason\.belowWindow/);
    expect(BELOW_WINDOW_NOTE).toContain('往前');
  });
});

describe('畫面只排版，不自己算', () => {
  it('資料來自 GET /api/t2/weekly-plan，元件不 import 配對函式', () => {
    expect(view).toContain('/api/t2/weekly-plan');
    expect(view).not.toContain('matchWeeklyActivities');
  });

  it('維度名稱用查的，不抄', () => {
    expect(view).toContain('SITE_DIMENSION_NAME');
    expect(view).not.toContain('语言沟通');
  });

  it('句子在 weeklyCopy.ts，元件只 import', () => {
    expect(view).toMatch(/from '\.\.\/t2\/weeklyCopy'/);
    expect(view).toContain('reasonSentence');
    expect(view).not.toContain('因为');
  });

  it('步驟有幾則顯示幾則：沒有 slice、沒有補空的', () => {
    expect(view).toMatch(/activity\.steps\.map/);
    expect(view).not.toMatch(/steps\.slice/);
  });

  it('示範連結有才顯示', () => {
    expect(view).toMatch(/activity\.videoUrl &&/);
  });
});

describe('句子層本身', () => {
  it('band 的說法一律查 statusWording，不在這裡寫死', () => {
    expect(copy).toContain('STATUS_WORDING');
    for (const w of Object.values(STATUS_WORDING)) {
      expect(copy, w.describe).not.toContain(w.describe);
    }
  });

  it('固定的三句都沒有禁字', () => {
    for (const sentence of [PREPARING_SENTENCE, AGE_SPLIT_NOTE, BELOW_WINDOW_NOTE]) {
      const hits = findBannedWords(sentence);
      expect(hits, `${sentence}：${hits.join('、')}`).toEqual([]);
    }
  });
});
