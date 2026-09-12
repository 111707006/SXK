import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import type { DimensionFixture } from './helpers/t2Fixtures';
import { TOOLKIT } from '../src/t2/toolkit';
import { CAVEATS } from '../src/t2/caveats';
import { FINDING_TAGS } from '../src/t2/findingTags';
import { DIMENSION_CODES } from '../src/t2/types';
import type { Activity, DimensionCode, T2Findings } from '../src/t2/types';
import { matchWeeklyActivities } from '../src/t2/activityMatch';
import { buildSmartGoals } from '../src/t2/goals';
import {
  BLACKLIST,
  PUBLIC_TOOL_NAMES,
  REPLACED_SCALE_NAMES,
  TIER_NAMES,
  findBlacklisted,
} from '../src/t2/report/blacklist';
import { NO_VERDICT_CHANGE_RULE, buildProsePrompt } from '../src/t2/report/prompt';
import {
  CHAR_RANGES,
  CLOSING_SENTENCE,
  TEMPERAMENT_REPORT_TAGS,
  charCount,
  validateProse,
} from '../src/t2/report/prose';
import type { T2ReportInput, T2ReportProse } from '../src/t2/report/prose';
import { CAVEAT_SENTENCES, SAFETY_SENTENCE, TAG_SENTENCES } from '../src/t2/report/sentences';
import { templateProse } from '../src/t2/report/template';

/**
 * 報告文字：提示、schema、一致性、黑名單、模板退路（#55，規格 v2 §6）。
 *
 * 【這裡在防什麼】
 * 1. **AI 改了判定而沒有人發現**：一致性檢查比的是維度集合與 caveats 條數 —— 模型少寫一個
 *    watch 的維度，家長就看不到那一項為什麼被標記，而報告讀起來完全正常。
 * 2. **禁字回流**：`parentWording.structure.test.ts` 擋的是原始碼裡的字，擋不到模型寫出來的字。
 *    這裡擋的是產出：模板的每一句、模型回來的每一個欄位。
 * 3. **模板自己壞掉**：退路是「AI 那條路壞掉時家長拿到的東西」，所以它得過同一個驗證器。
 *    字數範圍在模板那一邊是設計約束（拼句子拼到範圍裡），不是寫完再檢查。
 * 4. **題目原文外洩**：§6.4 說敘述段落不得引用題目。提示不給題目、模板不寫題目，兩邊都用
 *    一題真的原文當探針。
 *
 * 【固定輸入】
 * 票 12（#52）那一組：48 個月、LANG 紅、ATT 紅、SEN 黃；LANG watch（sxk-lang）、
 * ATT refer（sxk-ab）、SEN not_assessed。標籤與 caveats 逐字取自 `t2Findings.test.ts` 的
 * 期望值 —— 那一份是走真的 `scoreTool` 算出來的，這裡不再算一次，只沿用結果。
 */

// ---------------------------------------------------------------------------
// 固定輸入
// ---------------------------------------------------------------------------

const LANG_WATCH: DimensionFixture = {
  band: 'watch',
  drivenBy: 'sxk-lang',
  tags: ['lang.expression', 'lang.articulation', 'lang.expression_below_comprehension'],
  caveats: ['parent_report', 'unsourced_threshold', 'parent_administered_task'],
};
const ATT_REFER: DimensionFixture = {
  band: 'refer',
  drivenBy: 'sxk-ab',
  tags: ['att.inattention', 'att.impulsivity'],
  caveats: ['parent_report', 'unsourced_threshold'],
};
const SEN_NOT_ASSESSED: DimensionFixture = { band: 'not_assessed', t1Flag: 1 };

const FIXED_FINDINGS = t2FindingsFixture({ LANG: LANG_WATCH, ATT: ATT_REFER, SEN: SEN_NOT_ASSESSED });

