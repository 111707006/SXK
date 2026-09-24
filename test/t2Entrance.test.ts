import { describe, it, expect } from 'vitest';
import { planT2 } from '../src/t2/routing';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag } from '../src/t2/types';
import {
  DIAGNOSIS_OPTIONS,
  DIAGNOSIS_QUESTION,
  NO_DIAGNOSIS_LABEL,
  isDiagnosisDirection,
  readDiagnosisDirection,
} from '../src/t2/diagnosisOptions';
import {
  describePlan,
  describePlanItem,
  entranceState,
  expertOnlyCopy,
  flaggedDimensions,
  noToolNotes,
  t1FlagsFromScores,
} from '../src/t2/entrance';
import { SITE_DIMENSION_NAME } from '../src/t2/dimensionMap';
import { SCHOOL_AGE_NO_TOOL_SENTENCE } from '../src/t2/report/sentences';
import { findBannedWords } from '../src/utils/parentWording';

/**
 * 家長端 T2 入口的純函式層（票 #56）：T1 成績 → 九碼標記、入口要不要出現、題量怎麼講。
 * 畫面本身沒有 jsdom 看不到，能測的都抽到這裡。
 */

const GREEN: Record<DimensionCode, T1Flag> = {
  COG: 0, LANG: 0, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0,
};

function score(dimensionId: string, status: 'normal' | 'borderline' | 'delay', tierId: 'T1' | 'T2' | 'T3' = 'T1') {
  return { dimensionId, status, tierId };
}

describe('t1FlagsFromScores：篩查結果 → 九碼標記', () => {
  it('紅 2、黃 1、綠 0，九個 key 都在', () => {
    const flags = t1FlagsFromScores([
      score('language', 'delay'),
      score('attention', 'delay'),
      score('sensory_processing', 'borderline'),
      score('cognitive', 'normal'),
    ]);
    expect(Object.keys(flags).sort()).toEqual([...DIMENSION_CODES].sort());
    expect(flags).toMatchObject({ LANG: 2, ATT: 2, SEN: 1, COG: 0 });
  });

  it('沒篩到的維度是 0，不是缺 key —— planT2 少一個 key 會丟錯', () => {
    const flags = t1FlagsFromScores([score('language', 'delay')]);
    for (const d of DIMENSION_CODES) expect(flags[d]).toBe(d === 'LANG' ? 2 : 0);
  });

  it('只看 T1：T2／T3 的成績不算 T1 標記', () => {
    const flags = t1FlagsFromScores([score('language', 'delay', 'T2'), score('attention', 'delay', 'T3')]);
    expect(flags).toEqual(GREEN);
  });

  it('認不得的 dimensionId 不算，也不丟錯', () => {
    expect(t1FlagsFromScores([score('fine_motor', 'delay')])).toEqual(GREEN);
  });
});

/**
 * 客戶 9/21 工作單 #1 要「T1 四級各一條」（重度、中度 → 紅；輕度 → 黃；未見明顯 → 綠）。
 * 那是原型的四級；A 的 T1 只有三級，所以這裡是三條（規格 v2.1 S01）：
 * 客戶的重度與中度＝`delay`、輕度＝`borderline`、未見明顯＝`normal`。
 * 從篩查結果一路走到入口，中間任何一層改了對應都會在這裡斷。
 */
describe('T1 三級 → T2 推不推（v2.1 S01）', () => {
  const pushed = (status: 'normal' | 'borderline' | 'delay') => {
    const flags = t1FlagsFromScores([score('language', status)]);
    const plan = planT2(flags, 48);
    return {
      required: plan.required.map(i => i.toolId),
      optional: plan.optional.map(i => i.toolId),
      followup: plan.followup.map(i => i.toolId),
      entrance: entranceState(plan, flags),
    };
  };

  it('delay → 紅 → 星號必做', () => {
    expect(pushed('delay')).toMatchObject({ required: ['sxk-lang'], optional: [], entrance: 'show' });
  });

  it('borderline → 黃 → 星號選做', () => {
    expect(pushed('borderline')).toMatchObject({ required: [], optional: ['sxk-lang'], entrance: 'show' });
  });

  it('normal → 綠 → 不推：沒有必做、選做、加測，入口不出現', () => {
    expect(pushed('normal')).toEqual({ required: [], optional: [], followup: [], entrance: 'none' });
  });
});

