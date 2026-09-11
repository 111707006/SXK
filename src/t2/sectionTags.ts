/**
 * §5.9 的標籤來源（面向級與其他非逐題的規則）。
 *
 * 【這一檔與 `itemTags.ts` 的分工】
 * §5.9 的 tags 欄有兩種粒度。大多數工具是**面向級**：一個面向判到 tier ≥ 2，
 * 整個面向出同一組標籤 —— 那些在這裡。四支是**逐題級**（asb、asr、adl、mchat），
 * 加上 gm、asq、warn 各有幾條逐題規則 —— 那些在 `itemTags.ts`。
 *
 * 【這裡只有對應，沒有觸發】
 * 「什麼時候出」是 #46（計分與 tier）與 #47（規則函式）的事。這裡只回答
 * 「哪一個面向出哪些標籤」。§5.5 的觸發條件抄在各段註解裡，方便對照：
 * - 面向級：該面向 `scored === true` 且 `sectionTier >= 2`。
 * - 氣質：`dev >= 1.0`（hi 端）或 `dev <= -1.0`（lo 端）。
 * - chexi：因素相對百分比 >= 67。
 *
 * 沒有出現在 `SECTION_TAGS` 裡的工具，不是漏了 —— 是它根本不走面向級：
 * warn／mchat／asb／asr／adl 走逐題，chexi 走因素，tempa／tempb 走向度偏離。
 */

import type { ToolId } from './toolkit';
import type { FindingTag } from './findingTags';

/**
 * 面向 key → 這個面向 tier ≥ 2 時出的標籤。
 *
 * `sxk-dev` 的 key 是領域（六個年齡段共用同一組 key）。
 * 括號裡是面向名稱，抄自題庫，方便與規格 §5.9 逐格對。
 */
