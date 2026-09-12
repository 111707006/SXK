import { describe, it, expect } from 'vitest';
import type { ToolId } from '../src/t2/toolkit';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, DimensionFinding, T1Flag, ToolResult } from '../src/t2/types';
import { RULES_VERSION, askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { planT2 } from '../src/t2/routing';
import { ruleFor } from '../src/t2/rules';
import {
  MAX_TAGS_PER_DIMENSION,
  T2_FINDINGS_VERSION,
  aggregateDimensions,
  buildT2Findings,
  isCompleteResult,
  latestCompleteResults,
} from '../src/t2/findings';

/**
 * 維度彙整與 `T2Findings`（#52，規格 v2 §5.7、§5.8）。
 *
 * 【這裡在防什麼】
 * 1. **四種「沒有判定」不能塌成 `clear`**：星號沒做完是 `partial`、黃的沒做選做是 `not_assessed`、
 *    這個月齡沒有工具是 `no_tool`。塌成 `clear` 就是「沒做完」被讀成「沒事」，而報告層看不出差別。
 * 2. **`band = max`**：一支說沒事一支說要關注 → 要關注。漏掉後者比多看一次糟。
 * 3. **`drivenBy` 要對**：家長會問「哪一份說的」。同 band 取先做完的。
 * 4. **每支只取最新且完整的一筆**：較新的那筆沒做完 → 用較舊完整的，不是用較新的、也不是沒有。
 *
 * 【固定輸入】
 * §4.4／§11 的例子：48 個月、LANG 紅、ATT 紅、SEN 黃；做完 sxk-lang 與 sxk-ab、沒做 spa。
 * 作答是真的湊出來的（走 `scoreTool`），不是把 pct 換掉：lang 的 RC 92／EX 71／AR 82／PR 86、
 * 總 83（票寫 90／70／80／85，49 題湊不到整十，落點的 tier 相同）；ab 的總關切率剛好 45。
 */

/** 第 n 分鐘。完成順序全靠它，測試裡不用真實時間。 */
function at(minute: number): string {
  return `2026-09-12T00:${String(minute).padStart(2, '0')}:00.000Z`;
}

function score(
  toolId: ToolId,
  ageMonth: number,
  answers: Record<string, AnswerValue>,
  opts: { pre?: Record<string, string | string[] | boolean>; computedAt?: string } = {},
): ToolResult {
  const outcome = scoreTool({
    toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, pre: opts.pre, computedAt: opts.computedAt ?? at(0),
  });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 全部答同一個值。 */
function flat(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

/**
 * 依「各面向 raw」造一份作答：每個面向前面的題給 `perItemMax`、最後一題給餘數、其餘 0。
 * 沒指定的面向全給 `perItemMax`（達成率族＝全會、關切率族＝全部很常）。放不進去就讓測試自己壞掉。
 */
function bySection(
  toolId: ToolId,
  ageMonth: number,
  perItemMax: number,
  raws: Record<string, number>,
  fallback: number = perItemMax,
): Record<string, AnswerValue> {
  const grouped: Record<string, string[]> = {};
  for (const a of askedItems(toolId, ageMonth)) (grouped[a.sectionKey] ??= []).push(a.key);
  const out: Record<string, AnswerValue> = {};
  for (const [sectionKey, keys] of Object.entries(grouped)) {
    if (raws[sectionKey] === undefined) {
      for (const k of keys) out[k] = fallback;
      continue;
    }
    let left = raws[sectionKey];
    if (left < 0 || left > perItemMax * keys.length) throw new Error(`raw ${left} 放不進 ${toolId} ${sectionKey}`);
    for (const k of keys) {
      const v = Math.min(perItemMax, left);
      out[k] = v;
      left -= v;
    }
  }
  return out;
}

/** 氣質一份作答：指定向度給 raw（八題各 0–5），其餘 raw 20（均分 2.5、dev 0，兩端之間）。 */
function tempAnswers(toolId: ToolId, ageMonth: number, raws: Record<string, number>): Record<string, AnswerValue> {
  const all: Record<string, number> = {};
  for (const a of askedItems(toolId, ageMonth)) all[a.sectionKey] = raws[a.sectionKey] ?? 20;
  return bySection(toolId, ageMonth, 5, all);
}

/** sxk-dev 一份作答：指定領域給「通過幾題」，其餘全通過。 */
function devAnswers(ageMonth: number, passes: Record<string, number>): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  const seen: Record<string, number> = {};
  for (const a of askedItems('sxk-dev', ageMonth)) {
    const n = (seen[a.sectionKey] = (seen[a.sectionKey] ?? 0) + 1);
    const pass = passes[a.sectionKey] ?? 5;
    out[a.key] = n <= pass ? 'pass' : 'fail';
  }
  return out;
}

/** 九個維度的 T1 標記，沒指定的是綠。 */
function flags(partial: Partial<Record<DimensionCode, T1Flag>>): Record<DimensionCode, T1Flag> {
  const out = {} as Record<DimensionCode, T1Flag>;
  for (const d of DIMENSION_CODES) out[d] = partial[d] ?? 0;
  return out;
}

function byId(findings: ReadonlyArray<DimensionFinding>): Record<DimensionCode, DimensionFinding> {
  const out = {} as Record<DimensionCode, DimensionFinding>;
  for (const f of findings) out[f.dimensionId] = f;
  return out;
}

/** 把一筆完整的結果改成「舊紀錄裡沒做完的那種」：`answeredCount < askedCount`。 */
function incomplete(r: ToolResult, missing = 1): ToolResult {
  return { ...r, answeredCount: r.askedCount - missing };
}

const FIXED_AGE = 48;
const FIXED_FLAGS = flags({ LANG: 2, ATT: 2, SEN: 1 });

/** lang@48：RC 24／26＝92、EX 20／28＝71、AR 18／22＝82、PR 19／22＝86；總 81／98＝83 → watch。 */
function langWatch(computedAt = at(1)): ToolResult {
  return score('sxk-lang', FIXED_AGE, bySection('sxk-lang', FIXED_AGE, 2, { RC: 24, EX: 20, AR: 18, PR: 19 }), { computedAt });
}

/** ab@48：SU 21＋DI 18＋IM 16＝55／123＝45 → tier 3 refer；OD 全 0，不餵 EMO 任何標籤。兩個場合，不出 `single_setting`。 */
function abRefer(computedAt = at(2)): ToolResult {
  return score(
    'sxk-ab',
    FIXED_AGE,
    bySection('sxk-ab', FIXED_AGE, 3, { SU: 21, DI: 18, IM: 16, HY: 0, EF: 0, OD: 0 }),
    { pre: { settings: ['home', 'school'] }, computedAt },
  );
}

function langClear(computedAt = at(1)): ToolResult {
  return score('sxk-lang', FIXED_AGE, flat('sxk-lang', FIXED_AGE, 2), { computedAt });
}

// ---------------------------------------------------------------------------
// 一、固定輸入（§4.4、§11 階段 3）
// ---------------------------------------------------------------------------

describe('固定輸入：48 個月、LANG 紅、ATT 紅、SEN 黃；做完 lang 與 ab、沒做 spa', () => {
  const lang = langWatch();
  const ab = abRefer();
  const findings = aggregateDimensions([lang, ab], FIXED_FLAGS, FIXED_AGE);
  const f = byId(findings);

  it('先確認作答真的落在要測的區間', () => {
    expect([lang.sections.RC.pct, lang.sections.EX.pct, lang.sections.AR.pct, lang.sections.PR.pct]).toEqual([92, 71, 82, 86]);
    expect(lang.overall.pct).toBe(83);
    expect(ab.overall.pct).toBe(45);
    expect(ab.sections.OD.tier).toBe(1);
  });

  it('九個維度都在，順序照 DIMENSION_CODES', () => {
    expect(findings.map(x => x.dimensionId)).toEqual([...DIMENSION_CODES]);
  });

  it('LANG watch，drivenBy lang，標籤含 expression 與 expression_below_comprehension', () => {
    expect(f.LANG).toEqual({
      dimensionId: 'LANG',
      band: 'watch',
      drivenBy: 'sxk-lang',
      tags: ['lang.expression', 'lang.articulation', 'lang.expression_below_comprehension'],
      caveats: ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
      tools: ['sxk-lang'],
      t1Flag: 2,
    });
  });

  it('ATT refer，drivenBy ab', () => {
    expect(f.ATT).toEqual({
      dimensionId: 'ATT',
      band: 'refer',
      drivenBy: 'sxk-ab',
      tags: ['att.inattention', 'att.impulsivity'],
      caveats: ['parent_report', 'unsourced_threshold'],
      tools: ['sxk-ab'],
      t1Flag: 2,
    });
  });

  it('SEN 黃、沒做選做 → not_assessed，不是 clear', () => {
    expect(f.SEN).toEqual({
      dimensionId: 'SEN', band: 'not_assessed', drivenBy: null, tags: [], caveats: [], tools: [], t1Flag: 1,
    });
  });

  it('其餘六維 clear、tools 空、drivenBy null', () => {
    for (const d of ['COG', 'SOC', 'EMO', 'MOT', 'ADL', 'LEARN'] as const) {
      expect(f[d]).toEqual({ dimensionId: d, band: 'clear', drivenBy: null, tags: [], caveats: [], tools: [], t1Flag: 0 });
    }
  });

  it('標籤與 caveats 就是規則表吐的，彙整沒有自己多判一次', () => {
    expect(f.LANG.tags).toEqual(ruleFor('sxk-lang').tags(lang));
    expect(f.LANG.caveats).toEqual(ruleFor('sxk-lang').caveats(lang));
    expect(f.ATT.tags).toEqual(ruleFor('sxk-ab').tags(ab));
  });
});

// ---------------------------------------------------------------------------
// 二、四種非 band 值（§5.7）
// ---------------------------------------------------------------------------

describe('partial：紅的星號沒做完', () => {
  it('sxk-lang 只有沒做完的一筆 → partial；那一筆不算做過', () => {
    const f = byId(aggregateDimensions([incomplete(langWatch(), 3)], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG).toEqual({
      dimensionId: 'LANG', band: 'partial', drivenBy: null, tags: [], caveats: [], tools: [], t1Flag: 2,
    });
  });

  it('沒有任何結果 → 同樣 partial', () => {
    const f = byId(aggregateDimensions([], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.band).toBe('partial');
    expect(f.LANG.drivenBy).toBeNull();
  });

  it('星號沒做、加測做了 → 仍是 partial，但加測的標籤與工具照收（不用它代表整個維度）', () => {
    // 48 個月 LANG 的星號是 sxk-lang，sxk-dev 是加測；dev 的語言領域 3／5 → refer
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 3 }), { computedAt: at(1) });
    const f = byId(aggregateDimensions([dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.band).toBe('partial');
    expect(f.LANG.drivenBy).toBeNull();
    expect(f.LANG.tools).toEqual(['sxk-dev']);
    expect(f.LANG.tags).toEqual(['lang.comprehension', 'lang.expression']);
    expect(f.LANG.caveats).toContain('few_items');
  });

  it('星號做了、但對這個維度算不出 band（dev 語言領域全「不評」）→ partial，不是 clear', () => {
    // 6 個月 LANG 的星號是 sxk-dev（lang／voc 12 個月起）
    const age = 6;
    const answers = flat('sxk-dev', age, 'pass');
    for (const a of askedItems('sxk-dev', age)) if (a.sectionKey === 'LANG') answers[a.key] = 'skip';
    const dev = score('sxk-dev', age, answers);
    expect(dev.sections.LANG.pct).toBeNull();
    const f = byId(aggregateDimensions([dev], flags({ LANG: 2 }), age));
    expect(f.LANG.band).toBe('partial');
    expect(f.LANG.tools).toEqual(['sxk-dev']);
  });
});

describe('not_assessed：黃的沒做選做', () => {
  it('SEN 黃、什麼都沒做 → not_assessed', () => {
    const f = byId(aggregateDimensions([], flags({ SEN: 1 }), FIXED_AGE));
    expect(f.SEN.band).toBe('not_assessed');
  });

  it('SEN 黃、做了選做 → 照工具的 band', () => {
    const spa = score('sxk-spa', FIXED_AGE, flat('sxk-spa', FIXED_AGE, 0), { pre: { impact: ['none'] } });
    const f = byId(aggregateDimensions([spa], flags({ SEN: 1 }), FIXED_AGE));
    expect(f.SEN.band).toBe('clear');
    expect(f.SEN.drivenBy).toBe('sxk-spa');
    expect(f.SEN.tools).toEqual(['sxk-spa']);
    expect(f.SEN.caveats).toContain('no_functional_impact');
  });
});

describe('no_tool：這個月齡沒有任何會出 band 的工具', () => {
  it('80 個月、LANG 紅 → no_tool；與 planT2 的 noTool 一致', () => {
    const t1 = flags({ LANG: 2 });
    const findings = aggregateDimensions([], t1, 80);
    const f = byId(findings);
    expect(f.LANG).toEqual({
      dimensionId: 'LANG', band: 'no_tool', drivenBy: null, tags: [], caveats: [], tools: [], t1Flag: 2,
    });
    expect(findings.filter(x => x.band === 'no_tool').map(x => x.dimensionId)).toEqual(planT2(t1, 80).noTool);
  });

  it('黃的也一樣是 no_tool，不是 not_assessed（§4.5 的判斷在前）', () => {
    const f = byId(aggregateDimensions([], flags({ EMO: 1 }), FIXED_AGE));
    expect(planT2(flags({ EMO: 1 }), FIXED_AGE).noTool).toEqual(['EMO']);
    expect(f.EMO.band).toBe('no_tool');
  });

  it('掃全部月齡：紅的維度的 band 是 no_tool ⟺ planT2 說 noTool', () => {
    for (let m = 0; m <= 216; m += 6) {
      for (const d of DIMENSION_CODES) {
        const t1 = flags({ [d]: 2 });
        const expected = planT2(t1, m).noTool.includes(d) ? 'no_tool' : 'partial';
        expect(`${d}@${m}: ${byId(aggregateDimensions([], t1, m))[d].band}`).toBe(`${d}@${m}: ${expected}`);
      }
    }
  });
});

describe('T1 綠', () => {
  it('什麼都沒做 → clear、tools 空', () => {
    const f = byId(aggregateDimensions([], flags({}), FIXED_AGE));
    for (const d of DIMENSION_CODES) expect(f[d]).toMatchObject({ band: 'clear', drivenBy: null, tools: [] });
  });

  it('只出標籤的工具：EMO 綠、tempa D3 偏 → EMO clear、tags 含 slow_to_warm、tools 含 tempa、drivenBy null', () => {
    const tempa = score('sxk-tempa', 24, tempAnswers('sxk-tempa', 24, { D3: 28 }), { computedAt: at(1) });
    expect(tempa.native['dev.D3']).toBe(1);
    expect(tempa.native['dev.D1']).toBe(0);
    const f = byId(aggregateDimensions([tempa], flags({}), 24));
    expect(f.EMO).toEqual({
      dimensionId: 'EMO',
      band: 'clear',
      drivenBy: null,
      tags: ['emo.slow_to_warm'],
      caveats: ['parent_report', 'unsourced_threshold'],
      tools: ['sxk-tempa'],
      t1Flag: 0,
    });
  });

  it('氣質的標籤照前綴落格：D7 堅持度偏低 → learn.task_persistence 進 LEARN，不進 EMO', () => {
    const tempa = score('sxk-tempa', 24, tempAnswers('sxk-tempa', 24, { D7: 12 }), { computedAt: at(1) });
    expect(tempa.native['dev.D7']).toBe(-1);
    const f = byId(aggregateDimensions([tempa], flags({}), 24));
    expect(f.LEARN).toMatchObject({ band: 'clear', drivenBy: null, tags: ['learn.task_persistence'], tools: ['sxk-tempa'] });
    expect(f.EMO).toMatchObject({ band: 'clear', drivenBy: null, tags: [], tools: ['sxk-tempa'] });
  });

  it('做了會出 band 的工具、餵到綠的維度 → 照工具的 band，不塌成 clear（漏掉比多看一次糟）', () => {
    // 為 LANG 做的 sxk-dev 也餵 MOT／SOC／ADL／COG；SOC 領域 2／5 → 40 → tier 4
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { SOC: 2 }), { computedAt: at(1) });
    const f = byId(aggregateDimensions([langClear(), dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.SOC).toMatchObject({ band: 'refer', drivenBy: 'sxk-dev', tools: ['sxk-dev'], t1Flag: 0 });
    expect(f.SOC.tags).toEqual(['severity.severe', 'soc.social_initiation']);
    expect(f.SOC.caveats).toContain('few_items');
    expect(f.MOT).toMatchObject({ band: 'clear', drivenBy: 'sxk-dev', tools: ['sxk-dev'], tags: [] });
  });
});

// ---------------------------------------------------------------------------
// 三、max 與 drivenBy（§5.7）
// ---------------------------------------------------------------------------

describe('band = max，drivenBy 記哪一支', () => {
  it('一支 clear 一支 refer → refer，drivenBy 是 refer 那支（不管誰先做完）', () => {
    const lang = langClear(at(1));
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 3 }), { computedAt: at(2) });
    const f = byId(aggregateDimensions([lang, dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG).toMatchObject({ band: 'refer', drivenBy: 'sxk-dev', tools: ['sxk-lang', 'sxk-dev'] });

    const g = byId(aggregateDimensions([langClear(at(2)), { ...dev, computedAt: at(1) }], flags({ LANG: 2 }), FIXED_AGE));
    expect(g.LANG).toMatchObject({ band: 'refer', drivenBy: 'sxk-dev', tools: ['sxk-dev', 'sxk-lang'] });
  });

  it('兩支同 watch → drivenBy 取先做完的；輸入順序不算數', () => {
    const lang = langWatch(at(2));
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 4 }), { computedAt: at(1) });
    expect(dev.sections.LANG.tier).toBe(2);
    const f = byId(aggregateDimensions([lang, dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.band).toBe('watch');
    expect(f.LANG.drivenBy).toBe('sxk-dev');
    expect(f.LANG.tools).toEqual(['sxk-dev', 'sxk-lang']);

    const g = byId(aggregateDimensions([{ ...lang, computedAt: at(1) }, { ...dev, computedAt: at(2) }], flags({ LANG: 2 }), FIXED_AGE));
    expect(g.LANG.drivenBy).toBe('sxk-lang');
    expect(g.LANG.tools).toEqual(['sxk-lang', 'sxk-dev']);
  });

  it('watch 與 refer 各一，refer 較晚做完 → 仍是 refer 那支', () => {
    const lang = langWatch(at(1));
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 3 }), { computedAt: at(2) });
    const f = byId(aggregateDimensions([lang, dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG).toMatchObject({ band: 'refer', drivenBy: 'sxk-dev' });
  });

  it('同一支工具的 band 只落在它餵的維度；標籤照前綴落格（ab 的 OD → emo.regulation 進 EMO，不進 ATT）', () => {
    const ab = score(
      'sxk-ab', FIXED_AGE,
      bySection('sxk-ab', FIXED_AGE, 3, { SU: 0, DI: 0, IM: 0, HY: 0, EF: 0, OD: 24 }),
      { pre: { settings: ['home', 'school'] }, computedAt: at(1) },
    );
    expect(ab.overall.pct).toBe(20);
    const f = byId(aggregateDimensions([ab], flags({ ATT: 2 }), FIXED_AGE));
    expect(f.ATT).toMatchObject({ band: 'clear', drivenBy: 'sxk-ab', tags: [], tools: ['sxk-ab'] });
    expect(f.EMO).toMatchObject({ band: 'clear', drivenBy: null, tags: ['emo.regulation'], tools: ['sxk-ab'] });
    expect(f.EMO.caveats).toEqual(f.ATT.caveats);
  });
});

