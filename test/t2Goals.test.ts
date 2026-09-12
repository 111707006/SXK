import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture as findings } from './helpers/t2Fixtures';
import { TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { SITE_DIMENSION_NAME } from '../src/t2/dimensionMap';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag, ToolResult } from '../src/t2/types';
import { buildT2Findings } from '../src/t2/findings';
import { GOAL_TEMPLATES } from '../src/t2/goalTemplates';
import {
  DEFAULT_CHILD_NAME,
  GOAL_CEILING,
  GOAL_FLOOR,
  MAX_GOALS,
  NO_BASELINE_NOTE,
  buildSmartGoals,
  milestonesFrom,
} from '../src/t2/goals';
import type { BaselineDirection, SmartGoal } from '../src/t2/goals';

/**
 * SMART 目標（#54，規格 v2 §8）。
 *
 * 【這裡在防什麼】
 * 1. **起點不能是編出來的。** 原型憑嚴重度給 20／30／50，家長讀到的「目前約 30%」沒有任何
 *    一次作答支持它。§8 明寫用原生值，沒有就寫「以第一周家长记录为起点」。
 * 2. **沒有判定的維度不出目標。** `partial`／`not_assessed`／`no_tool` 與只出標籤的氣質，
 *    都不是「輕一點的判定」；給它們寫目標等於把沒做完講成已經量過。
 * 3. **不湊數。** 原型湊不滿兩條就從沒被標記的維度補，最後兜底給 `['MOT','LANG']`。
 * 4. **關切率的方向。** 關切率越低越好；套上「提升到」就是把要減少的講成要增加的。
 * 5. **九條模板是家長讀的字。** 禁字與 tier 內部名稱一個都不能有。
 *
 * 【用字掃描為什麼要一張「誰餵得到誰」的表】
 * 第一版是拿同一支工具當九個維度的 `drivenBy`，但附錄 F 說它只餵其中一個，其餘八個
 * `sectionsFor` 回 `null` → 靜默走退路句型。掃描的字數是對的，掃到的句型不是：兩套帶數字的
 * 句子各只被一個維度掃到。`HIGHER_SOURCE`／`LOWER_SOURCE` 是真的對得起附錄 F 的那兩張表，而每個案例都
 * **順便斷言它走的是哪一套句型**，下次再漂就會紅。
 */

const at = '2026-09-12T00:00:00.000Z';

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, computedAt: at });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

/** 湊得出 `pct` 的最小原始分。湊不出來就讓測試自己壞掉，不默默取近似。 */
function rawForPct(max: number, pct: number): number {
  for (let raw = 0; raw <= max; raw++) {
    if (Math.round((raw / max) * 100) === pct) return raw;
  }
  throw new Error(`湊不出 ${pct}%（max=${max}）`);
}

/** 前面的題全給 `perItem`、一題給餘數、其餘 0，湊出指定的原始總分（0 是合法作答的族才能用）。 */
function answersForRaw(toolId: ToolId, ageMonth: number, perItem: number, raw: number): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  let left = raw;
  for (const item of askedItems(toolId, ageMonth)) {
    const give = Math.min(perItem, left);
    out[item.key] = give;
    left -= give;
  }
  if (left > 0) throw new Error(`${toolId} 在 ${ageMonth} 個月放不進 ${raw} 分`);
  return out;
}

/** 一支工具在某個月齡、總體百分比恰好是 `pct` 的一筆結果。 */
function resultAtPct(toolId: ToolId, ageMonth: number, perItem: number, pct: number): ToolResult {
  const max = askedItems(toolId, ageMonth).length * perItem;
  const r = score(toolId, ageMonth, answersForRaw(toolId, ageMonth, perItem, rawForPct(max, pct)));
  expect(r.overall.pct, `${toolId} 的總體百分比`).toBe(pct);
  return r;
}

/** 全部答同一個值。 */
function uniform(toolId: ToolId, ageMonth: number, value: AnswerValue): ToolResult {
  const out: Record<string, AnswerValue> = {};
  for (const item of askedItems(toolId, ageMonth)) out[item.key] = value;
  return score(toolId, ageMonth, out);
}

/**
 * `sxk-dev`：每個領域前 n 題通過、其餘沒通過。題 key 是 `${年齡段}.${領域}.${序號}`，
 * 領域各 5 題 —— 3 題通過＝60%。`perDomain` 可以逐個領域覆寫，用來讓某一格與總分不同。
 */