describe('entranceState：入口要不要出現', () => {
  it('48 個月、LANG 紅、ATT 紅、SEN 黃 → 顯示', () => {
    const flags = { ...GREEN, LANG: 2, ATT: 2, SEN: 1 } as const;
    expect(entranceState(planT2(flags, 48), flags)).toBe('show');
  });

  /** 票的驗收：LANG 紅的 80 個月孩子（LANG no_tool、其餘綠）→ 不顯示入口，顯示專家導向。 */
  it('80 個月、只有 LANG 紅 → 被標記的維度全是 no_tool → 只導向專家', () => {
    const flags = { ...GREEN, LANG: 2 } as const;
    const plan = planT2(flags, 80);
    expect(plan.noTool).toEqual(['LANG']);
    expect(entranceState(plan, flags)).toBe('expert_only');
  });

  it('全綠 → 什麼都不顯示（沒有東西要做，也沒有專家好導）', () => {
    expect(entranceState(planT2(GREEN, 48), GREEN)).toBe('none');
  });

  it('被標記的維度全是 no_tool，但診斷方向提了必做 → 仍顯示（有東西可答）', () => {
    const flags = { ...GREEN, LANG: 2 } as const;
    const plan = planT2(flags, 80, 'asd');
    expect(plan.noTool).toEqual(['LANG']);
    expect(plan.required.length).toBeGreaterThan(0);
    expect(entranceState(plan, flags)).toBe('show');
  });

  it('一紅一黃、紅的 no_tool、黃的有工具 → 顯示', () => {
    const flags = { ...GREEN, LANG: 2, SEN: 1 } as const;
    const plan = planT2(flags, 80);
    expect(plan.noTool).toEqual(['LANG']);
    expect(entranceState(plan, flags)).toBe('show');
  });

  // v2.1 §4.5「入口：不變」（暫採，§9 第 2 題）：只有「仅供参考」的加測可答時不收費、導專家
  it('96 個月語言、動作紅 → 只有加測（ldp、adl）可答、沒有星號 → 仍只導向專家', () => {
    const flags = { ...GREEN, LANG: 2, MOT: 2 } as const;
    const plan = planT2(flags, 96);
    expect(plan.followup.map(i => i.toolId)).toEqual(['sxk-ldp', 'sxk-adl']);
    expect(plan.noTool).toEqual(['LANG', 'MOT']);
    expect(entranceState(plan, flags)).toBe('expert_only');
  });

  it('24 個月只有情緒紅 → v2 只導專家；v2.1 S07 起有氣質當星號，顯示入口', () => {
    const flags = { ...GREEN, EMO: 2 } as const;
    expect(entranceState(planT2(flags, 24), flags)).toBe('show');
    expect(entranceState(planT2(flags, 8), flags)).toBe('expert_only');     // 情緒 0–11 仍沒有工具
  });

  // v2.1 S08：不篩的維度不算「被標記」。只有它們被標記 → 什麼都不顯示（暫採，§9 第 3 題）——
  // 它們不是「沒有工具、建議找專家」，是這個月齡段 T2 不看這一項
  it('只有不篩的維度被標記（10 個月學習、注意力紅）→ none，不是 expert_only', () => {
    const flags = { ...GREEN, LEARN: 2, ATT: 1 } as const;
    const plan = planT2(flags, 10);
    expect(plan.noTool).toEqual([]);
    expect(entranceState(plan, flags)).toBe('none');
  });

  it('學習 37 個月、注意力 12 個月起回到原本的行為', () => {
    const learn = { ...GREEN, LEARN: 2 } as const;
    expect(entranceState(planT2(learn, 36), learn)).toBe('none');
    expect(entranceState(planT2(learn, 37), learn)).toBe('expert_only');   // 37–71 維持「此年龄尚无适用工具」
    const att = { ...GREEN, ATT: 2 } as const;
    expect(entranceState(planT2(att, 11), att)).toBe('none');
    expect(entranceState(planT2(att, 12), att)).toBe('show');              // tempa 當星號
  });

  it('不篩的維度與沒有工具的維度一起被標記（10 個月學習、情緒紅）→ 只為情緒導專家', () => {
    const flags = { ...GREEN, LEARN: 2, EMO: 2 } as const;
    const plan = planT2(flags, 10);
    expect(plan.noTool).toEqual(['EMO']);
    expect(entranceState(plan, flags)).toBe('expert_only');
  });

  it('不篩的維度與有工具的維度一起被標記（10 個月學習、語言紅）→ 顯示，清單只為語言', () => {
    const flags = { ...GREEN, LEARN: 2, LANG: 2 } as const;
    const plan = planT2(flags, 10);
    expect(entranceState(plan, flags)).toBe('show');
    expect(plan.required.map(i => i.forDimensions)).toEqual([['LANG']]);
  });
});

