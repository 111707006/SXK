import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import type { DimensionFixture } from './helpers/t2Fixtures';
import { TOOLKIT } from '../src/t2/toolkit';
import { CAVEATS } from '../src/t2/caveats';
import { FINDING_TAGS } from '../src/t2/findingTags';
import type { FindingTag } from '../src/t2/findingTags';
import { DIMENSION_CODES } from '../src/t2/types';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Activity, DimensionCode, T2Findings } from '../src/t2/types';
import { matchWeeklyActivities } from '../src/t2/activityMatch';
import { buildT2Findings } from '../src/t2/findings';
import { SITE_DIMENSION_NAME } from '../src/t2/dimensionMap';
import { buildSmartGoals } from '../src/t2/goals';
import {
  BLACKLIST,
  PUBLIC_TOOL_NAMES,
  REPLACED_SCALE_NAMES,
  TIER_NAMES,
  findBlacklisted,
} from '../src/t2/report/blacklist';
import { NO_VERDICT_CHANGE_RULE, SCHOOL_AGE_PROMPT_NOTE, buildProsePrompt } from '../src/t2/report/prompt';
import {
  CHAR_RANGES,
  CLOSING_SENTENCE,
  TEMPERAMENT_REPORT_TAGS,
  charCount,
  validateProse,
} from '../src/t2/report/prose';
import type { T2ReportInput, T2ReportProse } from '../src/t2/report/prose';
import { CAVEAT_SENTENCES, SAFETY_SENTENCE, SCHOOL_AGE_NO_TOOL_SENTENCE, TAG_SENTENCES } from '../src/t2/report/sentences';
import { SEE_TEMPERAMENT_SENTENCE, templateProse } from '../src/t2/report/template';

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
    ...NO_ACTIVITY_CONTENT,
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
// 五之二、v2.1：氣質推出的情緒段（§4.4）、只能當加測的兩條 caveat（§4.5）
// ---------------------------------------------------------------------------