export const SECTION_TAGS: Partial<Record<ToolId, Record<string, FindingTag[]>>> = {
  'sxk-dev': {
    MOT: ['mot.locomotion'],                                  // 粗大动作
    FM: ['mot.fine_motor'],                                   // 精细动作（不出 band，只出標籤）
    LANG: ['lang.comprehension', 'lang.expression'],          // 语言
    SOC: ['soc.social_initiation'],                           // 社交
    ADL: ['adl.routines'],                                    // 生活自理
    COG: ['cog.problem_solving'],                             // 认知
  },
  'sxk-gm': {
    P1: ['mot.postural'],                                     // 卧位与翻身
    P2: ['mot.postural'],                                     // 坐姿控制
    P3: ['mot.postural'],                                     // 爬行与站立
    P4: ['mot.locomotion'],                                   // 走跑跳
    P5: ['mot.balance'],                                      // 平衡与协调（另有兩題的球類規則，見 itemTags）
  },
  'sxk-soc': {
    S1: ['soc.joint_attention', 'soc.eye_contact'],           // 人际注意
    S2: ['soc.emotion_reciprocity'],                          // 情绪互动
    S3: ['soc.imitation'],                                    // 模仿与学习
    S4: ['soc.social_initiation'],                            // 游戏参与
    S5: ['emo.regulation'],                                   // 规则与自我（只出標籤，不餵 EMO 的 band）
  },
  'sxk-lang': {
    RC: ['lang.comprehension'],                               // 听觉理解
    EX: ['lang.expression'],                                  // 口语表达
    AR: ['lang.articulation'],                                // 语音清晰度
    PR: ['lang.pragmatics'],                                  // 沟通功能与语用
  },
  'sxk-adp': {
    A1: ['cog.visual_attention'],                             // 视觉与追踪
    A2: ['mot.fine_motor'],                                   // 物体操作（只出標籤，ADP 只餵 COG）
    A3: ['cog.problem_solving'],                              // 问题解决
    A4: ['cog.concepts'],                                     // 概念理解
    A5: ['adl.routines'],                                     // 生活应用（只出標籤）
  },
  'sxk-voc': {
    V1: ['lang.comprehension'],                               // 理解词汇
    V2: ['lang.expression'],                                  // 表达词汇
    V3: ['lang.vocabulary_size'],                             // 词类广度
  },
  'sxk-asq': {
    CO: ['lang.expression'],                                  // 沟通
    GM: ['mot.locomotion'],                                   // 粗大动作
    FM: ['mot.fine_motor'],                                   // 精细动作（不出 band）
    PS: ['cog.problem_solving'],                              // 解决问题
    // PE 个人社会是逐題的（前三項各出一個生活自理標籤），見 itemTags。
  },
  'sxk-ab': {
    SU: ['att.inattention'],                                  // 持续专注
    DI: ['att.inattention'],                                  // 抗干扰
    IM: ['att.impulsivity'],                                  // 冲动控制
    HY: ['att.hyperactivity'],                                // 活动量
    EF: ['att.organization'],                                 // 组织与执行
    OD: ['emo.regulation'],                                   // 对立与情绪（只出標籤，AB 只餵 ATT）
  },
  'sxk-att': {
    CL: ['att.inattention'],                                  // 课堂情境
    HW: ['att.inattention', 'learn.task_persistence'],        // 作业情境
    HM: ['att.inattention'],                                  // 居家情境
    IP: ['att.impulsivity'],                                  // 人际情境
    SM: ['att.organization'],                                 // 自我管理
  },
  'snap-iv': {
    IA: ['att.inattention'],                                  // 注意力不足
    HI: ['att.hyperactivity', 'att.impulsivity'],             // 过动与冲动
    OD: ['emo.regulation'],                                   // 对立违抗（餵 EMO 的 band）
  },
  'sxk-spa': {
    TA: ['sen.tactile'], VE: ['sen.vestibular'], PR: ['sen.body_awareness'],
    AU: ['sen.auditory'], VI: ['sen.visual'], OR: ['sen.oral'], RG: ['sen.regulation'],
  },
  'sxk-spb': {
    TA: ['sen.tactile'], VE: ['sen.vestibular'], PR: ['sen.body_awareness'],
    AU: ['sen.auditory'], VI: ['sen.visual'], OR: ['sen.oral'], RG: ['sen.regulation'],
  },
  'sxk-ldp': {
    read: ['learn.reading'],                                  // 阅读方面
    math: ['learn.number'],                                   // 数学方面
    write: ['learn.writing'],                                 // 书写方面
    attn: ['att.inattention'],                                // 注意力方面（只出標籤，LDP 只餵 LEARN）
    lang: ['learn.phonological'],                             // 语言处理方面
  },
  'sxk-lds': {
    read: ['learn.reading'],
    math: ['learn.number'],
    write: ['learn.writing'],
    attn: ['att.inattention'],
    lang: ['learn.phonological'],
  },
};

/**
 * chexi 的兩個因素（§5.2、§5.9）。
 *
 * chexi **不出 band**：紙本與 HTML 都寫「本檔不套用任何自造切分值，判讀須對照
 * 原作者發表的常模」。它只在因素相對偏高時出標籤，並固定帶 `descriptive_only`。
 *
 * `sections` 是組成這個因素的副量表；`tags` 在因素 `pct >= CHEXI_FACTOR_MIN_PCT`
 * 時出；`extra` 是「該副量表自己的均分也高」時額外多出的那一個。
 */
export const CHEXI_FACTOR_MIN_PCT = 67;

export const CHEXI_FACTORS: ReadonlyArray<{
  key: 'F1' | 'F2';
  name: string;
  sections: string[];
  tags: FindingTag[];
  extra: { section: string; minMean: number; tags: FindingTag[] };
}> = [
  {
    key: 'F1',
    name: '工作記憶',
    sections: ['wm', 'pl'],                                   // 工作记忆 9 題＋计划力 4 題
    tags: ['att.working_memory'],
    extra: { section: 'pl', minMean: 4, tags: ['att.organization'] },
  },
  {
    key: 'F2',
    name: '抑制',
    sections: ['ib', 'rg'],                                   // 抑制力 6 題＋调节力 5 題
    tags: ['att.inhibition'],
    extra: { section: 'rg', minMean: 4, tags: ['emo.regulation'] },
  },
];