describe('flaggedDimensions：被標記、而且這個月齡 T2 會評的維度', () => {
  it('紅黃都算、綠不算；不篩的段不算（要看月齡）', () => {
    const flags = { ...GREEN, LEARN: 2, ATT: 1, LANG: 2 } as const;
    expect(flaggedDimensions(flags, 10)).toEqual(['LANG']);
    expect(flaggedDimensions(flags, 12)).toEqual(['LANG', 'ATT']);
    expect(flaggedDimensions(flags, 37)).toEqual(['LANG', 'ATT', 'LEARN']);
  });
});

describe('describePlan：題量怎麼講', () => {
  /** 票的驗收：「需要完成 2 份約 90 題，另有 1 份選做 75 題」。 */
  it('48 個月、LANG 紅、ATT 紅、SEN 黃', () => {
    const plan = planT2({ ...GREEN, LANG: 2, ATT: 2, SEN: 1 }, 48);
    const d = describePlan(plan);
    expect(d.headline).toBe('需要完成 2 份约 90 题，另有 1 份选做约 75 题');
    // 這個月齡 LANG 的加測是 sxk-dev 30 題
    expect(d.followup).toBe('答完之后，可能再加测 1 份约 30 题');
    // tempb 72 ＋ chexi 24：不出判定的補充問卷，不算進上面兩句
    expect(d.extras).toBe('另可选填 2 份补充问卷约 96 题');
  });

  it('只有黃的 → 沒有「需要完成」，直接講選做', () => {
    const plan = planT2({ ...GREEN, SEN: 1 }, 48);
    expect(describePlan(plan).headline).toBe('1 份选做约 75 题');
  });

  it('只有紅的、沒有加測也沒有補充 → 其餘兩句是 null，不是空字串', () => {
    const plan = planT2({ ...GREEN, SEN: 2 }, 48);
    const d = describePlan(plan);
    expect(d.headline).toBe('需要完成 1 份约 75 题');
    expect(d.followup).toBeNull();
    expect(d.extras).toBeNull();
  });

  it('什麼都沒有 → headline 是 null', () => {
    expect(describePlan(planT2(GREEN, 48)).headline).toBeNull();
  });

  it('選了自閉症 → 題量重算（必做變多）', () => {
    const flags = { ...GREEN, LANG: 2, ATT: 2, SEN: 1 } as const;
    const without = describePlan(planT2(flags, 48));
    const withAsd = describePlan(planT2(flags, 48, 'asd'));
    expect(withAsd.headline).not.toBe(without.headline);
    expect(withAsd.headline).toMatch(/^需要完成 7 份约 265 题/);
  });

  it('三句話都過家長用字掃描', () => {
    const plan = planT2({ ...GREEN, LANG: 2, ATT: 2, SEN: 1 }, 48, 'asd');
    const d = describePlan(plan);
    for (const s of [d.headline, d.followup, d.extras]) {
      if (s) expect(findBannedWords(s), s).toEqual([]);
    }
  });
});