describe('v2.1 S07：氣質推出的維度段落不重複氣質標籤句', () => {
  /** 24 個月情緒紅、tempa D4 偏 → 情緒 watch（`t2Findings.test.ts` 的 S07 那組）。 */
  const EMO_FROM_TEMPERAMENT: DimensionFixture = {
    band: 'watch',
    drivenBy: 'sxk-tempa',
    tags: ['emo.adaptability_low'],
    caveats: ['parent_report', 'unsourced_threshold'],
  };
  const findings = t2FindingsFixture({ EMO: EMO_FROM_TEMPERAMENT }, { child: { assessedAgeMonth: 24 } });
  const input = inputFor(findings);

  it('模板：情緒段不寫那一句標籤句，改一句指向氣質段；氣質段照寫；過驗證器', () => {
    const prose = templateProse(input);
    const emo = prose.perDimension.find(d => d.dimensionId === 'EMO')!;
    expect(emo.whatWeSaw).not.toContain(TAG_SENTENCES['emo.adaptability_low']);
    expect(emo.whatWeSaw).toContain(SEE_TEMPERAMENT_SENTENCE);
    expect(prose.temperament).toContain(TAG_SENTENCES['emo.adaptability_low']);
    accept(prose, input);
    expect(findBannedWords(SEE_TEMPERAMENT_SENTENCE)).toEqual([]);
  });

  it('模板：同一段裡不是氣質段講的標籤照寫（att.inattention 是 ★，別的工具也出，不算氣質段的）', () => {
    const mixed = t2FindingsFixture({
      ATT: { band: 'watch', drivenBy: 'sxk-tempa', tags: ['att.inattention'], caveats: ['parent_report', 'unsourced_threshold'] },
      EMO: { ...EMO_FROM_TEMPERAMENT, tags: ['emo.adaptability_low', 'emo.regulation'] },
    }, { child: { assessedAgeMonth: 24 } });
    const mixedInput = inputFor(mixed);
    const prose = templateProse(mixedInput);
    const att = prose.perDimension.find(d => d.dimensionId === 'ATT')!;
    expect(att.whatWeSaw).toContain(TAG_SENTENCES['att.inattention']);
    const emo = prose.perDimension.find(d => d.dimensionId === 'EMO')!;
    expect(emo.whatWeSaw).toContain(TAG_SENTENCES['emo.regulation']);
    expect(emo.whatWeSaw).not.toContain(TAG_SENTENCES['emo.adaptability_low']);
    expect(emo.whatWeSaw).not.toContain(SEE_TEMPERAMENT_SENTENCE);
    accept(prose, mixedInput);
  });

  it('模板：六個情緒的氣質段標籤各自單獨推出情緒 watch 時，段落字數都在範圍內', () => {
    const emoTags = TEMPERAMENT_REPORT_TAGS.filter(t => t.startsWith('emo.'));
    expect(emoTags).toHaveLength(6);
    for (const tag of emoTags) {
      for (const drivenBy of ['sxk-tempa', 'sxk-tempb'] as const) {
        const one = t2FindingsFixture({ EMO: { band: 'watch', drivenBy, tags: [tag] } });
        const oneInput = inputFor(one);
        const prose = templateProse(oneInput);
        expect(prose.perDimension[0].whatWeSaw, tag).toContain(SEE_TEMPERAMENT_SENTENCE);
        accept(prose, oneInput);
      }
    }
  });

  it('氣質段塞不下的標籤句留在維度段落，不會兩邊都沒有（1–3 個情緒的氣質標籤，全部組合 × tempa／tempb）', () => {
    // 氣質段扣掉開場與收尾只剩約 67 字（兩句），情緒段約 89 字（三句）—— 三個以內一定有一段講得到
    const emoTags = TEMPERAMENT_REPORT_TAGS.filter(t => t.startsWith('emo.'));
    const subsets: FindingTag[][] = [];
    for (let mask = 1; mask < 1 << emoTags.length; mask++) {
      const s = emoTags.filter((_, i) => mask & (1 << i));
      if (s.length <= 3) subsets.push(s);
    }
    expect(subsets).toHaveLength(6 + 15 + 20);
    for (const tags of subsets) {
      for (const drivenBy of ['sxk-tempa', 'sxk-tempb'] as const) {
        const one = t2FindingsFixture({ EMO: { band: 'watch', drivenBy, tags } });
        const oneInput = inputFor(one);
        const prose = templateProse(oneInput);
        const emo = prose.perDimension.find(d => d.dimensionId === 'EMO')!;
        for (const t of tags) {
          const said = emo.whatWeSaw.includes(TAG_SENTENCES[t]) || prose.temperament!.includes(TAG_SENTENCES[t]);
          expect({ tags, t, said }).toEqual({ tags, t, said: true });
          // 兩段都講就是重複（§4.4）
          const both = emo.whatWeSaw.includes(TAG_SENTENCES[t]) && prose.temperament!.includes(TAG_SENTENCES[t]);
          expect({ tags, t, both }).toEqual({ tags, t, both: false });
        }
        accept(prose, oneInput);
      }
    }
  });

  it('審查找到的那一組：D1、D2 先佔滿氣質段，推出判定的 D4 那一句留在情緒段', () => {
    const tags: FindingTag[] = ['emo.activity_high', 'emo.regularity_low', 'emo.adaptability_low'];
    const one = t2FindingsFixture({ EMO: { band: 'watch', drivenBy: 'sxk-tempa', tags } });
    const prose = templateProse(inputFor(one));
    const emo = prose.perDimension.find(d => d.dimensionId === 'EMO')!;
    expect(prose.temperament).not.toContain(TAG_SENTENCES['emo.adaptability_low']);
    expect(emo.whatWeSaw).toContain(TAG_SENTENCES['emo.adaptability_low']);
    expect(emo.whatWeSaw).not.toContain(SEE_TEMPERAMENT_SENTENCE);
  });

  it('不是氣質推出的段落不受影響：感覺 watch 由 spa 推、帶 tempb 的 sen.threshold_low → 那一句照寫', () => {
    const sen = t2FindingsFixture({
      SEN: { band: 'watch', drivenBy: 'sxk-spa', tags: ['sen.threshold_low'], tools: ['sxk-spa', 'sxk-tempb'] },
    });
    const senInput = inputFor(sen);
    const prose = templateProse(senInput);
    const entry = prose.perDimension.find(d => d.dimensionId === 'SEN')!;
    expect(entry.whatWeSaw).toContain(TAG_SENTENCES['sen.threshold_low']);
    expect(entry.whatWeSaw).not.toContain(SEE_TEMPERAMENT_SENTENCE);
    const { user } = buildProsePrompt(senInput);
    expect(user.slice(user.indexOf('- SEN'), user.indexOf('【气质标签】')))
      .toContain(`sen.threshold_low＝${TAG_SENTENCES['sen.threshold_low']}`);
    accept(prose, senInput);
  });

  it('提示：維度那一格的發現標籤不列氣質段的標籤，另說明它們寫在 temperament、這一段不要重複', () => {
    const { user } = buildProsePrompt(input);
    const block = user.slice(user.indexOf('- EMO'), user.indexOf('【气质标签】'));
    expect(block).not.toContain(`emo.adaptability_low＝`);
    expect(block).toContain('emo.adaptability_low');
    expect(block).toContain('temperament');
    expect(block).toContain('不要重复');
    // 氣質那一格照列，並點名這幾個一定要講到（維度段落已經讓出來了）
    const temperamentBlock = user.slice(user.indexOf('【气质标签】'));
    expect(temperamentBlock).toContain(`emo.adaptability_low＝${TAG_SENTENCES['emo.adaptability_low']}`);
    expect(temperamentBlock).toContain('一定要讲到');
  });
});