function devResult(
  ageMonth: number,
  passPerDomain: number,
  perDomain: Record<string, number> = {},
): ToolResult {
  const seen: Record<string, number> = {};
  const out: Record<string, AnswerValue> = {};
  for (const item of askedItems('sxk-dev', ageMonth)) {
    const domain = item.key.split('.')[1];
    seen[domain] = (seen[domain] ?? 0) + 1;
    out[item.key] = seen[domain] <= (perDomain[domain] ?? passPerDomain) ? 'pass' : 'fail';
  }
  return score('sxk-dev', ageMonth, out);
}

const ALL_GREEN: Record<DimensionCode, T1Flag> = {
  COG: 0, LANG: 0, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0,
};

const dims = (gs: ReadonlyArray<{ dimensionId: DimensionCode }>) => gs.map(g => g.dimensionId);

describe('挑哪幾個維度、幾條（§8）', () => {
  it('band 最重的在前；同 band 依固定順序 —— LANG watch、ATT refer、SEN refer → ATT、SEN、LANG', () => {
    const goals = buildSmartGoals(findings({
      LANG: { band: 'watch' }, ATT: { band: 'refer' }, SEN: { band: 'refer' },
    }));
    expect(dims(goals)).toEqual(['ATT', 'SEN', 'LANG']);
    expect(goals.map(g => g.band)).toEqual(['refer', 'refer', 'watch']);
  });

  it('診斷方向「自閉症」且 SOC 被標記 → SOC 排最前（附錄 B.2 的功能處理順序）', () => {
    const flagged = { LANG: { band: 'watch' as const }, SOC: { band: 'watch' as const }, ATT: { band: 'watch' as const } };
    // 沒有診斷方向：固定順序 LANG、SOC、ATT
    expect(dims(buildSmartGoals(findings(flagged)))).toEqual(['LANG', 'SOC', 'ATT']);
    // 自閉症：客戶的順序 SOC、EMO、LANG、COG、LEARN、SEN、ATT、MOT
    expect(dims(buildSmartGoals(findings(flagged, { diagnosisDirection: 'asd' })))).toEqual(['SOC', 'LANG', 'ATT']);
  });

  it('同 band 取 T1 標記較重者', () => {
    const goals = buildSmartGoals(findings({
      LANG: { band: 'watch', t1Flag: 1 },
      SEN: { band: 'watch', t1Flag: 2 },
    }));
    expect(dims(goals)).toEqual(['SEN', 'LANG']);
  });

  it('只有一個維度被標記 → 1 條，不湊到 2', () => {
    expect(dims(buildSmartGoals(findings({ ADL: { band: 'refer' } })))).toEqual(['ADL']);
  });

  it('四個被標記 → 3 條', () => {
    const goals = buildSmartGoals(findings({
      LANG: { band: 'refer' }, SOC: { band: 'refer' }, ATT: { band: 'refer' }, MOT: { band: 'refer' },
    }));
    expect(goals).toHaveLength(MAX_GOALS);
    expect(dims(goals)).toEqual(['LANG', 'SOC', 'ATT']);
  });

  it('一個都沒有被標記 → 空陣列，不報錯、不兜底給 MOT／LANG', () => {
    expect(buildSmartGoals(findings({}))).toEqual([]);
  });

  it('沒有判定的三種（partial／not_assessed／no_tool）不出目標', () => {
    const goals = buildSmartGoals(findings({
      LANG: { band: 'partial' }, ATT: { band: 'not_assessed' }, COG: { band: 'no_tool' },
      SEN: { band: 'watch' },
    }));
    expect(dims(goals)).toEqual(['SEN']);
  });

  it('一個維度只出一條', () => {
    const goals = buildSmartGoals(findings({ LANG: { band: 'refer' }, SOC: { band: 'watch' } }));
    expect(new Set(dims(goals)).size).toBe(goals.length);
  });
});