// ---------------------------------------------------------------------------
// 四、標籤聯集：去重、保序、≤10、severe 落對格
// ---------------------------------------------------------------------------

describe('標籤聯集', () => {
  it('去重且 drivenBy 的排前面', () => {
    const lang = langWatch(at(2));                                                    // expression、articulation、gap
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 4 }), { computedAt: at(1) }); // comprehension、expression
    const f = byId(aggregateDimensions([lang, dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.drivenBy).toBe('sxk-dev');
    expect(f.LANG.tags).toEqual(['lang.comprehension', 'lang.expression', 'lang.articulation', 'lang.expression_below_comprehension']);

    const g = byId(aggregateDimensions([{ ...lang, computedAt: at(1) }, { ...dev, computedAt: at(2) }], flags({ LANG: 2 }), FIXED_AGE));
    expect(g.LANG.drivenBy).toBe('sxk-lang');
    expect(g.LANG.tags).toEqual(['lang.expression', 'lang.articulation', 'lang.expression_below_comprehension', 'lang.comprehension']);
  });

  it('drivenBy 較晚做完時，它的標籤仍排前面（不是單純的完成順序）', () => {
    // lang refer（RC 100、EX 36、AR 55、PR 86；總 68）較晚；dev watch 較早
    const lang = score('sxk-lang', FIXED_AGE, bySection('sxk-lang', FIXED_AGE, 2, { RC: 26, EX: 10, AR: 12, PR: 19 }), { computedAt: at(2) });
    expect(lang.overall.pct).toBe(68);
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 4 }), { computedAt: at(1) });
    const f = byId(aggregateDimensions([dev, lang], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.band).toBe('refer');
    expect(f.LANG.drivenBy).toBe('sxk-lang');
    expect(f.LANG.tools).toEqual(['sxk-dev', 'sxk-lang']);
    expect(f.LANG.tags).toEqual(['lang.expression', 'lang.articulation', 'lang.expression_below_comprehension', 'lang.comprehension']);
    expect(f.LANG.caveats).toEqual(['parent_report', 'unsourced_threshold', 'parent_administered_task', 'hearing_check_first', 'few_items']);
  });

  it('caveats 聯集：去重、drivenBy 的排前面', () => {
    const lang = langWatch(at(2));
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { LANG: 4 }), { computedAt: at(1) });
    const f = byId(aggregateDimensions([lang, dev], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG.caveats).toEqual(['parent_report', 'unsourced_threshold', 'parent_administered_task', 'few_items']);
  });

  it(`每維度 ≤ ${MAX_TAGS_PER_DIMENSION}；severity.severe 排最前、不會被截掉`, () => {
    // spa 全 3：七個系統各 tier 4 → 七個標籤；影響參與三項 → 三個；總 tier 4 → severe。共 11。
    // tempb D9 反應閾偏 → sen.threshold_low，第 12 個。
    const spa = score('sxk-spa', FIXED_AGE, flat('sxk-spa', FIXED_AGE, 3), { pre: { impact: ['adl', 'group', 'play'] }, computedAt: at(1) });
    const tempb = score('sxk-tempb', FIXED_AGE, tempAnswers('sxk-tempb', FIXED_AGE, { D9: 28 }), { computedAt: at(2) });
    expect(ruleFor('sxk-spa').tags(spa)).toHaveLength(11);
    expect(ruleFor('sxk-tempb').tags(tempb)).toContain('sen.threshold_low');

    const f = byId(aggregateDimensions([spa, tempb], flags({ SEN: 2 }), FIXED_AGE));
    expect(f.SEN.band).toBe('refer');
    expect(f.SEN.drivenBy).toBe('sxk-spa');
    expect(f.SEN.tools).toEqual(['sxk-spa', 'sxk-tempb']);
    expect(f.SEN.tags).toHaveLength(MAX_TAGS_PER_DIMENSION);
    expect(f.SEN.tags[0]).toBe('severity.severe');
    expect(f.SEN.tags).toEqual([
      'severity.severe',
      'sen.tactile', 'sen.vestibular', 'sen.body_awareness', 'sen.auditory', 'sen.visual', 'sen.oral', 'sen.regulation',
      'sen.impact_adl', 'sen.impact_group',
    ]);
    expect(MAX_TAGS_PER_DIMENSION).toBe(10);
  });

  it('severe 只落在 tier 4 的那個維度：dev 的 COG 2／5（tier 4）與 MOT 3／5（tier 3）都 refer，只有 COG 帶 severe', () => {
    const dev = score('sxk-dev', FIXED_AGE, devAnswers(FIXED_AGE, { COG: 2, MOT: 3 }), { computedAt: at(1) });
    expect(ruleFor('sxk-dev').tags(dev)).toContain('severity.severe');
    const f = byId(aggregateDimensions([dev], flags({}), FIXED_AGE));
    expect(f.COG).toMatchObject({ band: 'refer', tags: ['severity.severe', 'cog.problem_solving'] });
    expect(f.MOT).toMatchObject({ band: 'refer', tags: ['mot.locomotion'] });
    expect(f.LANG).toMatchObject({ band: 'clear', tags: [] });
  });

  it('safety_concern 在 caveats 聯集裡找得到（asb SH 第 8 項答 ≥2，band 仍 clear）', () => {
    const answers = flat('sxk-asb', FIXED_AGE, 0);
    answers['SH.8'] = 3;
    const asb = score('sxk-asb', FIXED_AGE, answers, { pre: { regression: 'none' }, computedAt: at(1) });
    const f = byId(aggregateDimensions([asb], flags({ SOC: 2 }), FIXED_AGE));
    expect(f.SOC.band).toBe('clear');
    expect(f.SOC.caveats).toContain('safety_concern');
    expect(f.SOC.tags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 五、每支只取最新且完整的一筆
// ---------------------------------------------------------------------------

describe('latestCompleteResults', () => {
  it('完整＝出的題全答了、而且至少出了一題', () => {
    const r = langWatch();
    expect(isCompleteResult(r)).toBe(true);
    expect(isCompleteResult(incomplete(r))).toBe(false);
    expect(isCompleteResult({ ...r, askedCount: 0, answeredCount: 0 })).toBe(false);
  });

  it('同一支兩筆，較新的沒做完 → 用較舊完整那筆', () => {
    const older = langWatch(at(1));
    const newer = incomplete(langClear(at(2)));
    expect(latestCompleteResults([older, newer])).toEqual([older]);
    expect(latestCompleteResults([newer, older])).toEqual([older]);
  });

  it('同一支兩筆都完整 → 用較新的，看 computedAt 不看輸入順序', () => {
    const older = langWatch(at(1));
    const newer = langClear(at(2));
    expect(latestCompleteResults([newer, older])).toEqual([newer]);
    expect(latestCompleteResults([older, newer])).toEqual([newer]);
  });

  it('不同工具依完成順序排；同一時刻的依輸入順序', () => {
    const ab = abRefer(at(1));
    const lang = langWatch(at(2));
    expect(latestCompleteResults([lang, ab]).map(r => r.toolId)).toEqual(['sxk-ab', 'sxk-lang']);
    const same = latestCompleteResults([langWatch(at(1)), abRefer(at(1))]).map(r => r.toolId);
    expect(same).toEqual(['sxk-lang', 'sxk-ab']);
  });

  it('同一支、同一時刻兩筆完整的 → 輸入裡後面那筆算較新', () => {
    const a = langWatch(at(1));
    const b = langClear(at(1));
    expect(latestCompleteResults([a, b])).toEqual([b]);
    expect(latestCompleteResults([b, a])).toEqual([a]);
  });

  it('computedAt 不是能解析的時間 → 丟錯，不安靜地排到最前或最後', () => {
    expect(() => latestCompleteResults([{ ...langWatch(), computedAt: 'yesterday' }])).toThrow(/computedAt/);
  });

  it('彙整用的是同一條篩選：較新的沒做完 → LANG 照較舊完整那筆判 watch', () => {
    const older = langWatch(at(1));
    const newer = incomplete(langClear(at(2)));
    const f = byId(aggregateDimensions([newer, older], flags({ LANG: 2 }), FIXED_AGE));
    expect(f.LANG).toMatchObject({ band: 'watch', drivenBy: 'sxk-lang', tools: ['sxk-lang'] });
  });
});

// ---------------------------------------------------------------------------
// 六、T2Findings（§5.8）
// ---------------------------------------------------------------------------

describe('buildT2Findings', () => {
  const lang = langWatch(at(1));
  const ab = abRefer(at(2));
  const findings = buildT2Findings({
    results: [ab, lang],
    t1Flags: FIXED_FLAGS,
    assessedAgeMonth: FIXED_AGE,
    computedAt: at(9),
  });

  it('version 3、toolkitVersion、rulesVersion v2-2026-09-11、計算時間', () => {
    expect(findings.version).toBe(3);
    expect(T2_FINDINGS_VERSION).toBe(3);
    expect(findings.toolkitVersion).toBe('kit-20260908');
    expect(findings.rulesVersion).toBe('v2-2026-09-11');
    expect(findings.rulesVersion).toBe(RULES_VERSION);
    expect(findings.computedAt).toBe(at(9));
  });

  it('孩子：測評月齡；性別沒給就沒有那個 key', () => {
    expect(findings.child).toEqual({ assessedAgeMonth: 48 });
    expect('sex' in findings.child).toBe(false);
    const withSex = buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE, sex: 'girl' });
    expect(withSex.child).toEqual({ assessedAgeMonth: 48, sex: 'girl' });
  });

  it('T1 九碼是複本、順序照 DIMENSION_CODES', () => {
    expect(findings.t1).toEqual(FIXED_FLAGS);
    expect(findings.t1).not.toBe(FIXED_FLAGS);
    expect(Object.keys(findings.t1)).toEqual([...DIMENSION_CODES]);
  });

  it('診斷方向沒填為 null；空字串（中控台「未定」）也是 null；填了照存', () => {
    expect(findings.diagnosisDirection).toBeNull();
    const empty = buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE, diagnosisDirection: '' as never });
    expect(empty.diagnosisDirection).toBeNull();
    const asd = buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE, diagnosisDirection: 'asd' });
    expect(asd.diagnosisDirection).toBe('asd');
    expect(() => buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE, diagnosisDirection: '自閉症' as never }))
      .toThrow(/診斷方向/);
  });

  it('九個維度都在（含 clear），與 aggregateDimensions 一致', () => {
    expect(findings.dimensions).toHaveLength(9);
    expect(findings.dimensions).toEqual(aggregateDimensions([lang, ab], FIXED_FLAGS, FIXED_AGE));
    expect(findings.dimensions.map(d => [d.dimensionId, d.band])).toEqual([
      ['COG', 'clear'], ['LANG', 'watch'], ['SOC', 'clear'], ['EMO', 'clear'], ['ATT', 'refer'],
      ['MOT', 'clear'], ['SEN', 'not_assessed'], ['ADL', 'clear'], ['LEARN', 'clear'],
    ]);
  });

  it('toolResults 是每支最新且完整的一筆，依完成順序', () => {
    expect(findings.toolResults).toEqual([lang, ab]);
    const withStale = buildT2Findings({
      results: [incomplete(langClear(at(5))), lang, ab, langClear(at(0))],
      t1Flags: FIXED_FLAGS,
      assessedAgeMonth: FIXED_AGE,
    });
    expect(withStale.toolResults).toEqual([lang, ab]);
    expect(byId(withStale.dimensions).LANG.band).toBe('watch');
  });

  it('沒給 computedAt 就用現在', () => {
    const before = Date.now();
    const built = buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE });
    expect(Date.parse(built.computedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(built.computedAt)).toBeLessThanOrEqual(Date.now());
  });

  it('輸入不對就丟錯（跟 planT2 同一套）：月齡、T1 標記、沒有規則的工具', () => {
    expect(() => buildT2Findings({ results: [], t1Flags: FIXED_FLAGS, assessedAgeMonth: 36.5 })).toThrow(/整數/);
    expect(() => buildT2Findings({ results: [], t1Flags: { ...FIXED_FLAGS, LANG: 3 as never }, assessedAgeMonth: FIXED_AGE })).toThrow(/LANG/);
    expect(() => buildT2Findings({ results: [{ ...lang, toolId: 'sxk-xyz' as ToolId }], t1Flags: FIXED_FLAGS, assessedAgeMonth: FIXED_AGE }))
      .toThrow(/sxk-xyz/);
  });

  it('不改輸入；輸出的陣列是新的', () => {
    const results = [lang, ab];
    const t1 = flags({ LANG: 2, ATT: 2, SEN: 1 });
    const snapshot = JSON.stringify({ results, t1 });
    const built = buildT2Findings({ results, t1Flags: t1, assessedAgeMonth: FIXED_AGE });
    expect(JSON.stringify({ results, t1 })).toBe(snapshot);
    built.dimensions[0].tags.push('cog.concepts');
    built.toolResults.length = 0;
    expect(buildT2Findings({ results, t1Flags: t1, assessedAgeMonth: FIXED_AGE }).toolResults).toHaveLength(2);
  });

  it('可以 JSON 來回（要存進資料庫）', () => {
    expect(JSON.parse(JSON.stringify(findings))).toEqual(findings);
  });
});