describe('v2.1 S06：只能當加測的判定帶兩條 caveat，報告兩條路都講', () => {
  // 96 個月語言紅、做了 ldp（语言处理 9 分）→ 語言 refer（`t2Findings.test.ts` 的 S06 那組）
  const LANG_FROM_FACET: DimensionFixture = {
    band: 'refer',
    drivenBy: 'sxk-ldp',
    caveats: ['parent_report', 'unsourced_threshold', 'facet_only', 'no_star_tool'],
  };
  const findings = t2FindingsFixture({ LANG: LANG_FROM_FACET }, { child: { assessedAgeMonth: 96 } });
  const input = inputFor(findings);

  it('模板：語言段 caveats 三條（unsourced_threshold、facet_only、no_star_tool），固定句原樣', () => {
    const prose = templateProse(input);
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    expect(lang.caveats).toEqual([
      CAVEAT_SENTENCES.unsourced_threshold, CAVEAT_SENTENCES.facet_only, CAVEAT_SENTENCES.no_star_tool,
    ]);
    expect(CAVEAT_SENTENCES.facet_only).toContain('题数少，仅供参考');
    expect(CAVEAT_SENTENCES.no_star_tool).toBe(`${SCHOOL_AGE_NO_TOOL_SENTENCE}。`);
    accept(prose, input);
  });

  it('提示：兩條的代號與固定句都在，條數寫 3', () => {
    const { user } = buildProsePrompt(input);
    expect(user).toContain(`facet_only＝${CAVEAT_SENTENCES.facet_only}`);
    expect(user).toContain(`no_star_tool＝${CAVEAT_SENTENCES.no_star_tool}`);
    expect(user).toContain('caveats（3 条，一条都不能少）');
  });

  it('少寫一條 → 拒', () => {
    const prose = templateProse(input);
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    expect(reject(withDimension(prose, 'LANG', { caveats: lang.caveats.slice(1) }), input).join('\n')).toContain('facet_only');
  });
});