describe('起點百分比用原生值（§8）', () => {
  it('LANG 的原生達成率 78 → 目標句含 78%，並記得是哪一支說的', () => {
    const lang = resultAtPct('sxk-lang', 48, 2, 78);
    const goals = buildSmartGoals(buildT2Findings({
      results: [lang],
      t1Flags: { ...ALL_GREEN, LANG: 2 },
      assessedAgeMonth: 48,
    }));

    expect(dims(goals)).toEqual(['LANG']);
    const [goal] = goals;
    expect(goal.band).toBe('watch');
    expect(goal.baseline).toEqual({
      pct: 78, toolId: 'sxk-lang', sectionKey: 'overall', direction: 'higher_better', label: '达成率',
    });
    expect(goal.longTerm).toContain('78%');
    expect(goal.measure).toContain('起点 78%');
    expect(goal.measure).not.toContain(NO_BASELINE_NOTE);
    // 95 的一半：78 → 87（12 週）→ 83（4 週）
    expect(goal.milestones).toEqual({ short: 83, long: 87 });
    expect(goal.longTerm).toContain('提升到 87% 以上');
    expect(goal.shortTerm).toContain('达到 83%');
  });

  it('關切率是越低越好 —— 數字往下走，句子不寫「提升」', () => {
    const ab = resultAtPct('sxk-ab', 48, 3, 45);
    const goals = buildSmartGoals(buildT2Findings({
      results: [ab],
      t1Flags: { ...ALL_GREEN, ATT: 2 },
      assessedAgeMonth: 48,
    }));

    expect(dims(goals)).toEqual(['ATT']);
    const [goal] = goals;
    expect(goal.band).toBe('refer');
    expect(goal.baseline?.direction).toBe('lower_better');
    expect(goal.baseline?.label).toBe('关切率');
    // 5 的一半：45 → 25（12 週）→ 35（4 週）
    expect(goal.milestones).toEqual({ short: 35, long: 25 });
    expect(goal.longTerm).toContain('由目前约 45% 减到 25% 以下');
    expect(goal.longTerm).not.toContain('提升');
    expect(goal.shortTerm).toContain('降到 35%');
  });

  it('獨立率（sxk-adl）：起點就是那一筆的獨立率，家長端叫「独立率」', () => {
    const adl = uniform('sxk-adl', 48, 4);
    const goals = buildSmartGoals(buildT2Findings({
      results: [adl],
      t1Flags: { ...ALL_GREEN, ADL: 2 },
      assessedAgeMonth: 48,
    }));

    expect(dims(goals)).toEqual(['ADL']);
    expect(goals[0].baseline).toEqual({
      pct: adl.overall.pct, toolId: 'sxk-adl', sectionKey: 'overall', direction: 'higher_better', label: '独立率',
    });
    expect(goals[0].longTerm).toContain(`由目前约 ${adl.overall.pct}%`);
  });

  it('通過率（sxk-dev）：起點取該領域那一格，不是總分', () => {
    // 其餘領域 5 題過 4 題（80%），COG 只過 2 題（40%）—— 兩個數字不同，才看得出取的是哪一個
    const dev = devResult(48, 4, { COG: 2 });
    expect(dev.sections['COG'].pct).toBe(40);
    expect(dev.overall.pct).not.toBe(40);

    const goals = buildSmartGoals(findings(
      { COG: { band: 'refer', drivenBy: 'sxk-dev' } },
      { toolResults: [dev] },
    ));
    expect(goals[0].baseline).toEqual({
      pct: 40, toolId: 'sxk-dev', sectionKey: 'COG', direction: 'higher_better', label: '达成率',
    });
    expect(goals[0].longTerm).toContain('由目前约 40%');
  });

  it('drivenBy 為 null 的維度 → 寫「以第一周家长记录为起点」，整套句子裡沒有百分比', () => {
    const goals = buildSmartGoals(findings({ SEN: { band: 'refer' } }));
    const [goal] = goals;
    expect(goal.baseline).toBeNull();
    expect(goal.milestones).toBeNull();
    expect(goal.measure).toContain(NO_BASELINE_NOTE);
    expect(`${goal.longTerm}${goal.shortTerm}${goal.measure}`).not.toMatch(/\d+%/);
  });

  it('drivenBy 那一族沒有可用的百分比（ldp 的總分是給雷達圖的）→ 也走退路那句', () => {
    const goals = buildSmartGoals(findings(
      { LEARN: { band: 'refer', drivenBy: 'sxk-ldp' } },
      { toolResults: [uniform('sxk-ldp', 96, 2)] },
    ));
    expect(goals[0].baseline).toBeNull();
    expect(goals[0].measure).toContain(NO_BASELINE_NOTE);
  });

  it('舊快照裡 drivenBy 那一支已經不在 toolResults → 不丟錯，走退路那句', () => {
    const goals = buildSmartGoals(findings({ LANG: { band: 'watch', drivenBy: 'sxk-lang' } }));
    expect(goals[0].baseline).toBeNull();
    expect(goals[0].measure).toContain(NO_BASELINE_NOTE);
  });

  it('只有氣質標籤的 EMO 不會成為目標（氣質不出 band）', () => {
    const tempb = uniform('sxk-tempb', 48, 5);
    const built = buildT2Findings({
      results: [tempb, resultAtPct('sxk-lang', 48, 2, 78)],
      t1Flags: { ...ALL_GREEN, LANG: 2 },
      assessedAgeMonth: 48,
    });

    const emo = built.dimensions.find(d => d.dimensionId === 'EMO');
    expect(emo?.tags.length, '氣質有餵標籤給 EMO').toBeGreaterThan(0);
    expect(emo?.band).toBe('clear');
    expect(dims(buildSmartGoals(built))).toEqual(['LANG']);
  });
});

