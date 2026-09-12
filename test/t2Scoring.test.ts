import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import {
  FAMILIES,
  answerKey,
  askedItems,
  isScored,
  scoreTool,
  tierFor,
} from '../src/t2/scoring';
import type { AnswerValue, ScoreOutcome } from '../src/t2/scoring';
import type { Tier, ToolResult } from '../src/t2/types';

/**
 * 計分與分級（#46，規格 v2 §5.1 後半、§5.2、§5.3）。
 *
 * 【這裡在防什麼】
 * 分級的每一條界線都是臨床判斷的界線：pct 85 與 84 差一個 tier，之後差一個 band，
 * 家長最後看到的是「未見明顯問題」還是「建議進一步評估」。算錯一分不會有型別錯誤、
 * 不會丟例外，只會安靜地把一個孩子放到另一邊。所以每條界線上下各一個測試。
 *
 * 【為什麼分兩層測】
 * 界線本身測 `tierFor` —— 它吃「一個數字＋一張分段表」，是界線真正住的地方，而且
 * 能精確踩在 85／84 上。真實作答**踩不到大部分界線**：達成率的分母是題數 × 2，
 * sxk-gm 40 題的滿分是 80，pct 只能是 1.25 的倍數，84 這個值根本不存在（83.75 進位
 * 才變成 84）。所以另一層是端到端：造一份真的作答，確認它一路流到對的 tier。
 *
 * 下面所有門檻都是從規格 §5.3 **重新抄一次**的，不是從 `TOOLKIT[id].tiers` 讀出來的。
 */

const AT = '2026-09-12T00:00:00.000Z';

function ok(outcome: ScoreOutcome): ToolResult {
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

function refused(outcome: ScoreOutcome) {
  if (outcome.ok) throw new Error('預期拒算，卻算出了結果');
  return outcome;
}

function run(
  toolId: ToolId,
  ageMonth: number,
  answers: Record<string, AnswerValue>,
  pre?: Record<string, string | string[] | boolean>,
): ScoreOutcome {
  return scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, pre, computedAt: AT });
}

function keysBySection(toolId: ToolId, ageMonth: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of askedItems(toolId, ageMonth)) {
    (out[a.sectionKey] ??= []).push(a.key);
  }
  return out;
}

/** 把 `raw` 分配到這些題上，每題落在 `lo`–`hi`。放不進去就讓測試自己壞掉，不要默默算出別的數。 */
function distribute(
  target: Record<string, AnswerValue>,
  keys: ReadonlyArray<string>,
  raw: number,
  lo: number,
  hi: number,
): void {
  let left = raw - lo * keys.length;
  if (left < 0 || left > (hi - lo) * keys.length) {
    throw new Error(`raw ${raw} 放不進 ${keys.length} 題（每題 ${lo}–${hi}）`);
  }
  for (const k of keys) {
    const add = Math.min(hi - lo, left);
    target[k] = lo + add;
    left -= add;
  }
}

/** 依「總分 raw」造一份完整作答。 */
function byTotal(toolId: ToolId, ageMonth: number, raw: number, lo: number, hi: number) {
  const out: Record<string, AnswerValue> = {};
  distribute(out, askedItems(toolId, ageMonth).map(a => a.key), raw, lo, hi);
  return out;
}

/** 依「各面向 raw」造一份完整作答；沒指定的面向給 `lo`。 */
function bySection(
  toolId: ToolId,
  ageMonth: number,
  raws: Record<string, number>,
  lo: number,
  hi: number,
) {
  const out: Record<string, AnswerValue> = {};
  for (const [sectionKey, keys] of Object.entries(keysBySection(toolId, ageMonth))) {
    distribute(out, keys, raws[sectionKey] ?? lo * keys.length, lo, hi);
  }
  return out;
}

