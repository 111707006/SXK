import { describe, it, expect } from 'vitest';
import { recommend } from '../src/t2/recommend/engine';
import type { DxCode, Level, RecommendInput } from '../src/t2/recommend/types';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode } from '../src/t2/types';

/**
 * 客規 §12 的 10 個示例案例（客戶寫的 IT「核心验收案例」，V1）。輸入、量表、順序、理由、移除、提示、T3、分鐘逐字抄自客規。
 * 關鍵題作答：客規寫「第 N 题＝还不能／有时」，這裡換成 `${維度}_${N-1}` → 2／1。
 */

function input(ageM: number, dx: DxCode[], school: boolean, levels: Partial<Record<DimensionCode, Level>>, rfdims: DimensionCode[], items: Record<string, 0 | 1 | 2> = {}): RecommendInput {
  return {
    ageM,
    levels: Object.fromEntries(DIMENSION_CODES.map(d => [d, levels[d] ?? 0])) as Record<DimensionCode, Level>,
    rfdims,
    items,
    dx,
    school,
    done: [],
    extraTags: [],
    hearingChecked: null,
  };
}

interface Case {
  title: string;
  input: RecommendInput;
  tools: Array<[string, string]>;
  minutes: number;
  removed?: Array<[string, string]>;
  notes?: string[];
  t3?: string[];
}

const PREREQ = '前置条件：语言落后须先确认听力检查结果。';