/**
 * v2.1 S05（§4.6、§3.6，客戶 9/21 工作單 #6）：6 歲以上的認知、語言、動作沒有星號。
 *
 * 固定句本身由規則輸出、畫面直接顯示（`no_tool` 時是九宮格與 no_tool 段標題旁的狀態句，`t2ReportCopy.test.ts`；
 * 只能當加測判出留意／關注時是 `no_star_tool` 那一條 caveat）。這裡釘文字那一層的兩件事：
 * 1. 段落不得講「等孩子長到適用的月齡再補做」——對它們永遠不會成真。模板換一版、AI 提示明說、驗證器擋常見寫法。
 * 2. `no_star_tool` 那一條 caveat 就是固定句，AI 不能改寫它（§3.6）：驗證器要它原樣。
 * 其他 no_tool（感覺 0–23、學習 37–71、情緒 0–11）長大後確實有工具，句子不變。
 */
describe('v2.1 S05：6 歲以上的認知、語言、動作沒有家長自填工具', () => {
  const PROMISE = '等孩子长到适用的月龄，我们会再提醒你补做';
  // 80 個月語言紅、什麼都沒做：走真的 buildT2Findings → 語言 no_tool
  const findings = buildT2Findings({
    results: [],
    t1Flags: { COG: 0, LANG: 2, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0 },
    assessedAgeMonth: 80,
    computedAt: '2026-09-24T00:00:00.000Z',
  });
  const input = inputFor(findings);

  /** 提示裡某一個維度的那一格（從「- LANG（」到下一個維度或空行）。 */
  function blockOf(user: string, code: DimensionCode): string {
    const at = user.indexOf(`- ${code}（`);
    expect(at, code).toBeGreaterThanOrEqual(0);
    const rest = user.slice(at + 1);
    const end = Math.min(...['\n- ', '\n\n'].map(s => rest.indexOf(s)).filter(i => i >= 0));
    return rest.slice(0, end);
  }

  it('先確認形狀：語言 no_tool', () => {
    expect(findings.dimensions.find(d => d.dimensionId === 'LANG')!.band).toBe('no_tool');
  });

  it('模板：語言段不講「等孩子长到适用的月龄……补做」，也不照抄固定句（畫面標題旁已經有）；過驗證器', () => {
    const prose = templateProse(input);
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    for (const text of [lang.whatWeSaw, lang.whyItMatters]) {
      expect(text).not.toContain('补做');
      expect(text).not.toContain('适用的月龄');
      expect(text).not.toContain(SCHOOL_AGE_NO_TOOL_SENTENCE);
    }
    accept(prose, input);
  });

  it.each([
    ['SEN', 12], ['EMO', 6], ['LEARN', 48],
  ] as const)('模板：其他 no_tool 句子不變（%s %i 個月仍講長大後補做）', (code, month) => {
    const other = t2FindingsFixture({ [code]: { band: 'no_tool', t1Flag: 2 } }, { child: { assessedAgeMonth: month } });
    const otherInput = inputFor(other);
    const prose = templateProse(otherInput);
    expect(prose.perDimension.find(d => d.dimensionId === code)!.whatWeSaw).toContain(PROMISE);
    accept(prose, otherInput);
  });

  it('模板：三個維度 × 73／144／216 個月 × 有沒有標籤，字數都落在範圍裡、過驗證器', () => {
    for (const code of ['COG', 'LANG', 'MOT'] as const) {
      for (const month of [73, 144, 216]) {
        for (const tags of [[], [FINDING_TAGS.find(t => t.startsWith(code.toLowerCase()))!]]) {
          const f = t2FindingsFixture({ [code]: { band: 'no_tool', t1Flag: 2, tags } }, { child: { assessedAgeMonth: month } });
          const i = inputFor(f);
          const prose = templateProse(i);
          const entry = prose.perDimension.find(d => d.dimensionId === code)!;
          const where = `${code}/${month}/${tags.length} 個標籤`;
          expect(entry.whatWeSaw, where).not.toContain('补做');
          expect(charCount(entry.whatWeSaw), where).toBeGreaterThanOrEqual(CHAR_RANGES.whatWeSaw.min);
          expect(charCount(entry.whatWeSaw), where).toBeLessThanOrEqual(CHAR_RANGES.whatWeSaw.max);
          accept(prose, i);
        }
      }
    }
  });

  it('提示：語言那一格註明 6 歲以上沒有家長自填工具、不得寫長大後可補做；其他 no_tool 那一格沒有這一句', () => {
    const { user } = buildProsePrompt(input);
    expect(blockOf(user, 'LANG')).toContain(SCHOOL_AGE_PROMPT_NOTE);
    expect(SCHOOL_AGE_PROMPT_NOTE).toContain('补做');

    const young = inputFor(t2FindingsFixture({ SEN: { band: 'no_tool', t1Flag: 2 } }, { child: { assessedAgeMonth: 12 } }));
    expect(buildProsePrompt(young).user).not.toContain(SCHOOL_AGE_PROMPT_NOTE);
  });

  it.each([
    ['whatWeSaw', '等孩子长大后可以再补做。'],
    ['whyItMatters', '长大以后再补测一次。'],
  ] as const)('驗證器：AI 在 6 歲以上的語言段（%s）寫「長大後補做」→ 拒，而且是因為這件事', (field, promise) => {
    const prose = templateProse(input);
    const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
    // 其餘條件都合格（字數在範圍內），被拒只會是因為那一句
    const broken = `${lang[field].slice(0, CHAR_RANGES[field].min)}${promise}`;
    expect(charCount(broken)).toBeLessThanOrEqual(CHAR_RANGES[field].max);
    const errors = reject(withDimension(prose, 'LANG', { [field]: broken }), input);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`LANG.${field}`);
  });

  it('驗證器：感覺 12 個月的 no_tool 段講長大後補做 → 過（它長大後確實有工具）', () => {
    const young = inputFor(t2FindingsFixture({ SEN: { band: 'no_tool', t1Flag: 2 } }, { child: { assessedAgeMonth: 12 } }));
    const youngProse = templateProse(young);
    expect(youngProse.perDimension.find(d => d.dimensionId === 'SEN')!.whatWeSaw).toContain('补做');
    accept(youngProse, young);
  });

  describe('做了只能當加測、判出留意／關注（帶 no_star_tool）', () => {
    // 96 個月語言紅、做了 ldp → 語言 refer（`t2Findings.test.ts` 的 S06 那組）
    const facet = t2FindingsFixture(
      { LANG: { band: 'refer', drivenBy: 'sxk-ldp', caveats: ['parent_report', 'unsourced_threshold', 'facet_only', 'no_star_tool'] } },
      { child: { assessedAgeMonth: 96 } },
    );
    const facetInput = inputFor(facet);

    it('模板：固定句只在 caveats 出現一次（原樣），段落本身不重複它、不講補做', () => {
      const lang = templateProse(facetInput).perDimension.find(d => d.dimensionId === 'LANG')!;
      expect(lang.caveats.filter(c => c.includes(SCHOOL_AGE_NO_TOOL_SENTENCE))).toEqual([CAVEAT_SENTENCES.no_star_tool]);
      expect(lang.whatWeSaw).not.toContain(SCHOOL_AGE_NO_TOOL_SENTENCE);
      expect(lang.whatWeSaw).not.toContain('补做');
    });

    it('提示：no_star_tool 那一條要原樣照抄；語言那一格一樣註明不得寫長大後可補做', () => {
      const block = blockOf(buildProsePrompt(facetInput).user, 'LANG');
      expect(block).toContain(SCHOOL_AGE_PROMPT_NOTE);
      expect(block).toContain(`no_star_tool 这一条原样照抄：${CAVEAT_SENTENCES.no_star_tool}`);
    });

    it('驗證器：條數對、但把固定句改寫了 → 拒（§3.6 固定句不交給 AI 改寫）', () => {
      const prose = templateProse(facetInput);
      const lang = prose.perDimension.find(d => d.dimensionId === 'LANG')!;
      const rewritten = lang.caveats.map(c => (c === CAVEAT_SENTENCES.no_star_tool ? '六岁以后这几项没有在家填的问卷，可以去医院看看。' : c));
      expect(reject(withDimension(prose, 'LANG', { caveats: rewritten }), facetInput).join('\n')).toContain('no_star_tool');
    });
  });
});