describe('四週與十二週的數字', () => {
  it('把與上限的差距縮一半，再縮一半；四週永遠落在起點與十二週之間', () => {
    for (let pct = 0; pct <= 100; pct++) {
      const up = milestonesFrom(pct, 'higher_better');
      expect(up.long).toBeGreaterThanOrEqual(pct);
      expect(up.short).toBeGreaterThanOrEqual(pct);
      expect(up.short).toBeLessThanOrEqual(up.long);
      expect(up.long).toBeLessThanOrEqual(Math.max(pct, GOAL_CEILING));

      const down = milestonesFrom(pct, 'lower_better');
      expect(down.long).toBeLessThanOrEqual(pct);
      expect(down.short).toBeLessThanOrEqual(pct);
      expect(down.short).toBeGreaterThanOrEqual(down.long);
      expect(down.long).toBeGreaterThanOrEqual(Math.min(pct, GOAL_FLOOR));
    }
  });

  it('沒有空間時三個數字相同，不會倒退', () => {
    expect(milestonesFrom(GOAL_CEILING, 'higher_better')).toEqual({ short: 95, long: 95 });
    expect(milestonesFrom(GOAL_FLOOR, 'lower_better')).toEqual({ short: 5, long: 5 });
    expect(milestonesFrom(100, 'higher_better')).toEqual({ short: 100, long: 100 });
    expect(milestonesFrom(0, 'lower_better')).toEqual({ short: 0, long: 0 });
  });
});

/**
 * 每個維度真的能拿到起點的一支工具（附錄 F 的 `feeds` ∩ `BASELINE_BY_FAMILY` 的四族），
 * 都在 48 個月的窗口內。空著的格子不是漏掉，是那個維度在這個月齡沒有那個方向的來源：
 * EMO 只有 `snap-iv`（mean-snap，`pct` 是 null）、LEARN 只有 ldp／lds（total 族不採）。
 */
const HIGHER_SOURCE: Partial<Record<DimensionCode, ToolId>> = {
  COG: 'sxk-dev', LANG: 'sxk-dev', SOC: 'sxk-dev', MOT: 'sxk-dev', ADL: 'sxk-adl',
};
const LOWER_SOURCE: Partial<Record<DimensionCode, ToolId>> = {
  SOC: 'sxk-asb', ATT: 'sxk-ab', SEN: 'sxk-spa',
};

/** 三套句型各走一遍：有起點（兩個方向，只在真的餵得到的維度）＋沒有起點（九個都走）。 */
function allGoals(): Array<{ goal: SmartGoal; direction: BaselineDirection | null }> {
  const results: Record<string, ToolResult> = {
    'sxk-dev': devResult(48, 3),
    'sxk-adl': uniform('sxk-adl', 48, 4),
    'sxk-asb': resultAtPct('sxk-asb', 48, 3, 45),
    'sxk-ab': resultAtPct('sxk-ab', 48, 3, 45),
    'sxk-spa': resultAtPct('sxk-spa', 48, 3, 45),
  };
  const out: Array<{ goal: SmartGoal; direction: BaselineDirection | null }> = [];

  for (const d of DIMENSION_CODES) {
    const cases: Array<[ToolId | null, BaselineDirection | null]> = [
      [null, null],
      [HIGHER_SOURCE[d] ?? null, HIGHER_SOURCE[d] ? 'higher_better' : null],
      [LOWER_SOURCE[d] ?? null, LOWER_SOURCE[d] ? 'lower_better' : null],
    ];
    for (const [toolId, direction] of cases) {
      if (toolId === null && direction !== null) continue;
      const f = toolId === null
        ? findings({ [d]: { band: 'refer' } })
        : findings({ [d]: { band: 'refer', drivenBy: toolId } }, { toolResults: [results[toolId]] });
      for (const goal of buildSmartGoals(f, { childName: '小明' })) {
        // 斷言它真的走了預期的那一套句型 —— 不然掃描會在不知不覺間只掃退路句
        expect(goal.baseline?.direction ?? null, `${d} 由 ${toolId ?? '（無）'} 推動時的句型`).toBe(direction);
        out.push({ goal, direction });
      }
    }
  }
  return out;
}

