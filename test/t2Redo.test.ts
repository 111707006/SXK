import { describe, it, expect } from 'vitest';
import { REDO_WINDOW_DAYS, buildT2Findings, redoNotes } from '../src/t2/findings';
import type { ToolId } from '../src/t2/toolkit';
import type { ToolResult } from '../src/t2/types';

/**
 * 「距上次 N 天」（§10.2 第 2 項，#59）。
 *
 * 【這裡在防什麼】
 * 練習效應：同一份題目隔幾天再答一次，分數會往上跑，而那不是孩子變了。報告上要看得到
 * 「這一支是三天前才做過的」，否則讀報告的人會把練出來的那幾分讀成進步。
 *
 * 1. **只比前一筆**：答過三次時，比的是第二次與第三次，不是第一次與第三次。
 * 2. **超過 30 天就沒有**：31 天不標。邊界那一天（剛好 30）**要標**。
 * 3. **沒做完的不算「上一次」**：半途離開的那一次，題目也只看了一半。
 * 4. **一支都沒有時整個欄位不在**：舊快照讀回來也是沒有這個欄位，兩者在畫面上要一樣。
 *
 * 這裡不走 `scoreTool` —— 要測的是「兩筆之間差幾天」，與作答內容無關，所以直接捏
 * `ToolResult` 的四個欄位（`latestCompleteResults` 與 `redoNotes` 只讀這四個）。
 */

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse('2026-09-12T00:00:00.000Z');

/** 一筆「完整」的結果：只填挑選邏輯讀得到的欄位。 */
function result(toolId: ToolId, daysAgo: number, opts: { complete?: boolean } = {}): ToolResult {
  const asked = 10;
  return {
    toolId,
    toolkitVersion: 'kit-20260908',
    assessedAgeMonth: 48,
    rater: 'mother',
    askedCount: asked,
    answeredCount: opts.complete === false ? asked - 1 : asked,
    sections: {},
    overall: { raw: 0, max: 0, pct: null, tier: 1, scored: true },
    native: {},
    pre: {},
    answers: {},
    computedAt: new Date(BASE - daysAgo * DAY).toISOString(),
  } as unknown as ToolResult;
}

describe('redoNotes', () => {
  it('同一支做過兩次、相距 3 天 → 一條「距上次 3 天」', () => {
    expect(redoNotes([result('sxk-lang', 3), result('sxk-lang', 0)])).toEqual([
      { toolId: 'sxk-lang', daysSinceLast: 3 },
    ]);
  });

  it('只做過一次 → 沒有', () => {
    expect(redoNotes([result('sxk-lang', 0)])).toEqual([]);
  });

  it('剛好 30 天 → 有；31 天 → 沒有', () => {
    expect(redoNotes([result('sxk-lang', REDO_WINDOW_DAYS), result('sxk-lang', 0)])).toEqual([
      { toolId: 'sxk-lang', daysSinceLast: REDO_WINDOW_DAYS },
    ]);
    expect(redoNotes([result('sxk-lang', REDO_WINDOW_DAYS + 1), result('sxk-lang', 0)])).toEqual([]);
  });

  it('不足一天算 0 天，天數無條件捨去', () => {
    const a = result('sxk-lang', 0);
    const b = { ...a, computedAt: new Date(BASE + 90 * 60 * 1000).toISOString() } as ToolResult;
    expect(redoNotes([a, b])).toEqual([{ toolId: 'sxk-lang', daysSinceLast: 0 }]);
  });

  it('做過三次 → 比的是最後兩次，不是最早那次', () => {
    // 60 天前、2 天前、今天：與最新那筆相距 2 天，不是 60。
    expect(redoNotes([result('sxk-lang', 60), result('sxk-lang', 2), result('sxk-lang', 0)])).toEqual([
      { toolId: 'sxk-lang', daysSinceLast: 2 },
    ]);
  });

  it('最近那次沒做完 → 用兩筆完整的比；沒做完的那筆不當「上一次」', () => {
    const notes = redoNotes([
      result('sxk-lang', 40),
      result('sxk-lang', 5),
      result('sxk-lang', 0, { complete: false }),
    ]);
    // 兩筆完整的相距 35 天 → 超過窗口，沒有。沒做完的那筆若被算進去會變成 5 天。
    expect(notes).toEqual([]);
  });

  it('兩支各自重做 → 兩條，依較新那筆的完成順序', () => {
    expect(redoNotes([
      result('sxk-ab', 9),
      result('sxk-lang', 4),
      result('sxk-ab', 2),
      result('sxk-lang', 0),
    ])).toEqual([
      { toolId: 'sxk-ab', daysSinceLast: 7 },
      { toolId: 'sxk-lang', daysSinceLast: 4 },
    ]);
  });

  it('傳入順序打亂不影響結果（看的是 computedAt）', () => {
    const shuffled = [result('sxk-lang', 0), result('sxk-lang', 3)];
    expect(redoNotes(shuffled)).toEqual([{ toolId: 'sxk-lang', daysSinceLast: 3 }]);
  });
});

describe('buildT2Findings 帶 redos', () => {
  const flags = { COG: 0, LANG: 0, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0 } as const;

  it('有 30 天內重做 → 快照帶 redos', () => {
    const findings = buildT2Findings({
      results: [result('sxk-lang', 3), result('sxk-lang', 0)],
      t1Flags: flags,
      assessedAgeMonth: 48,
    });
    expect(findings.redos).toEqual([{ toolId: 'sxk-lang', daysSinceLast: 3 }]);
  });

  it('沒有重做 → 整個欄位不在（不是空陣列）', () => {
    const findings = buildT2Findings({ results: [result('sxk-lang', 0)], t1Flags: flags, assessedAgeMonth: 48 });
    expect('redos' in findings).toBe(false);
  });
});