/**
 * 氣質（tempa／tempb）的九向度（§5.9 最後一列）。
 *
 * 氣質**不出 band**，恆不影響維度判定 —— 它描述的是特質不是缺口。
 * `hi` 在 `dev >= 1.0` 時出，`lo` 在 `dev <= -1.0` 時出；「稍偏」（0.42 ≤ |dev| < 1.0）
 * 與沒有列出的那一側只進報告的氣質段落，不出標籤。
 *
 * 方向的命名照 §5.9 原樣：八個向度貼在 hi 端，只有 D7 堅持度貼在 lo 端
 * （堅持不下去才是要留意的事）。工具包的八題全部朝 hi 端敘述，沒有反向題。
 */
export const TEMPERAMENT_TAG_DEV = 1.0;

export const TEMPERAMENT_TAGS: Record<string, { hi: FindingTag[]; lo: FindingTag[] }> = {
  D1: { hi: ['emo.activity_high'], lo: [] },                  // 活动量
  D2: { hi: ['emo.regularity_low'], lo: [] },                 // 规律性
  D3: { hi: ['emo.slow_to_warm'], lo: [] },                   // 趋避性
  D4: { hi: ['emo.adaptability_low'], lo: [] },               // 适应度
  D5: { hi: ['emo.intensity_high'], lo: [] },                 // 反应强度
  D6: { hi: ['emo.mood_negative'], lo: [] },                  // 情绪本质
  D7: { hi: [], lo: ['learn.task_persistence'] },             // 坚持度
  D8: { hi: ['att.inattention'], lo: [] },                    // 注意分散度
  D9: { hi: ['sen.threshold_low'], lo: [] },                  // 反应阈
};

/**
 * 前置題出的標籤（§5.1）。目前只有 spa／spb 的「影響參與」複選。
 *
 * 勾「無」時不出標籤，改出 caveat `no_functional_impact`；那是 #47 的事。
 * 這三個標籤都是**只進報告** —— 影響到哪裡是脈絡，不是要練的能力。
 */
export const PRE_QUESTION_TAGS: Partial<Record<ToolId, Record<string, Record<string, FindingTag[]>>>> = {
  'sxk-spa': { impact: { adl: ['sen.impact_adl'], group: ['sen.impact_group'], play: ['sen.impact_play'] } },
  'sxk-spb': { impact: { adl: ['sen.impact_adl'], group: ['sen.impact_group'], play: ['sen.impact_play'] } },
};

/**
 * 「表達弱於理解」的兩條規則（§5.5）。
 *
 * 兩個面向的 pct 差 ≥ 15 **且**表達那一面向本身已經 tier ≥ 2 才出。
 * 只差 15 分不夠 —— 兩邊都很好時差 15 分沒有臨床意義。
 */
export const EXPRESSION_GAP_MIN = 15;

export const EXPRESSION_GAP_RULES: ReadonlyArray<{
  toolId: ToolId;
  comprehension: string;
  expression: string;
  tag: FindingTag;
}> = [
  { toolId: 'sxk-lang', comprehension: 'RC', expression: 'EX', tag: 'lang.expression_below_comprehension' },
  { toolId: 'sxk-voc', comprehension: 'V1', expression: 'V2', tag: 'lang.expression_below_comprehension' },
];

/** 任何工具判到 tier 4 都出這一個（§5.4）。跨工具，不歸任何維度。 */
export const SEVERITY_TIER = 4;
export const SEVERITY_TAG: FindingTag = 'severity.severe';