describe('v2.1 S08：不篩的維度總覽不提、沒有段落，兩條路都一樣', () => {
  // 10 個月、語言／學習／注意力／情緒紅、什麼都沒做：走真的 buildT2Findings →
  // 語言 partial、情緒 no_tool（0–11 仍是「此年龄尚无适用工具」）、學習與注意力 not_screened
  const findings = buildT2Findings({
    results: [],
    t1Flags: { COG: 0, LANG: 2, SOC: 0, EMO: 2, ATT: 2, MOT: 0, SEN: 0, ADL: 0, LEARN: 2 },
    assessedAgeMonth: 10,
    computedAt: '2026-09-24T00:00:00.000Z',
  });
  const input = inputFor(findings);
  const hidden = [SITE_DIMENSION_NAME.LEARN, SITE_DIMENSION_NAME.ATT];

  it('先確認形狀：學習、注意力是 not_screened，情緒 no_tool、語言 partial', () => {
    const band = Object.fromEntries(findings.dimensions.map(d => [d.dimensionId, d.band]));
    expect(band).toMatchObject({ LEARN: 'not_screened', ATT: 'not_screened', EMO: 'no_tool', LANG: 'partial' });
  });

  it('模板：段落只有情緒（no_tool）；總覽一個字都不提學習、注意力；過驗證器', () => {
    const prose = templateProse(input);
    expect(prose.perDimension.map(d => d.dimensionId)).toEqual(['EMO']);
    for (const name of hidden) expect(prose.overview, name).not.toContain(name);
    accept(prose, input);
  });

  it('不篩的維度帶著標籤也一樣（24 個月氣質落在學習的 learn.task_persistence）：模板不寫、驗證器不要它', () => {
    const tagged = t2FindingsFixture(
      { LEARN: { band: 'not_screened', t1Flag: 2, tags: ['learn.task_persistence'], tools: ['sxk-tempa'] } },
      { child: { assessedAgeMonth: 24 } },
    );
    const taggedInput = inputFor(tagged);
    const prose = templateProse(taggedInput);
    expect(prose.perDimension).toEqual([]);
    expect(prose.overview).not.toContain(SITE_DIMENSION_NAME.LEARN);
    expect(JSON.stringify(prose)).not.toContain(TAG_SENTENCES['learn.task_persistence']);
    accept(prose, taggedInput);
  });

  it('驗證器：AI 替不篩的維度寫了一段 → 拒（維度集合對不上）', () => {
    const prose = templateProse(input);
    const extra = { ...prose.perDimension[0], dimensionId: 'LEARN' as const };
    expect(reject({ ...prose, perDimension: [...prose.perDimension, extra] }, input).join('\n')).toContain('LEARN(not_screened)');
  });

  it('提示：要寫段落的維度只列情緒；學習、注意力不在素材裡', () => {
    const { user } = buildProsePrompt(input);
    expect(user).toContain(`- EMO（家长看到的名称：${SITE_DIMENSION_NAME.EMO}）：判定 no_tool`);
    for (const code of ['LEARN', 'ATT']) expect(user, code).not.toContain(`- ${code}（`);
    for (const name of hidden) expect(user, name).not.toContain(name);
    expect(user).not.toContain('not_screened');
  });
});

// ---------------------------------------------------------------------------
// 六、兩張字表本身
// ---------------------------------------------------------------------------

describe('固定說法的字表', () => {
  it('57 個標籤一個不漏、一個不多', () => {
    expect(Object.keys(TAG_SENTENCES).sort()).toEqual([...FINDING_TAGS].sort());
  });

  it('19 個 caveat 一個不漏（v2.1 加 facet_only、no_star_tool）；只有 parent_report 沒有句子（§5.6 不單獨成句）', () => {
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
