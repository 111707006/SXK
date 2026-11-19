/**
 * 完整版題庫（kit-20260923）的「面向 → 孩子的細項」對照（ADR-0018）。手寫的資料表，**不是**腳本產出。
 *
 * 來源：`docs/specs/t2-v3-facet-tags-draft.md`（2026-11-19 草稿，使用者同日「全部同意」）。
 * 內容相同的面向沿用 9/08 版的對照（`sectionTags.ts`、`itemTags.ts`，v2 規格 §5.9），代號一樣、內容換了的改判，
 * 舊版沒有的看題目新判。改這一檔要同步改那份草稿（`test/t2FacetTagsV3.test.ts` 逐支逐面向釘住）。
 *
 * 【幾種規則】
 * - `facets`：面向被判為需要留意（見 `childTagsV3.ts` 的 `facetNeedsCare`）→ 貼這幾個。
 * - `items`：逐題 —— 那一題答到「有狀況」那一邊就貼（ASR 0＝与年龄相符；M-CHAT 照計分的風險方向；SP 的影響題「有」）。
 * - `anyYes`：那一段任何一題答「有」→ 貼（能力倒退、ASQ3 警訊）。
 * - `sectionGaps`：沒有面向分數的段（VOC 的手勢、句子）：這次出的題有一半以上答最低那一個選項 → 貼。
 * - `gaps`：兩個面向相比（理解 − 表達 ≥ `EXPRESSION_GAP_MIN_V3` 個百分點）→ 貼。
 * - 氣質另外寫（`TEMPERAMENT_TAGS_V3`）：九個向度偏高或偏低，不是好壞。
 *
 * 不在表上的面向（功能影響、持續時間、生活品質、抽動、ASQ3 的整體情況……）不貼：那些是影響多大，不是哪一種能力。
 */

import type { FindingTag } from './findingTags';

export interface FacetTagRules {
  facets?: Readonly<Record<string, ReadonlyArray<FindingTag>>>;
  items?: Readonly<Record<string, ReadonlyArray<FindingTag>>>;
  anyYes?: Readonly<Record<string, ReadonlyArray<FindingTag>>>;
  sectionGaps?: Readonly<Record<string, ReadonlyArray<FindingTag>>>;
  gaps?: ReadonlyArray<{ higher: string; lower: string; tags: ReadonlyArray<FindingTag> }>;
}

/** 理解比表達高出這麼多個百分點才算「听懂多于说出」（同 v2 的 `EXPRESSION_GAP_MIN`）。 */
export const EXPRESSION_GAP_MIN_V3 = 15;

const SENSORY: FacetTagRules = {
  facets: {
    VI: ['sen.visual'],
    AU: ['sen.auditory'],
    TA: ['sen.tactile'],
    OR: ['sen.oral'],
    PR: ['sen.body_awareness'],
    VE: ['sen.vestibular'],
    RG: ['sen.regulation'],
    SO: ['soc.social_initiation'],
    PL: ['mot.motor_planning'],
  },
  items: {
    'imp.adl': ['sen.impact_adl'],
    'imp.sch': ['sen.impact_group'],
    'imp.soc': ['sen.impact_play'],
  },
};

const LD_COMMON = {
  RD: ['learn.reading'],
  RC: ['learn.reading', 'lang.comprehension'],
  WE: ['learn.writing', 'lang.expression'],
  MA: ['learn.number'],
  LG: ['learn.phonological', 'lang.comprehension'],
} as const satisfies Record<string, ReadonlyArray<FindingTag>>;