describe('九條模板是家長讀的字（§8、《家长报告用语对照表》）', () => {
  it('九個維度都有一條，能力名稱從正式站查、不在模板裡', () => {
    expect(Object.keys(GOAL_TEMPLATES).sort()).toEqual([...DIMENSION_CODES].sort());
    expect(Object.keys(GOAL_TEMPLATES[DIMENSION_CODES[0]]).sort()).toEqual(['activity', 'criterion']);
    for (const d of DIMENSION_CODES) {
      const goal = buildSmartGoals(findings({ [d]: { band: 'refer' } }))[0];
      expect(goal.area, `${d} 的能力名稱`).toBe(SITE_DIMENSION_NAME[d]);
    }
    // 抽兩個對回 CONTEXT.md 的對照表，確定 SITE_DIMENSION_NAME 本身沒有被改壞
    expect(SITE_DIMENSION_NAME.ADL).toBe('生活自理与适应');
    expect(SITE_DIMENSION_NAME.MOT).toBe('动作发展');
  });

  it('九條模板沒有禁字', () => {
    for (const d of DIMENSION_CODES) {
      const t = GOAL_TEMPLATES[d];
      const hits = findBannedWords(`${t.activity}${t.criterion}`);
      expect(hits, `${d}：${hits.join('\n')}`).toEqual([]);
    }
  });

  it('三套句型產出來的句子也沒有禁字，三套都真的被走到', () => {
    const all = allGoals();
    const walked = new Set(all.map(x => x.direction));
    expect(walked).toEqual(new Set([null, 'higher_better', 'lower_better']));

    for (const { goal } of all) {
      const text = `${goal.area}｜${goal.longTerm}｜${goal.shortTerm}｜${goal.measure}`;
      const hits = findBannedWords(text);
      expect(hits, `${text}\n${hits.join('\n')}`).toEqual([]);
    }
  });

  it('不含任何 tier 的內部名稱（「轻微落后」那些）', () => {
    const tierKeys = [...new Set(TOOL_IDS.flatMap(id => TOOL_SPECS[id].tiers.map(t => t.key)))];
    expect(tierKeys.length).toBeGreaterThan(10);

    const text = [
      ...DIMENSION_CODES.map(d => `${GOAL_TEMPLATES[d].activity}${GOAL_TEMPLATES[d].criterion}`),
      ...allGoals().map(({ goal }) => `${goal.area}${goal.longTerm}${goal.shortTerm}${goal.measure}`),
    ].join('\n');

    for (const key of tierKeys) {
      expect(text, `tier 內部名稱「${key}」跑進家長端`).not.toContain(key);
    }
  });

  it('EMO 與 LEARN 今天永遠拿不到起點 —— 內容缺口，不是判定錯了', () => {
    // EMO 只有 snap-iv 會推 band（mean-snap，pct 恆為 null）、LEARN 只有 ldp／lds（total 族不採）
    expect(HIGHER_SOURCE.EMO).toBeUndefined();
    expect(LOWER_SOURCE.EMO).toBeUndefined();
    expect(HIGHER_SOURCE.LEARN).toBeUndefined();
    expect(LOWER_SOURCE.LEARN).toBeUndefined();

    for (const d of ['EMO', 'LEARN'] as const) {
      const goal = buildSmartGoals(findings({ [d]: { band: 'refer' } }))[0];
      expect(goal.measure, `${d}`).toContain(NO_BASELINE_NOTE);
    }
  });

  it('孩子的名字：有就用，沒有（或空白）用「孩子」', () => {
    const f = findings({ LANG: { band: 'watch' } });
    expect(buildSmartGoals(f, { childName: '小明' })[0].longTerm.startsWith('小明')).toBe(true);
    expect(buildSmartGoals(f)[0].longTerm.startsWith(DEFAULT_CHILD_NAME)).toBe(true);
    expect(buildSmartGoals(f, { childName: '   ' })[0].longTerm.startsWith(DEFAULT_CHILD_NAME)).toBe(true);
  });
});