function activity(over: Partial<Activity> & Pick<Activity, 'id' | 'moduleNo' | 'targetMonth'>): Activity {
  return {
    title: `活动 ${over.id}`,
    ageMonths: { min: 0, max: 180 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
    ...over,
  };
}

/** LANG watch 的窗口是 36–42、ATT refer 的是 24–36（48 個月、§7.2 的偏移）。 */
const LIBRARY: Activity[] = [
  activity({ id: 'A001', moduleNo: 8, targetMonth: 38, targets: ['lang.expression'], title: '一起说完整句' }),
  activity({ id: 'A002', moduleNo: 8, targetMonth: 40, targets: ['lang.articulation'], title: '嘴巴体操' }),
  activity({ id: 'A003', moduleNo: 13, targetMonth: 30, targets: ['att.inattention'], title: '找一找拼一拼' }),
  activity({ id: 'A004', moduleNo: 13, targetMonth: 28, targets: ['att.impulsivity'], title: '红灯停绿灯行' }),
];

function inputFor(findings: T2Findings, library: Activity[] = LIBRARY): T2ReportInput {
  const ageMonth = findings.child.assessedAgeMonth;
  return {
    findings,
    activities: matchWeeklyActivities(findings, ageMonth, [], library),
    goals: buildSmartGoals(findings, { childName: '小明' }),
    childName: '小明',
  };
}

const FIXED_INPUT = inputFor(FIXED_FINDINGS);

/** 一題真的原文，當「有沒有引用題目」的探針。 */
const ITEM_PROBE = TOOLKIT['sxk-lang'].sections[0].items[0].text;

function accept(prose: T2ReportProse, input: T2ReportInput = FIXED_INPUT): void {
  const result = validateProse(prose, input);
  expect(result.ok ? [] : result.errors).toEqual([]);
}

function reject(prose: unknown, input: T2ReportInput = FIXED_INPUT): string[] {
  const result = validateProse(prose, input);
  expect(result.ok, `預期被拒，卻過了：${JSON.stringify(prose).slice(0, 200)}`).toBe(false);
  return result.ok ? [] : result.errors;
}

/** 從模板產一份合格的報告，再改一處拿去驗 —— 改的那一處就是這條測試在講的事。 */
function valid(input: T2ReportInput = FIXED_INPUT): T2ReportProse {
  return templateProse(input);
}

function withDimension(
  prose: T2ReportProse,
  dimensionId: DimensionCode,
  patch: Partial<T2ReportProse['perDimension'][number]>,
): T2ReportProse {
  return {
    ...prose,
    perDimension: prose.perDimension.map(d => (d.dimensionId === dimensionId ? { ...d, ...patch } : d)),
  };
}

// ---------------------------------------------------------------------------
// 一、提示
// ---------------------------------------------------------------------------

describe('提示（§6.2）', () => {
  const { system, user } = buildProsePrompt(FIXED_INPUT);

  it('系統提示含「不得改变判定」', () => {
    expect(system).toContain('不得改变判定');
    expect(system).toContain(NO_VERDICT_CHANGE_RULE);
  });

  it('findings 裡的每個 caveat 都出現在提示裡，代號與固定句都在', () => {
    const all = FIXED_FINDINGS.dimensions.flatMap(d => d.caveats);
    expect(all.length).toBeGreaterThan(0);
    for (const caveat of all) {
      if (caveat === 'parent_report') continue; // §5.6 不單獨成句
      expect(user, `缺 ${caveat}`).toContain(caveat);
      expect(user, `缺 ${caveat} 的固定句`).toContain(CAVEAT_SENTENCES[caveat]!);
    }
  });

  it('每個維度標了要寫幾條 caveat', () => {
    expect(user).toContain('caveats（2 条，一条都不能少）');
    expect(user).toContain('caveats（1 条，一条都不能少）');
  });

  it('活動原樣帶入：四支的名稱、為哪個維度挑的、對上的標籤', () => {
    for (const pick of FIXED_INPUT.activities.picks) {
      expect(user).toContain(pick.activity.title);
      for (const tag of pick.reason.matchedTags) expect(user).toContain(tag);
    }
    expect(FIXED_INPUT.activities.picks).toHaveLength(4);
  });

  it('目標原樣帶入：長期、短期、量化三句一字不改', () => {
    expect(FIXED_INPUT.goals.length).toBeGreaterThan(0);
    for (const goal of FIXED_INPUT.goals) {
      expect(user).toContain(goal.longTerm);
      expect(user).toContain(goal.shortTerm);
      expect(user).toContain(goal.measure);
    }
  });

  it('被替換掉的量表名整份列在禁止段', () => {
    for (const name of REPLACED_SCALE_NAMES) expect(system).toContain(name);
    expect(system).toContain('已经不再使用的量表名');
  });

  it('tier 的內部名稱也列在禁止段', () => {
    expect(system).toContain('分段的内部名称');
    for (const name of TIER_NAMES) expect(system).toContain(name);
  });

  it('四支公開工具的官方名稱列在「可以做的」那一段', () => {
    for (const name of PUBLIC_TOOL_NAMES) expect(system).toContain(name);
  });

  it('提示裡沒有任何題目原文', () => {
    expect(ITEM_PROBE.length).toBeGreaterThan(4);
    expect(system).not.toContain(ITEM_PROBE);
    expect(user).not.toContain(ITEM_PROBE);
  });

  it('提示裡沒有作答、沒有分數 —— 模型站在規則引擎的下游', () => {
    expect(user).not.toContain('answers');
    expect(user).not.toContain('sections');
  });

  it('同輸入兩次結果相同', () => {
    expect(buildProsePrompt(FIXED_INPUT)).toEqual({ system, user });
  });
});

// ---------------------------------------------------------------------------
// 二、schema（§6.3）
// ---------------------------------------------------------------------------

describe('schema', () => {
  it('模板產出的那一份是合格的', () => {
    accept(valid());
  });

  it('少一個欄位 → 拒', () => {
    const { closing: _closing, ...rest } = valid();
    expect(reject(rest).join('\n')).toContain('closing');
  });

  it('perDimension 多一個維度 → 拒', () => {
    const prose = valid();
    const extra = { ...prose.perDimension[0], dimensionId: 'MOT' as const };
    expect(reject({ ...prose, perDimension: [...prose.perDimension, extra] }).join('\n')).toContain('MOT');
  });

  it('overview 超長 → 拒', () => {
    const prose = valid();
    const long = prose.overview + '这句话是为了把字数撑过上限而重复写的。'.repeat(6);
    expect(charCount(long)).toBeGreaterThan(CHAR_RANGES.overview.max);
    expect(reject({ ...prose, overview: long }).join('\n')).toContain('overview');
  });

  it('whatWeSaw 太短 → 拒', () => {
    expect(reject(withDimension(valid(), 'LANG', { whatWeSaw: '短。' })).join('\n')).toContain('whatWeSaw');
  });

  it('欄位型別不對、整份不是物件 → 拒', () => {
    reject(null);
    reject('{}');
    reject([valid()]);
    reject({ ...valid(), perDimension: '不是陣列' });
  });

  it('多了 schema 沒有的欄位 → 拒（模型不該自己加欄位）', () => {
    expect(reject({ ...valid(), diagnosis: '自己加的' }).join('\n')).toContain('diagnosis');
  });

  it('closing 不含那一句 → 拒', () => {
    const prose = valid();
    expect(reject({ ...prose, closing: prose.closing.replace(CLOSING_SENTENCE, '有事再说') }).join('\n'))
      .toContain(CLOSING_SENTENCE);
  });

  it('caveats 裡有空字串 → 拒', () => {
    expect(reject(withDimension(valid(), 'ATT', { caveats: ['', ''] })).join('\n')).toContain('caveats');
  });
});

// ---------------------------------------------------------------------------
// 三、一致性（§6.4）
// ---------------------------------------------------------------------------

describe('一致性', () => {
  it('findings 有 LANG watch 但 perDimension 沒 LANG → 拒', () => {
    const prose = valid();
    const without = { ...prose, perDimension: prose.perDimension.filter(d => d.dimensionId !== 'LANG') };
    expect(reject(without).join('\n')).toContain('LANG(watch)');
  });

  it('perDimension 多了 clear 的 MOT → 拒', () => {
    const prose = valid();
    const extra = { ...prose.perDimension[0], dimensionId: 'MOT' as const };
    expect(reject({ ...prose, perDimension: [...prose.perDimension, extra] }).join('\n')).toContain('MOT(clear)');
  });

  it('no_tool 的 COG 沒段落 → 拒；有段落 → 過', () => {
    const findings = t2FindingsFixture({ LANG: LANG_WATCH, COG: { band: 'no_tool', t1Flag: 2 } });
    const input = inputFor(findings);
    const prose = templateProse(input);
    expect(prose.perDimension.map(d => d.dimensionId)).toContain('COG');
    accept(prose, input);

    const without = { ...prose, perDimension: prose.perDimension.filter(d => d.dimensionId !== 'COG') };
    expect(reject(without, input).join('\n')).toContain('COG(no_tool)');
  });

  it('same 維度寫兩段 → 拒', () => {
    const prose = valid();
    expect(reject({ ...prose, perDimension: [...prose.perDimension, prose.perDimension[0]] }).join('\n'))
      .toContain('出現兩次');
  });

  it('caveats 少一條 → 拒（§6.2 不可以省略）', () => {
    const prose = valid();
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    expect(lang.caveats).toHaveLength(2); // parent_report 不成句
    expect(reject(withDimension(prose, 'LANG', { caveats: lang.caveats.slice(1) })).join('\n'))
      .toContain('caveats');
  });

  it('有氣質標籤卻沒有 temperament 段 → 拒；沒有標籤卻寫了 → 拒', () => {
    const withTemperament = t2FindingsFixture({
      LANG: LANG_WATCH,
      EMO: { band: 'clear', tags: ['emo.slow_to_warm', 'emo.intensity_high'] },
    });
    const input = inputFor(withTemperament);
    const prose = templateProse(input);
    expect(prose.temperament).toBeTruthy();
    accept(prose, input);

    const { temperament: _t, ...withoutSection } = prose;
    expect(reject(withoutSection, input).join('\n')).toContain('emo.slow_to_warm');

    // 反過來：固定輸入沒有氣質標籤
    const surplus = '这是多出来的一段气质说明：孩子的天生风格顺着安排会省力很多，不必改掉它，'
      + '前几次先让他在旁边看一阵子，等他自己愿意再加入，通常比催他快。';
    expect(reject({ ...valid(), temperament: surplus }).join('\n')).toContain('沒有氣質標籤');
  });

  it('temperament 寫成 null → 拒，兩種情況都是', () => {
    // 模型常拿 null 表示「不適用」。放過去的話，有氣質標籤時「有這個欄位」成立而不報錯，
    // 家長就少了一整段。
    const withTemperament = t2FindingsFixture({
      LANG: LANG_WATCH,
      EMO: { band: 'clear', tags: ['emo.slow_to_warm'] },
    });
    const input = inputFor(withTemperament);
    expect(reject({ ...templateProse(input), temperament: null }, input).join('\n')).toContain('null');
    expect(reject({ ...valid(), temperament: null }).join('\n')).toContain('null');
  });
});

// ---------------------------------------------------------------------------
// 四、黑名單（§6.4）
// ---------------------------------------------------------------------------

describe('黑名單', () => {
  const cases: Array<[string, string]> = [
    ['診斷名', '自闭症'],
    ['tier 內部名稱', '轻微落后'],
    ['被替換的量表名', 'CARS'],
    ['儀器', '核磁'],
    ['《對照表》禁字', '严重'],
  ];

  it.each(cases)('whyItMatters 出現%s（%s）→ 拒', (_label, word) => {
    const prose = valid();
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    const patched = withDimension(prose, 'LANG', {
      whyItMatters: lang.whyItMatters.slice(0, -word.length - 1) + word + '。',
    });
    expect(reject(patched).join('\n')).toContain(word);
  });

  it('四支公開工具的官方名稱 → 過（M-CHAT-R/F 是可以寫的）', () => {
    for (const name of PUBLIC_TOOL_NAMES) expect(findBlacklisted(`这次做了 ${name}。`)).toEqual([]);
  });

  it('大小寫不同的量表名一樣擋（pedsql ＝ PedsQL）', () => {
    expect(findBlacklisted('参考 pedsql 的结果')).not.toEqual([]);
  });

  it('每個欄位都掃，不只 whyItMatters', () => {
    const prose = valid();
    reject({ ...prose, weeklyPlanIntro: prose.weeklyPlanIntro + 'Conners。' });
    reject({ ...prose, closing: prose.closing + '丹佛。' });
    expect(reject(withDimension(prose, 'ATT', { caveats: ['这一份 WeeFIM 的结果仅供参考。', '第二条。'] })).join('\n'))
      .toContain('WeeFIM');
  });

  it('tier 名稱是從工具包算出來的，不是手抄的', () => {
    expect(TIER_NAMES).toContain('轻微落后');
    expect(TIER_NAMES).toContain('明显落后');
    expect(TIER_NAMES.length).toBeGreaterThan(20);
    expect(BLACKLIST).toEqual(expect.arrayContaining([...TIER_NAMES]));
  });

  it('前三個官方名稱就是 TOOLKIT 的 code，沒有第二份副本', () => {
    expect(PUBLIC_TOOL_NAMES.slice(0, 3)).toEqual([
      TOOLKIT['mchat-rf'].code, TOOLKIT['snap-iv'].code, TOOLKIT.chexi.code,
    ]);
  });
});

// ---------------------------------------------------------------------------
// 五、模板退路（§6.4）
// ---------------------------------------------------------------------------

describe('模板：票 12 那組固定輸入', () => {
  const prose = templateProse(FIXED_INPUT);

  it('產得出完整報告，過同一個驗證器', () => {
    accept(prose);
  });

  it('只講 watch／refer 的兩個維度，SEN not_assessed 不成段', () => {
    expect(prose.perDimension.map(d => d.dimensionId)).toEqual(['ATT', 'LANG']);
  });

  it('overview 把 SEN 那一項講清楚了 —— 沒做完不等於沒事', () => {
    expect(prose.overview).toContain('这次没有做完对应的问卷');
  });

  it('每個欄位都在字數範圍內', () => {
    expect(charCount(prose.overview)).toBeGreaterThanOrEqual(CHAR_RANGES.overview.min);
    expect(charCount(prose.overview)).toBeLessThanOrEqual(CHAR_RANGES.overview.max);
    for (const d of prose.perDimension) {
      expect(charCount(d.whatWeSaw), `${d.dimensionId}.whatWeSaw`).toBeGreaterThanOrEqual(CHAR_RANGES.whatWeSaw.min);
      expect(charCount(d.whatWeSaw), `${d.dimensionId}.whatWeSaw`).toBeLessThanOrEqual(CHAR_RANGES.whatWeSaw.max);
      expect(charCount(d.whyItMatters), `${d.dimensionId}.whyItMatters`).toBeGreaterThanOrEqual(CHAR_RANGES.whyItMatters.min);
      expect(charCount(d.whyItMatters), `${d.dimensionId}.whyItMatters`).toBeLessThanOrEqual(CHAR_RANGES.whyItMatters.max);
    }
  });

  it('過家長用字掃描（《對照表》三級）', () => {
    const hits = findBannedWords(JSON.stringify(prose));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('沒有題目原文', () => {
    expect(JSON.stringify(prose)).not.toContain(ITEM_PROBE);
  });

  it('沒有換活動、沒有加活動 —— 模板根本不列活動名稱，只講怎麼排', () => {
    expect(prose.weeklyPlanIntro).toContain('4 支活动');
    for (const pick of FIXED_INPUT.activities.picks) {
      expect(prose.weeklyPlanIntro).not.toContain(pick.activity.title);
    }
  });

  it('同輸入兩次結果相同', () => {
    expect(templateProse(FIXED_INPUT)).toEqual(prose);
  });
});

describe('模板：safety_concern 置頂（§5.6）', () => {
  const findings = t2FindingsFixture({
    LANG: LANG_WATCH,
    SOC: { band: 'refer', drivenBy: 'sxk-asb', tags: ['soc.eye_contact'], caveats: ['parent_report', 'safety_concern'] },
  });
  const input = inputFor(findings);
  const prose = templateProse(input);

  it('overview 的第一句就是那一句，一字不改', () => {
    expect(prose.overview.startsWith(SAFETY_SENTENCE)).toBe(true);
  });

  it('過驗證器；把它挪走或改寫就過不了', () => {
    accept(prose, input);
    reject({ ...prose, overview: prose.overview.slice(SAFETY_SENTENCE.length) }, input);
    reject({ ...prose, overview: `孩子有伤害自己的情形时请联系专业人员。${prose.overview.slice(SAFETY_SENTENCE.length)}` }, input);
  });

  it('那一句不佔 overview 的字數額度', () => {
    expect(charCount(prose.overview) - charCount(SAFETY_SENTENCE))
      .toBeLessThanOrEqual(CHAR_RANGES.overview.max);
  });
});

describe('模板：各種形狀都產得出合格的報告', () => {
  const shapes: Array<[string, T2Findings]> = [
    ['九維全 clear', t2FindingsFixture({})],
    ['一個 no_tool', t2FindingsFixture({ MOT: { band: 'no_tool', t1Flag: 2 } })],
    ['三個 refer', t2FindingsFixture({
      LANG: { band: 'refer', tags: ['lang.expression'] },
      SOC: { band: 'refer', tags: ['soc.eye_contact'] },
      ATT: { band: 'refer', tags: ['att.inattention'] },
    })],
    ['九維都有事', t2FindingsFixture(Object.fromEntries(
      DIMENSION_CODES.map(d => [d, { band: 'watch' as const }]),
    ))],
    ['一個維度十個標籤', t2FindingsFixture({
      SEN: {
        band: 'refer',
        tags: ['sen.tactile', 'sen.vestibular', 'sen.body_awareness', 'sen.auditory', 'sen.visual',
          'sen.oral', 'sen.regulation', 'sen.threshold_low', 'sen.impact_adl', 'sen.impact_group'],
        caveats: ['parent_report', 'unsourced_threshold', 'no_functional_impact'],
      },
    })],
    ['沒有活動可配', t2FindingsFixture({ LEARN: { band: 'watch', tags: ['learn.reading'] } })],
    // 一個維度、一支活動、維度名稱又是最短的那個：`weeklyPlanIntro` 的下限在這裡最吃緊。
    ['只有认知、只配到一支', t2FindingsFixture({ COG: { band: 'watch', tags: ['cog.concepts'] } })],
  ];

  it.each(shapes)('%s', (_label, findings) => {
    const input = inputFor(findings);
    accept(templateProse(input), input);
  });

  it('只有认知、只配到一支時，weeklyPlanIntro 仍在字數範圍內', () => {
    const findings = t2FindingsFixture({ COG: { band: 'watch', tags: ['cog.concepts'] } });
    const input = inputFor(findings, [
      activity({ id: 'C001', moduleNo: 12, targetMonth: 40, targets: ['cog.concepts'], title: '大的小的分一分' }),
    ]);
    expect(input.activities.picks).toHaveLength(1);
    expect(input.activities.preparing).toEqual([]);
    const intro = templateProse(input).weeklyPlanIntro;
    expect(charCount(intro)).toBeGreaterThanOrEqual(CHAR_RANGES.weeklyPlanIntro.min);
    expect(charCount(intro)).toBeLessThanOrEqual(CHAR_RANGES.weeklyPlanIntro.max);
  });

  it('七個氣質標籤各自單獨出現時，temperament 段都在字數範圍內', () => {
    // 一個標籤時下限最吃緊（開場 ＋ 一句 ＋ 收尾），最短的那一句就是這一條測試的意義。
    for (const tag of TEMPERAMENT_REPORT_TAGS) {
      const dimension = tag.slice(0, tag.indexOf('.')).toUpperCase() as DimensionCode;
      const findings = t2FindingsFixture({
        LANG: LANG_WATCH,
        [dimension]: { band: 'clear', tags: [tag] },
      });
      const input = inputFor(findings);
      const prose = templateProse(input);
      expect(prose.temperament, tag).toBeTruthy();
      expect(charCount(prose.temperament!), tag).toBeGreaterThanOrEqual(CHAR_RANGES.temperament.min);
      expect(charCount(prose.temperament!), tag).toBeLessThanOrEqual(CHAR_RANGES.temperament.max);
      accept(prose, input);
    }
  });

  it('算不出月齡時，age_out_of_window 用沒有數字的寫法（不編一個數字）', () => {
    const findings = t2FindingsFixture({
      LANG: { band: 'watch', drivenBy: 'sxk-lang', tags: ['lang.expression'], caveats: ['parent_report', 'age_out_of_window'] },
    });
    const input = inputFor(findings);
    const lang = templateProse(input).perDimension.find(d => d.dimensionId === 'LANG')!;
    expect(lang.caveats).toEqual([CAVEAT_SENTENCES.age_out_of_window]);
    expect(lang.caveats[0]).not.toMatch(/\d/);
  });

  it('九個維度 × 三種 band，字數都落在範圍裡（有標籤與沒標籤各一次）', () => {
    for (const dimension of DIMENSION_CODES) {
      for (const band of ['watch', 'refer', 'no_tool'] as const) {
        for (const tags of [[], [FINDING_TAGS.find(t => t.startsWith(dimension.toLowerCase()))!]]) {
          const findings = t2FindingsFixture({
            [dimension]: { band, t1Flag: 2, tags: band === 'no_tool' ? [] : tags },
          });
          const input = inputFor(findings);
          const prose = templateProse(input);
          const entry = prose.perDimension.find(d => d.dimensionId === dimension)!;
          const where = `${dimension}/${band}/${tags.length} 個標籤`;
          expect(charCount(entry.whatWeSaw), `${where} whatWeSaw`).toBeGreaterThanOrEqual(CHAR_RANGES.whatWeSaw.min);
          expect(charCount(entry.whatWeSaw), `${where} whatWeSaw`).toBeLessThanOrEqual(CHAR_RANGES.whatWeSaw.max);
          expect(charCount(entry.whyItMatters), `${where} whyItMatters`).toBeGreaterThanOrEqual(CHAR_RANGES.whyItMatters.min);
          expect(charCount(entry.whyItMatters), `${where} whyItMatters`).toBeLessThanOrEqual(CHAR_RANGES.whyItMatters.max);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 六、兩張字表本身
// ---------------------------------------------------------------------------

describe('固定說法的字表', () => {
  it('57 個標籤一個不漏、一個不多', () => {
    expect(Object.keys(TAG_SENTENCES).sort()).toEqual([...FINDING_TAGS].sort());
  });

  it('17 個 caveat 一個不漏；只有 parent_report 沒有句子（§5.6 不單獨成句）', () => {
    expect(Object.keys(CAVEAT_SENTENCES).sort()).toEqual([...CAVEATS].sort());
    const empty = CAVEATS.filter(c => CAVEAT_SENTENCES[c] === null);
    expect(empty).toEqual(['parent_report']);
  });

  it('每一句都過黑名單與家長用字掃描', () => {
    for (const [tag, sentence] of Object.entries(TAG_SENTENCES)) {
      expect(findBlacklisted(sentence), `${tag}：${sentence}`).toEqual([]);
    }
    for (const [caveat, sentence] of Object.entries(CAVEAT_SENTENCES)) {
      if (sentence === null) continue;
      expect(findBlacklisted(sentence), `${caveat}：${sentence}`).toEqual([]);
    }
  });

  it('沒有一句引用題目原文', () => {
    const all = Object.values(TAG_SENTENCES).join('');
    expect(all).not.toContain(ITEM_PROBE);
  });
});