/** 客規代碼（`KITV3_BANKS` 的 key）→ 規則。 */
export const FACET_TAGS_V3: Readonly<Record<string, FacetTagRules>> = {
  // ── 語言
  'SXK-LANG': {
    facets: {
      PL: ['soc.joint_attention', 'lang.comprehension'],
      RC: ['lang.comprehension'],
      EX: ['lang.expression'],
      AR: ['lang.articulation'],
      PR: ['lang.pragmatics'],
      LS: ['lang.expression', 'learn.phonological'],
    },
    gaps: [{ higher: 'RC', lower: 'EX', tags: ['lang.expression_below_comprehension'] }],
  },
  'SXK-LQ': {
    facets: {
      L1: ['lang.comprehension'],
      L2: ['lang.expression'],
      L3: ['lang.articulation'],
      L4: ['lang.pragmatics'],
      ORAL: ['sen.oral', 'adl.feeding'],
    },
  },
  'SXK-PLC': {
    facets: {
      L1: ['soc.emotion_reciprocity'],
      L2: ['lang.pragmatics'],
      L3: ['soc.joint_attention', 'lang.pragmatics'],
      L4: ['soc.pretend_play'],
      L5: ['lang.comprehension'],
      L6: ['lang.expression'],
      L7: ['sen.oral', 'adl.feeding'],
    },
  },
  'SXK-VOC': {
    facets: {
      V1: ['lang.comprehension'],
      V2: ['lang.expression'],
      V3: ['lang.vocabulary_size'],
    },
    sectionGaps: {
      GEST: ['soc.joint_attention', 'lang.pragmatics'],
      GRAM: ['lang.expression'],
    },
    gaps: [{ higher: 'V1', lower: 'V2', tags: ['lang.expression_below_comprehension'] }],
  },

  // ── 社交
  'SXK-SOC': {
    facets: {
      S1: ['soc.eye_contact', 'soc.joint_attention'],
      S2: ['soc.emotion_reciprocity'],
      S3: ['soc.joint_attention', 'soc.social_initiation'],
      S4: ['soc.imitation'],
      S5: ['soc.social_initiation'],
      S6: ['emo.regulation', 'att.impulsivity'],
      S7: ['soc.emotion_reciprocity'],
    },
  },
  'M-CHAT-R/F': {
    // 標準量表，題目與題序同 9/08 版，逐題沿用 `itemTags.ts` 的 mchat。
    items: {
      q1: ['soc.joint_attention'],
      q2: ['lang.comprehension'],
      q3: ['soc.pretend_play'],
      q4: ['mot.locomotion'],
      q5: ['sen.visual'],
      q6: ['soc.joint_attention'],
      q7: ['soc.joint_attention'],
      q8: ['soc.social_initiation'],
      q9: ['soc.joint_attention'],
      q10: ['soc.response_to_name'],
      q11: ['soc.social_initiation'],
      q12: ['sen.auditory'],
      q13: ['mot.locomotion'],
      q14: ['soc.eye_contact'],
      q15: ['soc.imitation'],
      q16: ['soc.joint_attention'],
      q17: ['soc.joint_attention'],
      q18: ['lang.comprehension'],
      q19: ['soc.joint_attention'],
      q20: ['mot.locomotion'],
    },
  },
  'SXK-ASR': {
    anyYes: { REG: ['severity.severe'] },
    items: {
      'SA.1': ['soc.eye_contact'],
      'SA.2': ['soc.social_initiation'],
      'SA.3': ['soc.social_initiation'],
      'SA.4': ['soc.joint_attention'],
      'SA.5': ['soc.emotion_reciprocity'],
      'SA.6': ['soc.social_initiation'],
      'CM.1': ['lang.expression'],
      'CM.2': ['lang.pragmatics'],
      'CM.3': ['soc.stereotyped_behavior'],
      'CM.4': ['lang.pragmatics'],
      'CM.5': ['lang.pragmatics'],
      'CM.6': ['lang.comprehension'],
      'PL.1': ['cog.problem_solving'],
      'PL.2': ['soc.pretend_play'],
      'PL.3': ['soc.imitation'],
      'RB.1': ['soc.stereotyped_behavior'],
      'RB.2': ['soc.stereotyped_behavior'],
      'RB.3': ['soc.stereotyped_behavior', 'emo.adaptability_low'],
      'RB.4': ['soc.stereotyped_behavior'],
      'RB.5': ['sen.regulation'],
      'ER.1': ['emo.regulation'],
      'ER.2': ['emo.regulation'],
      'ER.3': ['emo.regulation'],
      // ER.4 活動量與參與度：偏高偏低都可能，題目沒分方向，不貼。
    },
  },
  'SXK-ASB': {
    anyYes: { REG: ['severity.severe'] },
    facets: {
      SE: ['sen.regulation', 'sen.auditory', 'sen.tactile'],
      RE: ['soc.social_initiation', 'soc.joint_attention', 'soc.emotion_reciprocity'],
      BO: ['soc.stereotyped_behavior', 'soc.imitation'],
      LA: ['lang.expression', 'lang.pragmatics'],
      SH: ['emo.adaptability_low', 'adl.routines', 'soc.stereotyped_behavior'],
    },
  },

  // ── 注意力
  'SXK-ATT': {
    facets: {
      CL: ['att.inattention'],
      HW: ['att.inattention', 'learn.task_persistence'],
      HM: ['att.inattention'],
      IP: ['att.impulsivity'],
      SM: ['att.organization'],
      OU: ['att.impulsivity'],
    },
  },
  'SXK-AB': {
    facets: {
      SU: ['att.inattention'],
      DI: ['att.inattention'],
      IM: ['att.impulsivity'],
      HY: ['att.hyperactivity'],
      EF: ['att.organization'],
      OD: ['emo.regulation'],
    },
  },
  'SNAP-IV': {
    facets: {
      IA: ['att.inattention'],
      HI: ['att.hyperactivity', 'att.impulsivity'],
      OD: ['emo.regulation'],
    },
  },
  // 計分照兩個因素出面向（F1 工作記憶、F2 抑制），各自貼，同 9/08 版的因素規則。
  CHEXI: {
    facets: {
      F1: ['att.working_memory'],
      F2: ['att.inhibition'],
    },
  },

  // ── 動作
  'SXK-GM': {
    facets: {
      G1: ['mot.postural'],
      G2: ['mot.postural'],
      G3: ['mot.postural'],
      G4: ['mot.locomotion'],
      G5: ['mot.locomotion'],
      G6: ['mot.locomotion'],
      G7: ['mot.balance', 'mot.ball_skills'],
    },
  },

  // ── 感覺
  'SXK-SP': SENSORY,
  'SXK-SPb': SENSORY,

  // ── 認知
  'SXK-ADP': {
    facets: {
      A1: ['cog.visual_attention'],
      A2: ['mot.fine_motor'],
      A3: ['cog.problem_solving'],
      A4: ['cog.concepts'],
      A5: ['att.working_memory'],
      A6: ['adl.routines'],
      A7: ['learn.reading', 'learn.writing', 'learn.task_persistence'],
    },
  },

  // ── 生活自理
  'SXK-ADL': {
    facets: {
      EA: ['adl.feeding'],
      GR: ['adl.hygiene'],
      DR: ['adl.dressing'],
      TO: ['adl.toileting'],
      MO: ['mot.locomotion'],
      CO: ['lang.comprehension', 'lang.expression'],
      SC: ['adl.routines', 'soc.social_initiation'],
    },
  },

  // ── 發育綜合
  'SXK-ASQ3': {
    facets: {
      cm: ['lang.comprehension', 'lang.expression'],
      gm: ['mot.postural', 'mot.locomotion'],
      fm: ['mot.fine_motor'],
      ps: ['cog.problem_solving'],
      so: ['soc.social_initiation', 'adl.routines'],
    },
    anyYes: { RED: ['severity.severe'] },
  },

  // ── 學習
  'SXK-LDP': {
    facets: {
      ...LD_COMMON,
      WR: ['learn.writing', 'mot.fine_motor'],
      AT: ['att.inattention', 'att.organization'],
    },
  },
  'SXK-LDS': {
    facets: {
      ...LD_COMMON,
      WR: ['learn.writing'],
      EF: ['att.organization', 'learn.task_persistence'],
    },
  },

  // ── 情緒
  'SXK-EMO': {
    facets: {
      E1: ['emo.anxiety'],
      E2: ['emo.anxiety'],
      E3: ['emo.anxiety', 'soc.social_initiation'],
      E4: ['emo.anxiety'],
      E5: ['emo.anxiety'],
      E6: ['emo.adaptability_low'],
      E7: ['emo.regulation', 'emo.intensity_high'],
    },
  },
};