/**
 * 沒有工具的維度在入口上怎麼講（§4.5；v2.1 §4.6、S05）。6 歲以上的認知、語言、動作沒有星號時，
 * 換成客戶 9/21 工作單 #6 的固定句（原樣）；其他 no_tool（感覺 0–23、學習 37–71、情緒 0–11）句子不變。
 */
describe('noToolNotes／expertOnlyCopy：沒有工具的維度怎麼講（v2.1 S05）', () => {
  const FIXED = '6 岁以上的认知、语言、动作目前没有家长自填工具，建议到院做专业评估';
  const GENERIC = '这个年龄目前没有适用的深度评估工具，建议直接预约专家';
  const n = SITE_DIMENSION_NAME;

  it('80 個月只有語言紅 → 語言那一段是固定句；入口只導專家，標題就是那一句', () => {
    const flags = { ...GREEN, LANG: 2 } as const;
    const plan = planT2(flags, 80);
    expect(entranceState(plan, flags)).toBe('expert_only');
    expect(noToolNotes(plan)).toEqual([{ dimensions: ['LANG'], sentence: FIXED, text: `「${n.LANG}」：${FIXED}。` }]);
    expect(expertOnlyCopy(plan)).toEqual({ headline: FIXED, notes: [] });
    expect(SCHOOL_AGE_NO_TOOL_SENTENCE).toBe(FIXED);
  });

  it('80 個月語言紅、黃的感覺有工具 → 入口顯示，清單下方語言那一段是固定句', () => {
    const flags = { ...GREEN, LANG: 2, SEN: 1 } as const;
    const plan = planT2(flags, 80);
    expect(entranceState(plan, flags)).toBe('show');
    expect(noToolNotes(plan).map(x => x.text)).toEqual([`「${n.LANG}」：${FIXED}。`]);
  });

  it('96 個月語言、動作紅（只有加測可答）→ 兩個維度併成一段固定句', () => {
    const plan = planT2({ ...GREEN, LANG: 2, MOT: 2 }, 96);
    expect(noToolNotes(plan)).toEqual([{ dimensions: ['LANG', 'MOT'], sentence: FIXED, text: `「${n.LANG}、${n.MOT}」：${FIXED}。` }]);
    expect(expertOnlyCopy(plan)).toEqual({ headline: FIXED, notes: [] });
  });

  it.each([
    ['情緒 10 個月', { EMO: 2 }, 10, ['EMO']],
    ['感覺 12 個月', { SEN: 2 }, 12, ['SEN']],
    ['學習 48 個月', { LEARN: 1 }, 48, ['LEARN']],
  ] as const)('其他 no_tool 句子不變：%s', (_label, flagged, month, dims) => {
    const plan = planT2({ ...GREEN, ...flagged }, month);
    expect(plan.noTool).toEqual(dims);
    const names = dims.map(d => n[d]).join('、');
    expect(noToolNotes(plan)).toEqual([{ dimensions: dims, sentence: GENERIC, text: `「${names}」${GENERIC}。` }]);
    expect(expertOnlyCopy(plan)).toEqual({ headline: GENERIC, notes: [] });
  });

  // 181 個月起感覺、日常生活暫時沒有工具（SPb、ADL 放寬到 216 是 S19，等新包），與 6 歲以上那三個會同時出現
  it('190 個月語言、感覺紅 → 兩段各講各的；只導專家時標題用一般那句，固定句另列一段、不重複', () => {
    const plan = planT2({ ...GREEN, LANG: 2, SEN: 2 }, 190);
    expect(plan.noTool).toEqual(['LANG', 'SEN']);
    expect(noToolNotes(plan).map(x => x.text)).toEqual([`「${n.LANG}」：${FIXED}。`, `「${n.SEN}」${GENERIC}。`]);
    expect(expertOnlyCopy(plan)).toEqual({ headline: GENERIC, notes: [`「${n.LANG}」：${FIXED}。`] });
  });

  it('沒有 no_tool → 沒有段落', () => {
    expect(noToolNotes(planT2({ ...GREEN, LANG: 2 }, 48))).toEqual([]);
  });

  it('每一段都過家長用字掃描', () => {
    const plan = planT2({ ...GREEN, LANG: 2, SEN: 2, COG: 1 }, 190);
    for (const x of noToolNotes(plan)) expect(findBannedWords(x.text), x.text).toEqual([]);
  });
});