const CASES: Case[] = [
  {
    title: '案例 1　1 岁 10 个月，无诊断，家长担心不太理人',
    input: input(22, [], true, { LANG: 2, SOC: 2, ATT: 2, COG: 1 }, ['ATT'], { ATT_0: 2, ATT_2: 2, LANG_1: 2, LANG_3: 1, SOC_3: 2 }),
    tools: [
      ['M-CHAT-R/F', '规则 R1：16–30 个月出现社交沟通警讯题'],
      ['SXK-PLC', 'P3 语言沟通（T1 中度）'],
      ['SXK-ASB', '深度：社交互动 第二份（红旗）'],
      ['SXK-ADP', 'P4 认知（T1 轻度）'],
    ],
    minutes: 80,
    notes: [PREREQ, '缺口：注意力与执行 在 22 个月没有可用的家长／教师问卷——改为治疗师当面评估。'],
    t3: [],
  },
  {
    title: '案例 2　3 岁，已诊断语言发展障碍，只会说单词',
    input: input(36, ['LANG'], true, { LANG: 3, SOC: 1, EMO: 1 }, ['LANG'], { LANG_0: 2, LANG_1: 2 }),
    tools: [
      ['SXK-PLC', 'P1 语言沟通（红旗）'],
      ['SXK-VOC', '深度：语言沟通 第二份（红旗）'],
      ['SXK-SOC', 'P4 社交互动（T1 轻度）'],
      ['SXK-EMO', 'P4 情绪与行为（T1 轻度）'],
    ],
    minutes: 85,
    removed: [['SXK-QOL', '功能基线：疗前疗后对照']],
    notes: [PREREQ],
    t3: ['SXK-ART', 'SXK-PLE'],
  },
  {
    title: '案例 3　4 岁 6 个月，无诊断，T1 语言明显落后＋社交中度＋注意力轻度',
    input: input(54, [], true, { LANG: 3, SOC: 2, ATT: 1 }, ['LANG'], { LANG_1: 2, LANG_3: 2 }),
    tools: [
      ['SXK-LQ', 'P1 语言沟通（红旗）'],
      ['SXK-SOC', 'P3 社交互动（T1 中度）'],
      ['SXK-LANG', '深度：语言沟通 第二份（红旗）'],
      ['SXK-AB', 'P4 注意力与执行（T1 轻度）'],
    ],
    minutes: 90,
    removed: [['SXK-QOL', '功能基线：疗前疗后对照']],
    notes: [PREREQ],
    t3: ['SXK-ART', 'SXK-PLE', 'SXK-NAR'],
  },
  {
    title: '案例 4　5 岁，疑似自闭症，感觉敏感明显',
    input: input(60, ['ASD'], true, { SOC: 2, LANG: 1, SEN: 3, EMO: 2 }, []),
    tools: [
      ['SXK-ASB', '诊断必选：自闭症（孤独症谱系）'],
      ['SXK-LQ', 'P2 语言沟通（诊断核心）'],
      ['SXK-SPb', 'P3 感觉处理（T1 明显）'],
      ['SXK-EMO', 'P3 情绪与行为（T1 中度）'],
    ],
    minutes: 70,
    removed: [['SXK-SOC', '深度：社交互动 第二份（诊断核心）']],
  },
  {
    title: '案例 5　8 岁，学习障碍＋多动症，识字红旗',
    input: input(100, ['LDADHD'], true, { ATT: 2, LEARN: 3, EMO: 1 }, ['LEARN'], { LEARN_0: 2, LANG_3: 1 }),
    tools: [
      ['SXK-LDP', 'P1 学习能力（红旗）'],
      ['SNAP-IV', 'P2 注意力与执行（诊断核心）'],
      ['SXK-ATT', '深度：注意力与执行 第二份（诊断核心）'],
      ['SXK-EMO', 'P4 情绪与行为（T1 轻度）'],
      ['SXK-QOL', '功能基线：疗前疗后对照'],
    ],
    minutes: 75,
    t3: ['SXK-WISC'],
  },
  {
    title: '案例 6　3 岁 4 个月，脑瘫（痉挛型双瘫）',
    input: input(40, ['CP'], true, { MOT: 3, ADL: 2, LANG: 1 }, ['MOT'], { MOT_0: 2 }),
    tools: [
      ['SXK-GM', '诊断必选：脑性瘫痪'],
      ['SXK-ADL', '诊断必选：脑性瘫痪'],
      ['SXK-QOL', '诊断必选：脑性瘫痪'],
      ['SXK-ASQ3', '深度：动作发展 第二份（红旗）'],
      ['SXK-LQ', 'P4 语言沟通（T1 轻度）'],
    ],
    minutes: 90,
    notes: ['医疗：动作红旗（未独走／步态异常）——同步建议儿童神经科或康复医学科就诊。'],
    t3: ['SXK-SMA'],
  },
  {
    title: '案例 7　13 岁，情绪障碍，近两周持续低落',
    input: input(160, ['EMO'], true, { EMO: 3, SOC: 1, LEARN: 1 }, ['EMO'], { EMO_3: 2 }),
    tools: [
      ['SXK-QOL', '诊断必选：情绪障碍与心理障碍'],
      ['SXK-AB', 'P1 情绪与行为（红旗）'],
      ['SXK-LDS', 'P4 学习能力（T1 轻度）'],
      ['SXK-ASR', 'P4 社交互动（T1 轻度）'],
    ],
    minutes: 70,
    notes: [
      '安全：持续低落／自我否定未通过——先转介心理或精神科，当天告知家长；情绪量表由专业人员陪同填写。',
      '缺口：情绪与行为 在 160 个月没有主测该维度的问卷，暂以 SXK-AB（次要涵盖）替代，并建议当面评估。',
    ],
  },
  {
    title: '案例 8　5 岁，无诊断，五项以上中度落后（全面落后模式）',
    input: input(60, [], true, { MOT: 2, COG: 2, LANG: 3, SOC: 2, ADL: 2, LEARN: 2, ATT: 1 }, []),
    tools: [
      ['SXK-ASQ3', '规则 R5：五项以上中度落后（全面落后模式），先用跨领域量表'],
      ['SXK-ADL', 'P3 生活自理与适应（T1 中度）'],
      ['SXK-ADP', 'P3 学习能力（T1 中度）'],
      ['SXK-LQ', '深度：语言沟通 第二份（明显落后）'],
    ],
    minutes: 80,
    removed: [['SXK-AB', 'P4 注意力与执行（T1 轻度）']],
    notes: [PREREQ, '缺口：学习能力 在 60 个月没有主测该维度的问卷，暂以 SXK-ADP（次要涵盖）替代，并建议当面评估。'],
    t3: ['SXK-PLE', 'SXK-SMA', 'SXK-WISC'],
  },
  {
    title: '案例 10　4 岁，无诊断，未上幼儿园，注意力与情绪中度',
    input: input(48, [], false, { ATT: 2, EMO: 2, SEN: 1 }, []),
    tools: [
      ['SXK-AB', 'P3 注意力与执行（T1 中度）'],
      ['SXK-EMO', 'P3 情绪与行为（T1 中度）'],
      ['SXK-SP', 'P4 感觉处理（T1 轻度）'],
      ['SXK-QOL', '功能基线：疗前疗后对照'],
    ],
    minutes: 60,
  },
];

describe('客規 §12 示例案例', () => {
  it.each(CASES.map(c => [c.title, c] as const))('%s', (_, c) => {
    const r = recommend(c.input);
    expect(r.status).toBe('RECOMMEND');
    expect(r.tools.map(t => [t.code, t.reason])).toEqual(c.tools);
    expect(r.parentMinutes).toBe(c.minutes);
    expect(r.removed.map(x => [x.code, x.reason])).toEqual(c.removed ?? []);
    const texts = [...r.alerts.map(a => a.text), ...r.gaps];
    for (const n of c.notes ?? []) expect(texts).toContain(n);
    if (c.t3) expect(r.t3.map(t => t.code)).toEqual(c.t3);
  });

  it('案例 9　7 岁，无诊断，九项均未见明显落后 → 不推荐第二层', () => {
    const r = recommend(input(84, [], true, {}, []));
    expect(r.status).toBe('NO_T2');
    expect(r.tools).toEqual([]);
  });

  it('前兩份是第一次填寫、其餘第二次；規則／診斷必選／P1 標成必選', () => {
    const r = recommend(CASES[5].input);
    expect(r.tools.map(t => t.session)).toEqual([1, 1, 2, 2, 2]);
    expect(r.tools.map(t => t.mandatory)).toEqual([true, true, true, false, false]);
  });
});