/** 不貼的量表（整支）：生活品質、抽動（ADR-0011 走提示＋預約）。氣質另寫在下面。 */
export const NO_TAG_TOOLS_V3: ReadonlyArray<string> = ['SXK-QOL', 'SXK-TIC'];

/**
 * 氣質（客規代碼 `ITQ/TTS/BSQ`）：九個向度。計分給的 band 是 0／1／2，0 落在 `poles[0]` 那一端、2 落在 `poles[1]`。
 * ⚠️ 三個表的兩端順序**不一樣**（BSQ 的规律性是「无规律→有规律」，ITQ／TTS 相反），所以這裡記的是**要留意的那一端叫什麼**，
 * 不記高或低。內容同 9/08 版 `TEMPERAMENT_TAGS`：八個向度貼在有狀況的那一端，坚持度是坚持不下去那一端。
 */
export const TEMPERAMENT_CODE_V3 = 'ITQ/TTS/BSQ';
export const TEMPERAMENT_TAGS_V3: Readonly<Record<string, { carePoles: ReadonlyArray<string>; tags: ReadonlyArray<FindingTag> }>> = {
  活动量: { carePoles: ['大'], tags: ['emo.activity_high'] },
  规律性: { carePoles: ['无规律'], tags: ['emo.regularity_low'] },
  趋避性: { carePoles: ['退缩'], tags: ['emo.slow_to_warm'] },
  适应度: { carePoles: ['低'], tags: ['emo.adaptability_low'] },
  反应强度: { carePoles: ['激烈'], tags: ['emo.intensity_high'] },
  情绪本质: { carePoles: ['负向'], tags: ['emo.mood_negative'] },
  坚持度: { carePoles: ['低', '小'], tags: ['learn.task_persistence'] },
  注意力分散度: { carePoles: ['易分散'], tags: ['att.inattention'] },
  反应阈: { carePoles: ['低'], tags: ['sen.threshold_low'] },
};