describe('describePlanItem：一支工具在清單上怎麼講', () => {
  it('用維度名稱與題數，不用工具名', () => {
    const plan = planT2({ ...GREEN, LANG: 2 }, 48);
    const [lang] = plan.required;
    expect(lang.toolId).toBe('sxk-lang');
    expect(describePlanItem(lang)).toBe('语言沟通 · 49 题');
  });

  it('餵多個維度的工具把維度名並列', () => {
    // 48 個月選發展遲緩：sxk-dev 餵五個維度
    const plan = planT2({ ...GREEN, LANG: 2 }, 48, 'dd');
    const dev = plan.required.find(i => i.toolId === 'sxk-dev')!;
    // 順序照 DIMENSION_CODES，不照工具自己的領域順序
    expect(describePlanItem(dev)).toBe('认知、语言沟通、社交互动、动作发展、生活自理与适应 · 30 题');
  });
});

describe('診斷方向的選項（§4.3 十選一）', () => {
  it('恰好十個，值與 DiagnosisDirection 逐一對應，順序照規格', () => {
    expect(DIAGNOSIS_OPTIONS.map(o => o.value)).toEqual([
      'cp', 'dd', 'id', 'ld', 'adhd', 'lang', 'emo', 'psych', 'tic', 'asd',
    ]);
    expect(DIAGNOSIS_OPTIONS.map(o => o.label)).toEqual([
      '脑瘫', '发展迟缓', '智力障碍', '学习障碍', '多动症', '语言障碍', '情绪障碍', '心理疾病', '抽动症', '自闭症',
    ]);
  });

  it('問法是「醫師是否已告知」，不是「你覺得孩子有什麼問題」', () => {
    expect(DIAGNOSIS_QUESTION).toBe('医生是否已告知诊断方向');
    expect(NO_DIAGNOSIS_LABEL).toBe('未告知');
  });

  it('isDiagnosisDirection 只認十個代號', () => {
    expect(isDiagnosisDirection('asd')).toBe(true);
    expect(isDiagnosisDirection('自闭症')).toBe(false);
    expect(isDiagnosisDirection('')).toBe(false);
    expect(isDiagnosisDirection(null)).toBe(false);
    expect(isDiagnosisDirection(3)).toBe(false);
  });

  /**
   * API 進來的值：沒帶、`null`、空字串（中控台「未定」）都是「沒填」；
   * 十個代號照收；其餘是錯（不能安靜地當成沒填 —— 家長選了自閉症、前端送錯了字，
   * 題量會安靜地少掉六支）。
   */
  it('readDiagnosisDirection：沒填三種寫法都是 null，錯的值回 invalid', () => {
    expect(readDiagnosisDirection(undefined)).toEqual({ ok: true, value: null });
    expect(readDiagnosisDirection(null)).toEqual({ ok: true, value: null });
    expect(readDiagnosisDirection('')).toEqual({ ok: true, value: null });
    expect(readDiagnosisDirection('asd')).toEqual({ ok: true, value: 'asd' });
    expect(readDiagnosisDirection('自闭症')).toEqual({ ok: false });
    expect(readDiagnosisDirection(['asd'])).toEqual({ ok: false });
  });
});