function flat(toolId: ToolId, ageMonth: number, value: AnswerValue) {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

// ---------------------------------------------------------------------------
// 一、分級的每一條界線（§5.3）
// ---------------------------------------------------------------------------

/** [拿去比分段表的值, 預期 tier]。門檻從 §5.3 重抄。 */
const BOUNDARIES: ReadonlyArray<{ tool: ToolId; what: string; cases: ReadonlyArray<[number, Tier]> }> = [
  // 達成率六支共用同一張表：≥85 ／ 70–84 ／ 55–69 ／ ≤54
  { tool: 'sxk-gm', what: '達成率 %', cases: [[100, 1], [85, 1], [84, 2], [70, 2], [69, 3], [55, 3], [54, 4], [0, 4]] },
  { tool: 'sxk-soc', what: '達成率 %', cases: [[85, 1], [84, 2]] },
  { tool: 'sxk-lang', what: '達成率 %', cases: [[85, 1], [84, 2]] },
  { tool: 'sxk-adp', what: '達成率 %', cases: [[70, 2], [69, 3]] },
  { tool: 'sxk-voc', what: '達成率 %', cases: [[55, 3], [54, 4]] },
  { tool: 'sxk-asq', what: '達成率 %', cases: [[85, 1], [54, 4]] },
  // 通過率：≥90 ／ 75–89 ／ 60–74 ／ ≤59
  { tool: 'sxk-dev', what: '通過率 %', cases: [[100, 1], [90, 1], [89, 2], [75, 2], [74, 3], [60, 3], [59, 4], [0, 4]] },
  // 獨立率：≥72 ／ 58–71 ／ 45–57 ／ ≤44
  { tool: 'sxk-adl', what: '獨立率 %', cases: [[100, 1], [72, 1], [71, 2], [58, 2], [57, 3], [45, 3], [44, 4], [0, 4]] },
  // 關切率六支，每支自己一套（§5.3「本規格照各支原值」）
  { tool: 'sxk-asb', what: '關切率 %', cases: [[0, 1], [22, 1], [23, 2], [31, 2], [32, 3], [40, 3], [41, 4], [100, 4]] },
  { tool: 'sxk-asr', what: '關切率 %', cases: [[0, 1], [20, 1], [21, 2], [29, 2], [30, 3], [38, 3], [39, 4], [100, 4]] },
  { tool: 'sxk-att', what: '關切率 %', cases: [[0, 1], [25, 1], [26, 2], [33, 2], [34, 3], [42, 3], [43, 4], [100, 4]] },
  { tool: 'sxk-ab', what: '關切率 %', cases: [[0, 1], [33, 1], [34, 2], [41, 2], [42, 3], [50, 3], [51, 4], [100, 4]] },
  { tool: 'sxk-spa', what: '關切率 %', cases: [[0, 1], [28, 1], [29, 2], [36, 2], [37, 3], [45, 3], [46, 4], [100, 4]] },
  { tool: 'sxk-spb', what: '關切率 %', cases: [[0, 1], [28, 1], [29, 2], [36, 2], [37, 3], [45, 3], [46, 4], [100, 4]] },
  // 總分：0–9 ／ 10–19 ／ 20–29 ／ ≥30
  { tool: 'sxk-ldp', what: '總分', cases: [[0, 1], [9, 1], [10, 2], [19, 2], [20, 3], [29, 3], [30, 4], [90, 4]] },
  { tool: 'sxk-lds', what: '總分', cases: [[9, 1], [10, 2], [19, 2], [20, 3], [29, 3], [30, 4]] },
  // SNAP-IV：max 含、min 不含 —— 1.2 落在好的那一邊
  { tool: 'snap-iv', what: '分量表均分', cases: [[0, 1], [1.2, 1], [1.21, 2], [1.8, 2], [1.81, 3], [3, 3]] },
  // M-CHAT-R/F：0–2 ／ 3–7 ／ 8–20
  { tool: 'mchat-rf', what: '風險題數', cases: [[0, 1], [2, 1], [3, 2], [7, 2], [8, 3], [20, 3]] },
  // CHEXI：因素相對百分比 ≤33 ／ 34–66 ／ ≥67
  { tool: 'chexi', what: '因素 %', cases: [[0, 1], [33, 1], [34, 2], [66, 2], [67, 3], [100, 3]] },
  // 氣質：min 含、max 不含 —— 0.42 落在偏的那一邊
  { tool: 'sxk-tempa', what: '|dev|', cases: [[0, 1], [0.41, 1], [0.42, 2], [0.99, 2], [1.0, 3], [2.5, 3]] },
  { tool: 'sxk-tempb', what: '|dev|', cases: [[0.41, 1], [0.42, 2], [0.99, 2], [1.0, 3]] },
  // 預警：0 ／ —— ／ ≥1（沒有 tier 2、沒有 tier 4）
  { tool: 'sxk-warn', what: '陽性數', cases: [[0, 1], [1, 3], [4, 3]] },
];

describe('分級：每條 tier 分界上下各一個（§5.3）', () => {
  for (const { tool, what, cases } of BOUNDARIES) {
    it(`${tool} ${what}`, () => {
      const family = TOOL_SPECS[tool].family;
      const tiers = TOOLKIT[tool].tiers;
      for (const [value, expected] of cases) {
        expect(`${tool} ${value} → ${tierFor(family, tiers, value)}`).toBe(`${tool} ${value} → ${expected}`);
      }
    });
  }

  it('ldp／lds 的各方面另有一套：0–4 ／ 5–8 ／ 9–12 ／ ≥13', () => {
    for (const tool of ['sxk-ldp', 'sxk-lds'] as const) {
      const sectionTiers = TOOLKIT[tool].sectionTiers;
      expect(sectionTiers).toBeDefined();
      const cases: Array<[number, Tier]> = [[0, 1], [4, 1], [5, 2], [8, 2], [9, 3], [12, 3], [13, 4], [18, 4]];
      for (const [value, expected] of cases) {
        expect(`${tool} 面向 ${value} → ${tierFor('total', sectionTiers ?? [], value)}`)
          .toBe(`${tool} 面向 ${value} → ${expected}`);
      }
    }
  });

  it('值是 null（分母 0、或這一族的這一格不判級）→ tier 也是 null，不是最好的那一段', () => {
    expect(tierFor('achievement', TOOLKIT['sxk-gm'].tiers, null)).toBeNull();
    expect(tierFor('pass', TOOLKIT['sxk-dev'].tiers, null)).toBeNull();
    expect(tierFor('mean-chexi', TOOLKIT['chexi'].tiers, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 二、四捨五入（§5.2「先四捨五入再比門檻」）
// ---------------------------------------------------------------------------

describe('四捨五入：先進位，再比門檻', () => {
  /**
   * 84.5 → 85 → tier 1。
   *
   * 這一條只能在族函式這一層測，因為真實題庫造不出 84.5：達成率的精確值是
   * `raw × 50 ÷ n`，要它剛好是 84.5 得有 `raw × 100 = 169n`，而 169 與 100 互質，
   * 所以 `n` 必須是 100 的倍數。22 支裡最長的面向是 sxk-lang 的 EX，18 題。
   */
  it('達成率 pct 恰為 84.5 時進位成 85，並因此跨到 tier 1', () => {
    const values: number[] = [];
    for (let i = 0; i < 100; i++) values.push(i < 84 ? 2 : i === 84 ? 1 : 0);
    const stat = FAMILIES.achievement.section(values, []);
    expect({ n: stat.n, raw: stat.raw, max: stat.max }).toEqual({ n: 100, raw: 169, max: 200 });
    expect(stat.raw / stat.max * 100).toBe(84.5);
    expect(stat.pct).toBe(85);
    expect(tierFor('achievement', TOOLKIT['sxk-gm'].tiers, stat.pct)).toBe(1);
  });

  it('少一分（84.0）就留在 tier 2 —— 進位不是無條件進位', () => {
    const values: number[] = [];
    for (let i = 0; i < 100; i++) values.push(i < 84 ? 2 : 0);
    const stat = FAMILIES.achievement.section(values, []);
    expect(stat.pct).toBe(84);
    expect(tierFor('achievement', TOOLKIT['sxk-gm'].tiers, stat.pct)).toBe(2);
  });

  it('真實作答也走同一條路：sxk-gm 40 題 raw 67 → 83.75 → 84 → tier 2', () => {
    const asked = askedItems('sxk-gm', 72);
    expect(asked).toHaveLength(40);
    const r = ok(run('sxk-gm', 72, byTotal('sxk-gm', 72, 67, 0, 2)));
    expect(r.overall.max).toBe(80);
    expect(r.overall.pct).toBe(84);
    expect(r.overall.tier).toBe(2);
  });

  it('raw 68 → 85.0 → tier 1', () => {
    const r = ok(run('sxk-gm', 72, byTotal('sxk-gm', 72, 68, 0, 2)));
    expect(r.overall.pct).toBe(85);
    expect(r.overall.tier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 三、十個族端到端（§5.2）
// ---------------------------------------------------------------------------

describe('達成率（achievement）', () => {
  it('滿分＝題數 × 2，全答「已经会」是 100%', () => {
    const r = ok(run('sxk-gm', 72, flat('sxk-gm', 72, 2)));
    expect(r.overall).toMatchObject({ n: 40, raw: 80, max: 80, pct: 100, tier: 1, scored: true });
  });

  it('全答「还不会」是 0%、tier 4', () => {
    const r = ok(run('sxk-gm', 72, flat('sxk-gm', 72, 0)));
    expect(r.overall).toMatchObject({ raw: 0, pct: 0, tier: 4 });
  });

  it('面向各自算，不是總分平均', () => {
    const r = ok(run('sxk-gm', 72, bySection('sxk-gm', 72, { P1: 16, P5: 0 }, 0, 2)));
    expect(r.sections.P1).toMatchObject({ n: 8, raw: 16, max: 16, pct: 100, tier: 1 });
    expect(r.sections.P5).toMatchObject({ n: 8, raw: 0, max: 16, pct: 0, tier: 4 });
  });
});

describe('通過率（pass）：dev 的「不評」不進分母', () => {
  const AGE = 30; // 25–36 那一段，六領域各 5 題

  function devAnswers(per: Record<string, ReadonlyArray<AnswerValue>>) {
    const out: Record<string, AnswerValue> = {};
    for (const [sectionKey, keys] of Object.entries(keysBySection('sxk-dev', AGE))) {
      const values = per[sectionKey] ?? keys.map(() => 'pass');
      keys.forEach((k, i) => {
        out[k] = values[i];
      });
    }
    return out;
  }

  it('一個領域五題答「通過 4、不評 1」→ 分母 4、pct 100', () => {
    const r = ok(run('sxk-dev', AGE, devAnswers({ MOT: ['pass', 'pass', 'pass', 'pass', 'skip'] })));
    expect(r.sections.MOT).toMatchObject({ n: 4, raw: 4, max: 4, pct: 100, tier: 1, scored: true });
    expect(r.native['skipped.MOT']).toBe(1);
  });

  it('五題全「不評」→ pct null、tier null、scored false', () => {
    const r = ok(run('sxk-dev', AGE, devAnswers({ LANG: ['skip', 'skip', 'skip', 'skip', 'skip'] })));
    expect(r.sections.LANG).toMatchObject({ n: 0, raw: 0, max: 0, pct: null, tier: null, scored: false });
    expect(r.native['skipped.LANG']).toBe(5);
  });

  it('通過 4、未通過 1 → 80%、tier 2（工具包的報告矩陣就是這樣判的）', () => {
    const r = ok(run('sxk-dev', AGE, devAnswers({ SOC: ['pass', 'pass', 'pass', 'pass', 'fail'] })));
    expect(r.sections.SOC).toMatchObject({ n: 5, raw: 4, pct: 80, tier: 2 });
  });

  it('題 key 帶年齡段前綴（附錄 A 的 `${band}.${domain}.${idx}`）', () => {
    const keys = askedItems('sxk-dev', AGE).map(a => a.key);
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe('25-36.MOT.1');
    expect(keys).toContain('25-36.COG.5');
    // 其餘 21 支的面向 key 在工具內唯一，不加前綴
    expect(askedItems('sxk-gm', 72)[0].key).toBe('P1.1');
  });
});

describe('獨立率（independence）：adl 的最低分是 1 不是 0', () => {
  const AGE = 30;

  it('全部「完全由大人做」（每題 1）是 0%，不是 14%', () => {
    const r = ok(run('sxk-adl', AGE, flat('sxk-adl', AGE, 1)));
    expect(r.overall).toMatchObject({ n: 13, raw: 13, pct: 0, tier: 4 });
  });

  it('全部「完全自己做」（每題 7）是 100%', () => {
    const r = ok(run('sxk-adl', AGE, flat('sxk-adl', AGE, 7)));
    expect(r.overall).toMatchObject({ raw: 91, pct: 100, tier: 1 });
  });

  it('raw 69 → 72% → tier 1；raw 68 → 71% → tier 2', () => {
    expect(ok(run('sxk-adl', AGE, byTotal('sxk-adl', AGE, 69, 1, 7))).overall).toMatchObject({ pct: 72, tier: 1 });
    expect(ok(run('sxk-adl', AGE, byTotal('sxk-adl', AGE, 68, 1, 7))).overall).toMatchObject({ pct: 71, tier: 2 });
  });
});

describe('關切率（concern）：另記答 ≥2 的題數', () => {
  it('asb 57 題 raw 38 → 22% → tier 1；raw 39 → 23% → tier 2', () => {
    expect(askedItems('sxk-asb', 72)).toHaveLength(57);
    expect(ok(run('sxk-asb', 72, byTotal('sxk-asb', 72, 38, 0, 3))).overall).toMatchObject({ pct: 22, tier: 1 });
    expect(ok(run('sxk-asb', 72, byTotal('sxk-asb', 72, 39, 0, 3))).overall).toMatchObject({ pct: 23, tier: 2 });
  });

  it('`hi` 只數答 ≥2 的題，總分與各面向都有', () => {
    // SE 前四題給 3（＝4 題 ≥2），其餘全 0
    const r = ok(run('sxk-asb', 72, bySection('sxk-asb', 72, { SE: 12 }, 0, 3)));
    expect(r.native['hi.SE']).toBe(4);
    expect(r.native['hi.RE']).toBe(0);
    expect(r.native.hi).toBe(4);
  });

  it('六支切分不一致是規格的決定：同樣 30% 在 att 是 tier 2、在 ab 是 tier 1', () => {
    expect(tierFor('concern', TOOLKIT['sxk-att'].tiers, 30)).toBe(2);
    expect(tierFor('concern', TOOLKIT['sxk-ab'].tiers, 30)).toBe(1);
  });
});

describe('總分（total）：ldp／lds 比的是原始分，不是百分比', () => {
  const AGE = 72;

  it('總分 9 → tier 1；10 → tier 2', () => {
    expect(askedItems('sxk-ldp', AGE)).toHaveLength(30);
    expect(ok(run('sxk-ldp', AGE, byTotal('sxk-ldp', AGE, 9, 0, 3))).overall).toMatchObject({ raw: 9, tier: 1 });
    expect(ok(run('sxk-ldp', AGE, byTotal('sxk-ldp', AGE, 10, 0, 3))).overall).toMatchObject({ raw: 10, tier: 2 });
  });

  it('總分 29 → tier 3；30 → tier 4', () => {
    expect(ok(run('sxk-ldp', AGE, byTotal('sxk-ldp', AGE, 29, 0, 3))).overall.tier).toBe(3);
    expect(ok(run('sxk-ldp', AGE, byTotal('sxk-ldp', AGE, 30, 0, 3))).overall.tier).toBe(4);
  });

  it('各方面 0–18，用另一張分段表：4 → tier 1、5 → tier 2、13 → tier 4', () => {
    const r = ok(run('sxk-ldp', AGE, bySection('sxk-ldp', AGE, { read: 4, math: 5, write: 13 }, 0, 3)));
    expect(r.sections.read).toMatchObject({ raw: 4, max: 18, tier: 1 });
    expect(r.sections.math).toMatchObject({ raw: 5, tier: 2 });
    expect(r.sections.write).toMatchObject({ raw: 13, tier: 4 });
  });

  it('pct 仍然算出來（雷達圖要），但 tier 不是從它來的', () => {
    // 總分 30／90 = 33%，而 33 拿去比 10／20／30 那張表會得到 tier 4 —— 剛好一樣，
    // 所以另取一個會分歧的：總分 20／90 = 22%，比原始分是 tier 3，比 pct 會是 tier 3 也一樣。
    // 真正分得開的是總分 9：9／90 = 10%，比 pct 會得到 tier 2，比原始分才是 tier 1。
    const r = ok(run('sxk-ldp', AGE, byTotal('sxk-ldp', AGE, 9, 0, 3)));
    expect(r.overall.pct).toBe(10);
    expect(tierFor('total', TOOLKIT['sxk-ldp'].tiers, r.overall.pct)).toBe(2); // 拿 pct 去比會錯
    expect(r.overall.tier).toBe(1); // 實際用的是原始分
  });
});

describe('SNAP-IV（mean-snap）：分量表均分保留兩位、症狀計數', () => {
  const AGE = 72;

  it('IA 9 題 raw 10 → ari 1.11 → tier 1；raw 11 → 1.22 → tier 2', () => {
    const a = ok(run('snap-iv', AGE, bySection('snap-iv', AGE, { IA: 10 }, 0, 3)));
    expect(a.native['ari.IA']).toBe(1.11);
    expect(a.sections.IA.tier).toBe(1);
    const b = ok(run('snap-iv', AGE, bySection('snap-iv', AGE, { IA: 11 }, 0, 3)));
    expect(b.native['ari.IA']).toBe(1.22);
    expect(b.sections.IA.tier).toBe(2);
  });

  it('raw 16 → 1.78 → tier 2；raw 17 → 1.89 → tier 3', () => {
    expect(ok(run('snap-iv', AGE, bySection('snap-iv', AGE, { HI: 16 }, 0, 3))).sections.HI.tier).toBe(2);
    expect(ok(run('snap-iv', AGE, bySection('snap-iv', AGE, { HI: 17 }, 0, 3))).sections.HI.tier).toBe(3);
  });

  it('`sx` 是答 ≥2 的題數', () => {
    const r = ok(run('snap-iv', AGE, bySection('snap-iv', AGE, { OD: 12 }, 0, 3)));
    expect(r.native['sx.OD']).toBe(4); // 12 = 4 題 × 3
  });

  it('總分那一格是「—」：pct 與 tier 都是 null，n／raw／max 仍在', () => {
    const r = ok(run('snap-iv', AGE, flat('snap-iv', AGE, 1)));
    expect(r.overall).toMatchObject({ n: 26, raw: 26, max: 78, pct: null, tier: null });
    expect(r.native.ari).toBeUndefined();
  });
});

describe('CHEXI（mean-chexi）：副量表不判級，因素才判', () => {
  const AGE = 48;

  it('副量表只有均分，tier 是 null（紙本：本檔不套用任何自造切分值）', () => {
    const r = ok(run('chexi', AGE, flat('chexi', AGE, 3)));
    expect(r.sections.wm).toMatchObject({ n: 9, pct: null, tier: null });
    expect(r.native['mean.wm']).toBe(3);
  });

  it('F1 ＝ 工作記憶 9 ＋ 計劃力 4，raw 30 → 33% → tier 1；raw 31 → 35% → tier 2', () => {
    const a = ok(run('chexi', AGE, bySection('chexi', AGE, { wm: 21, pl: 9 }, 1, 5)));
    expect(a.sections.F1).toMatchObject({ n: 13, raw: 30, pct: 33, tier: 1 });
    const b = ok(run('chexi', AGE, bySection('chexi', AGE, { wm: 22, pl: 9 }, 1, 5)));
    expect(b.sections.F1).toMatchObject({ raw: 31, pct: 35, tier: 2 });
  });

  it('F1 raw 47 → 65% → tier 2；raw 48 → 67% → tier 3', () => {
    expect(ok(run('chexi', AGE, bySection('chexi', AGE, { wm: 38, pl: 9 }, 1, 5))).sections.F1)
      .toMatchObject({ raw: 47, pct: 65, tier: 2 });
    expect(ok(run('chexi', AGE, bySection('chexi', AGE, { wm: 39, pl: 9 }, 1, 5))).sections.F1)
      .toMatchObject({ raw: 48, pct: 67, tier: 3 });
  });

  it('F2 ＝ 抑制力 6 ＋ 調節力 5，全答 1 是 0%、全答 5 是 100%', () => {
    expect(ok(run('chexi', AGE, flat('chexi', AGE, 1))).sections.F2).toMatchObject({ n: 11, pct: 0, tier: 1 });
    expect(ok(run('chexi', AGE, flat('chexi', AGE, 5))).sections.F2).toMatchObject({ pct: 100, tier: 3 });
  });

  it('總分那一格是「—」', () => {
    const r = ok(run('chexi', AGE, flat('chexi', AGE, 3)));
    expect(r.overall).toMatchObject({ n: 24, pct: null, tier: null });
  });
});

describe('M-CHAT-R/F（risk）：題 2、5、12 反向', () => {
  const AGE = 24;

  function mchatAnswers(riskCount: number) {
    const out: Record<string, AnswerValue> = {};
    askedItems('mchat-rf', AGE).forEach((a, i) => {
      const risky = a.item.riskAnswer ?? 'no';
      out[a.key] = i < riskCount ? risky : (risky === 'yes' ? 'no' : 'yes');
    });
    return out;
  }

  it('風險 2 → tier 1；3 → tier 2；7 → tier 2；8 → tier 3', () => {
    expect(ok(run('mchat-rf', AGE, mchatAnswers(2))).overall.tier).toBe(1);
    expect(ok(run('mchat-rf', AGE, mchatAnswers(3))).overall.tier).toBe(2);
    expect(ok(run('mchat-rf', AGE, mchatAnswers(7))).overall.tier).toBe(2);
    expect(ok(run('mchat-rf', AGE, mchatAnswers(8))).overall.tier).toBe(3);
  });

  it('反向題讀題庫自己的 riskAnswer：2、5、12 是答「是」算風險', () => {
    const items = askedItems('mchat-rf', AGE);
    expect(items).toHaveLength(20);
    const yesIsRisk = items.filter(a => a.item.riskAnswer === 'yes').map(a => a.item.no);
    expect(yesIsRisk).toEqual([2, 5, 12]);
  });

  it('`riskItems` 記的是題號', () => {
    const r = ok(run('mchat-rf', AGE, mchatAnswers(3)));
    expect(r.native.riskItems).toEqual([1, 2, 3]);
    expect(r.native.risk).toBe(3);
  });

  it('全部答安全的那一邊 → 0 題風險、tier 1', () => {
    const r = ok(run('mchat-rf', AGE, mchatAnswers(0)));
    expect(r.native.riskItems).toEqual([]);
    expect(r.overall.tier).toBe(1);
  });
});

describe('預警徵象（positive）：陽性索引，以及唯一一支前置題會動到 tier 的工具', () => {
  const AGE = 25; // m24 那個時點

  function warnAnswers(positives: number) {
    const out: Record<string, AnswerValue> = {};
    askedItems('sxk-warn', AGE).forEach((a, i) => {
      out[a.key] = i < positives ? 1 : 0;
    });
    return out;
  }

  it('取 ≤ 月齡的最大時點，一次 4 條', () => {
    const asked = askedItems('sxk-warn', AGE);
    expect(asked).toHaveLength(4);
    expect(asked.every(a => a.sectionKey === 'm24')).toBe(true);
  });

  it('0 陽性且無倒退 → tier 1；任一陽性 → tier 3', () => {
    expect(ok(run('sxk-warn', AGE, warnAnswers(0))).overall.tier).toBe(1);
    expect(ok(run('sxk-warn', AGE, warnAnswers(1))).overall.tier).toBe(3);
  });

  it('`positives` 是該時點內的第幾條（1 起）—— §5.9 的維度對應按位置給', () => {
    const r = ok(run('sxk-warn', AGE, warnAnswers(2)));
    expect(r.native.positives).toEqual([1, 2]);
    expect(r.native.count).toBe(2);
  });

  it('0 陽性但勾了倒退 → tier 3（§5.3「任一陽性或任一倒退」），分數本身不動', () => {
    const r = ok(run('sxk-warn', AGE, warnAnswers(0), { regression: ['language'] }));
    expect(r.overall.tier).toBe(3);
    expect(r.overall.raw).toBe(0);
    expect(r.native.positives).toEqual([]);
    expect(r.pre.regression).toEqual(['language']);
  });

  it('倒退勾成空陣列不算勾', () => {
    expect(ok(run('sxk-warn', AGE, warnAnswers(0), { regression: [] })).overall.tier).toBe(1);
  });
});

describe('氣質（profile）：dev ＝ 均分 − 2.5', () => {
  const AGE = 24;

  it('八題全 3 → 均分 3、dev 0.5 → tier 2（稍偏）', () => {
    const r = ok(run('sxk-tempa', AGE, bySection('sxk-tempa', AGE, { D1: 24 }, 0, 5)));
    expect(r.native['mean.D1']).toBe(3);
    expect(r.native['dev.D1']).toBe(0.5);
    expect(r.sections.D1.tier).toBe(2);
  });

  it('raw 23 → dev 0.375 → tier 1（兩端之間）', () => {
    const r = ok(run('sxk-tempa', AGE, bySection('sxk-tempa', AGE, { D2: 23 }, 0, 5)));
    expect(r.native['dev.D2']).toBe(0.375);
    expect(r.sections.D2.tier).toBe(1);
  });

  it('raw 28 → dev 剛好 1.0 → tier 3（明顯偏向），浮點數不會掉到 0.9999', () => {
    const r = ok(run('sxk-tempa', AGE, bySection('sxk-tempa', AGE, { D3: 28 }, 0, 5)));
    expect(r.native['dev.D3']).toBe(1);
    expect(r.sections.D3.tier).toBe(3);
  });

  it('另一側同樣看絕對值：raw 12 → dev −1.0 → tier 3', () => {
    const r = ok(run('sxk-tempa', AGE, bySection('sxk-tempa', AGE, { D7: 12 }, 0, 5)));
    expect(r.native['dev.D7']).toBe(-1);
    expect(r.sections.D7.tier).toBe(3);
  });

  it('總分那一格是「—」', () => {
    const r = ok(run('sxk-tempa', AGE, flat('sxk-tempa', AGE, 3)));
    expect(r.overall).toMatchObject({ n: 72, pct: null, tier: null });
  });
});

// ---------------------------------------------------------------------------
// 四、出題規則（§5.1）
// ---------------------------------------------------------------------------

describe('起始月齡：只出 m ≤ 測評月齡的題', () => {
  it('24 個月的孩子在 sxk-lang 只計 23 題，滿分依 23 題算', () => {
    const asked = askedItems('sxk-lang', 24);
    expect(asked).toHaveLength(23);
    const r = ok(run('sxk-lang', 24, flat('sxk-lang', 24, 2)));
    expect(r.askedCount).toBe(23);
    expect(r.answeredCount).toBe(23);
    expect(r.overall).toMatchObject({ n: 23, raw: 46, max: 46, pct: 100 });
  });

  it('72 個月的同一支是 60 題 —— 未到年齡的題不出、也不計滿分', () => {
    const r = ok(run('sxk-lang', 72, flat('sxk-lang', 72, 2)));
    expect(r.askedCount).toBe(60);
    expect(r.overall.max).toBe(120);
  });

  it('sxk-dev 只出所屬年齡段 30 題', () => {
    expect(askedItems('sxk-dev', 30)).toHaveLength(30);
    expect(askedItems('sxk-dev', 3)).toHaveLength(30);
  });
});

describe('月齡窗口：窗口外拒算', () => {
  it('sxk-voc 在 43 個月拒算（窗口 12–42）', () => {
    const out = refused(run('sxk-voc', 43, {}));
    expect(out.reason).toBe('age_out_of_window');
    if (out.reason === 'age_out_of_window') {
      expect(out.windowMonths).toEqual({ lo: 12, hi: 42 });
      expect(out.assessedAgeMonth).toBe(43);
    }
  });

  it('sxk-asr 在 23 個月拒算（窗口 24–180）', () => {
    expect(refused(run('sxk-asr', 23, {})).reason).toBe('age_out_of_window');
  });

  it('窗口邊界是閉區間：42 算得出、24 算得出', () => {
    expect(run('sxk-voc', 42, flat('sxk-voc', 42, 2)).ok).toBe(true);
    expect(run('sxk-asr', 24, flat('sxk-asr', 24, 0)).ok).toBe(true);
  });

  /**
   * 22 支裡只有 sxk-warn 有這個洞：登錄表照 §3 寫 3–84，但工具包自己說「未满 7 周岁」，
   * 最後一個時點 m72 只管到 83。零題不能回一筆看起來正常的結果。
   * （勘誤檔 D1；規格改版時窗口改 3–83，屆時這條會退化成 age_out_of_window。）
   */
  it('sxk-warn 在整整 84 個月一題都出不了 → 拒算，不回空結果', () => {
    expect(askedItems('sxk-warn', 84)).toHaveLength(0);
    const out = refused(run('sxk-warn', 84, {}));
    expect(out.reason).toBe('no_items_at_age');
    if (out.reason === 'no_items_at_age') expect(out.windowMonths).toEqual({ lo: 3, hi: 84 });
    expect(run('sxk-warn', 83, flat('sxk-warn', 83, 0)).ok).toBe(true);
  });

  it('其餘 21 支在窗口內每一個月齡都出得了題', () => {
    const holes: string[] = [];
    for (const id of Object.keys(TOOL_SPECS) as ToolId[]) {
      const { lo, hi } = TOOL_SPECS[id].windowMonths;
      for (let m = lo; m <= hi; m++) if (askedItems(id, m).length === 0) holes.push(`${id}@${m}`);
    }
    expect(holes).toEqual(['sxk-warn@84']);
  });
});

describe('完整性：缺答拒算，不以 0 補', () => {
  it('面向型少答一題 → incomplete，不產生 pct', () => {
    const answers = flat('sxk-gm', 72, 2);
    delete answers['P1.1'];
    const out = refused(run('sxk-gm', 72, answers));
    expect(out.reason).toBe('incomplete');
    if (out.reason === 'incomplete') {
      expect(out.missing).toEqual(['P1.1']);
      expect(out.askedCount).toBe(40);
      expect(out.answeredCount).toBe(39);
    }
    expect('result' in out).toBe(false);
  });

  it('dev 的「不評」不是缺答', () => {
    const r = ok(run('sxk-dev', 30, flat('sxk-dev', 30, 'skip')));
    expect(r.askedCount).toBe(30);
    expect(r.answeredCount).toBe(30);
    expect(r.overall).toMatchObject({ n: 0, pct: null, tier: null });
  });

  it('一題都沒答 → 全部列在 missing', () => {
    const out = refused(run('sxk-gm', 72, {}));
    if (out.reason === 'incomplete') expect(out.missing).toHaveLength(40);
  });
});

describe('值域：不在 §3.1 值域內的答案拒算', () => {
  it('0–2 的題收到 5 → invalid_answer，不會算出超過 100% 的達成率', () => {
    const answers = flat('sxk-gm', 72, 2);
    answers['P1.1'] = 5;
    const out = refused(run('sxk-gm', 72, answers));
    expect(out.reason).toBe('invalid_answer');
    if (out.reason === 'invalid_answer') expect(out.invalid).toEqual([{ key: 'P1.1', value: 5 }]);
  });

  it('dev 收到數字（而不是 pass／fail／skip）也擋下來', () => {
    const answers = flat('sxk-dev', 30, 'pass');
    answers['25-36.MOT.1'] = 1;
    expect(refused(run('sxk-dev', 30, answers)).reason).toBe('invalid_answer');
  });
});

// ---------------------------------------------------------------------------
// 五、scored：題數不足時算得出、不判讀
// ---------------------------------------------------------------------------

describe('scored：適用題數低於該族最少題數', () => {
  it('達成率族最少 3 題、獨立率族 2 題、其餘 1 題', () => {
    expect(TOOL_SPECS['sxk-adp'].minItems).toBe(3);
    expect(TOOL_SPECS['sxk-adl'].minItems).toBe(2);
    expect(TOOL_SPECS['sxk-asb'].minItems).toBe(1);
  });

  it('達成率族某面向只有 2 題 → scored false，但 pct 仍算得出來', () => {
    // 18 個月的 sxk-adp：A4 剩 2 題、A5 剩 1 題
    const r = ok(run('sxk-adp', 18, flat('sxk-adp', 18, 1)));
    expect(r.sections.A4).toMatchObject({ n: 2, raw: 2, max: 4, pct: 50, scored: false });
    expect(r.sections.A4.tier).toBe(4);
    expect(r.sections.A5).toMatchObject({ n: 1, pct: 50, scored: false });
    expect(r.sections.A3).toMatchObject({ n: 3, scored: true });
  });

  it('獨立率族 1 題同理（真實題庫在窗口內最少是 2 題，所以直接測規則）', () => {
    expect(isScored('sxk-adl', 1)).toBe(false);
    expect(isScored('sxk-adl', 2)).toBe(true);
    // 括約肌領域剛好踩在 2 上
    expect(ok(run('sxk-adl', 30, flat('sxk-adl', 30, 4))).sections.SP).toMatchObject({ n: 2, scored: true });
  });

  it('一題都沒出的面向：n 0、pct null、tier null、scored false', () => {
    // 12 個月的 sxk-voc：V3 一題都還沒到
    const r = ok(run('sxk-voc', 12, flat('sxk-voc', 12, 2)));
    expect(r.sections.V3).toMatchObject({ n: 0, raw: 0, max: 0, pct: null, tier: null, scored: false });
    expect(r.sections.V1).toMatchObject({ n: 3, scored: true });
    expect(r.sections.V2).toMatchObject({ n: 1, scored: false });
  });
});

// ---------------------------------------------------------------------------
// 六、前置題
// ---------------------------------------------------------------------------

describe('前置題：原樣進 pre', () => {
  it('答案原樣存下來', () => {
    const pre = { regression: 'language' };
    const r = ok(run('sxk-asb', 72, flat('sxk-asb', 72, 1), pre));
    expect(r.pre).toEqual(pre);
  });

  it('不影響任何分數 —— 有沒有前置題，分數一模一樣', () => {
    const answers = flat('sxk-asb', 72, 1);
    const withPre = ok(run('sxk-asb', 72, answers, { regression: 'social' }));
    const without = ok(run('sxk-asb', 72, answers));
    expect(withPre.overall).toEqual(without.overall);
    expect(withPre.sections).toEqual(without.sections);
    expect(withPre.native).toEqual(without.native);
  });

  it('倒退直接 refer 是 band 的事（#47），這一層不動 asb 的 tier', () => {
    const answers = flat('sxk-asb', 72, 0);
    expect(ok(run('sxk-asb', 72, answers, { regression: 'language' })).overall.tier).toBe(1);
  });

  it('沒給 pre 時是空物件，不是 undefined', () => {
    expect(ok(run('sxk-asb', 72, flat('sxk-asb', 72, 0))).pre).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 七、ToolResult 的外框
// ---------------------------------------------------------------------------

describe('ToolResult 的外框（§5.8）', () => {
  it('版本、月齡、填表人、時間都寫進去', () => {
    const r = ok(run('sxk-gm', 72, flat('sxk-gm', 72, 2)));
    expect(r).toMatchObject({
      toolId: 'sxk-gm',
      toolkitVersion: 'kit-20260908',
      assessedAgeMonth: 72,
      rater: 'mother',
      computedAt: AT,
    });
  });

  it('answers 原樣留著（報告要做作答回顧）', () => {
    const answers = flat('sxk-gm', 72, 1);
    expect(ok(run('sxk-gm', 72, answers)).answers).toEqual(answers);
  });

  it('22 支在自己窗口的中點都算得出一筆完整結果', () => {
    for (const id of Object.keys(TOOL_SPECS) as ToolId[]) {
      const { lo, hi } = TOOL_SPECS[id].windowMonths;
      const age = Math.floor((lo + hi) / 2);
      const bank = TOOLKIT[id];
      const answers: Record<string, AnswerValue> = {};
      for (const a of askedItems(id, age)) answers[a.key] = bank.options[0].value;
      const outcome = run(id, age, answers);
      expect(`${id}@${age} → ${outcome.ok ? 'ok' : outcome.reason}`).toBe(`${id}@${age} → ok`);
    }
  });
});
