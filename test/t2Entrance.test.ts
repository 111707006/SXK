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
  t1FlagsFromScores,
} from '../src/t2/entrance';
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
