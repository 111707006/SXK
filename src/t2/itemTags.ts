/**
 * §5.9 的逐題標籤表。
 *
 * 【為什麼只有幾支需要逐題】
 * 大多數工具的**面向就是分類** —— 「聽覺理解」那一面向的 16 題全部在測同一件事，
 * 整個面向出 `lang.comprehension` 就夠了（那些在 `sectionTags.ts`）。
 * 但有四支的面向裡混著不同維度的題：asb 的「自理與適應」同時有如廁、穿衣、
 * 情緒爆發與自傷；asr 的 15 項一項一個主題；adl 的「溝通與認知」有語言也有記憶；
 * mchat 的 20 題沒有面向。這四支只能逐題貼。
 *
 * 另外三支各有幾條逐題規則，順手放在同一檔 —— 它們同樣是「面向不夠細」的例外：
 * gm 的球類兩題、asq 的「個人社會」前三項、warn 每個時點的四條。
 *
 * 【什麼時候出】
 * 觸發條件依計分族（§5.5），不逐題記：
 * - concern 族（asb、asr）：該題答 `>= 2`
 * - achievement 族（gm、asq）：該題答 `<= 1`
 * - independence 族（adl）：該題答 `<= 4`（大人動手了）
 * - risk 族（mchat）：該題算風險（題 2、5、12 答「是」，其餘答「否」）
 * - positive 族（warn）：該條答陽性
 *
 * 【題號】
 * 一律是**該面向內的序號（從 1 起）**，與紙本、與題庫的 `ToolkitItem.no` 一致。
 * 唯一的例外是 asr：§5.9 用的是跨面向的 1–15，因此下面 `ASR_ITEM_TAGS` 照 §5.9
 * 用全域題號，`ITEM_TAGS['sxk-asr']` 由它換算出來。
 *
 * 判定與計分不在這裡（#46、#47）；這一檔只有對應。
 */

import type { ToolId } from './toolkit';
import type { Caveat } from './caveats';
import type { DimensionCode } from './types';
import type { FindingTag } from './findingTags';

/** 一題觸發時出的東西。多數只有標籤；asb SH 第 8 項只出 caveat。 */
export interface ItemTagRule {
  tags: FindingTag[];
  caveats?: Caveat[];
}

type SectionItemTags = Record<string, Record<number, ItemTagRule>>;

/** M-CHAT-R/F 20 題（單一面向 `all`）。題 2 另外要求先做聽力檢查。 */
const MCHAT_ITEMS: Record<number, ItemTagRule> = {
  1: { tags: ['soc.joint_attention'] },                       // 順著你指的方向看
  2: { tags: ['lang.comprehension'], caveats: ['hearing_check_first'] },  // 想過孩子可能是聾的
  3: { tags: ['soc.pretend_play'] },                          // 假想遊戲
  4: { tags: ['mot.locomotion'] },                            // 喜歡攀爬
  5: { tags: ['sen.visual'] },                                // 眼睛附近的異常動作
  6: { tags: ['soc.joint_attention'] },                       // 用手指指物表達需求
  7: { tags: ['soc.joint_attention'] },                       // 用手指指有趣的東西
  8: { tags: ['soc.social_initiation'] },                     // 對其他孩子感興趣
  9: { tags: ['soc.joint_attention'] },                       // 純粹為了分享而拿東西給你
  10: { tags: ['soc.response_to_name'] },                     // 叫名字有反應
  11: { tags: ['soc.social_initiation'] },                    // 你微笑時回以微笑
  12: { tags: ['sen.auditory'] },                             // 因日常噪音不安
  13: { tags: ['mot.locomotion'] },                           // 會走路
  14: { tags: ['soc.eye_contact'] },                          // 說話或遊戲時看著你的眼睛
  15: { tags: ['soc.imitation'] },                            // 模仿你做的事
  16: { tags: ['soc.joint_attention'] },                      // 你轉頭看時他跟著看
  17: { tags: ['soc.joint_attention'] },                      // 讓你去注視他
  18: { tags: ['lang.comprehension'] },                       // 聽得懂交代的事
  19: { tags: ['soc.joint_attention'] },                      // 有新事情發生時望向你
  20: { tags: ['mot.locomotion'] },                           // 喜歡動態活動
};

/** SXK-ASB 自閉行為，五向度 57 題。空的題號是 §5.9 明寫「不出標籤」的。 */
const ASB_ITEMS: SectionItemTags = {
  // SE 感觉反应 12 題
  SE: {
    1: { tags: ['sen.auditory'] }, 2: { tags: ['sen.tactile'] }, 3: { tags: ['sen.visual'] },
    4: { tags: ['sen.oral'] }, 5: { tags: ['sen.tactile'] }, 6: { tags: ['sen.visual'] },
    7: { tags: ['sen.visual'] }, 8: { tags: ['sen.tactile'] }, 9: { tags: ['sen.tactile'] },
    10: { tags: ['sen.auditory'] }, 11: { tags: ['sen.oral'] }, 12: { tags: ['sen.auditory'] },
  },
  // RE 人际关系 12 題
  RE: {
    1: { tags: ['soc.social_initiation'] }, 2: { tags: ['soc.eye_contact'] },
    3: { tags: ['soc.response_to_name'] }, 4: { tags: ['soc.joint_attention'] },
    5: { tags: ['soc.emotion_reciprocity'] }, 6: { tags: ['soc.social_initiation'] },
    7: { tags: ['soc.social_initiation'] }, 8: { tags: ['soc.joint_attention'] },
    9: { tags: ['soc.emotion_reciprocity'] }, 10: { tags: ['soc.social_initiation'] },
    11: { tags: ['soc.imitation'] }, 12: { tags: ['soc.emotion_reciprocity'] },
  },
  // BO 身体与动作 11 題；4、8、9 不出標籤
  BO: {
    1: { tags: ['soc.stereotyped_behavior'] }, 2: { tags: ['soc.stereotyped_behavior'] },
    3: { tags: ['soc.stereotyped_behavior'] }, 5: { tags: ['soc.stereotyped_behavior'] },
    6: { tags: ['soc.stereotyped_behavior'] }, 7: { tags: ['mot.balance'] },
    10: { tags: ['soc.stereotyped_behavior'] }, 11: { tags: ['soc.imitation'] },
  },
  // LA 语言沟通 12 題；1 與 9 之外全是語用
  LA: {
    1: { tags: ['lang.expression'] }, 2: { tags: ['lang.pragmatics'] }, 3: { tags: ['lang.pragmatics'] },
    4: { tags: ['lang.pragmatics'] }, 5: { tags: ['lang.pragmatics'] }, 6: { tags: ['lang.pragmatics'] },
    7: { tags: ['lang.pragmatics'] }, 8: { tags: ['lang.pragmatics'] }, 9: { tags: ['lang.comprehension'] },
    10: { tags: ['lang.pragmatics'] }, 11: { tags: ['lang.pragmatics'] }, 12: { tags: ['lang.pragmatics'] },
  },
  // SH 自理与适应 10 題；6 不出標籤；8「出现自伤行为」只出 caveat，且報告置頂
  SH: {
    1: { tags: ['emo.adaptability_low'] }, 2: { tags: ['sen.oral'] }, 3: { tags: ['emo.regularity_low'] },
    4: { tags: ['adl.toileting'] }, 5: { tags: ['adl.dressing'] }, 7: { tags: ['emo.regulation'] },
    8: { tags: [], caveats: ['safety_concern'] }, 9: { tags: ['soc.stereotyped_behavior'] },
    10: { tags: ['emo.adaptability_low'] },
  },
};

/**
 * SXK-ASR 社交溝通行為 15 項，**照 §5.9 的全域題號 1–15**。
 * 對應的面向見 `ASR_SECTION_ORDER`：SC 1–5、SN 6–8、BH 9–12、GN 13–15。
 * 14（能力發展的均勻度）與 15（整體印象）不出標籤 —— 它們是整體印象，不指向任何能力。
 */
export const ASR_ITEM_TAGS: Record<number, ItemTagRule> = {
  1: { tags: ['soc.social_initiation'] },                     // 与人的关系
  2: { tags: ['soc.imitation'] },                             // 模仿能力
  3: { tags: ['emo.regulation'] },                            // 情绪反应
  4: { tags: ['lang.expression', 'lang.pragmatics'] },        // 语言沟通
  5: { tags: ['lang.pragmatics'] },                           // 非语言沟通
  6: { tags: ['sen.visual', 'soc.eye_contact'] },             // 视觉反应
  7: { tags: ['sen.auditory'] },                              // 听觉反应
  8: { tags: ['sen.tactile', 'sen.oral'] },                   // 味嗅触觉反应
  9: { tags: ['soc.stereotyped_behavior'] },                  // 身体运用
  10: { tags: ['soc.stereotyped_behavior'] },                 // 物品运用
  11: { tags: ['emo.adaptability_low'] },                     // 对改变的适应
  12: { tags: ['emo.activity_high'] },                        // 活动量水平（工具沒有分偏高／偏低側，一律出）
  13: { tags: ['emo.regulation'] },                           // 紧张与恐惧
};

/** asr 的面向順序與每個面向的項數 —— 全域題號就是照這個順序連號的。 */
export const ASR_SECTION_ORDER: ReadonlyArray<{ key: string; count: number }> = [
  { key: 'SC', count: 5 },    // 社交与沟通
  { key: 'SN', count: 3 },    // 感觉反应
  { key: 'BH', count: 4 },    // 行为与适应
  { key: 'GN', count: 3 },    // 情绪与整体
];

/** asr 的（面向、面向內序號）→ §5.9 的全域題號 1–15。認不得的組合回 `null`。 */
export function asrGlobalNo(section: string, itemNo: number): number | null {
  let base = 0;
  for (const s of ASR_SECTION_ORDER) {
    if (s.key === section) return itemNo >= 1 && itemNo <= s.count ? base + itemNo : null;
    base += s.count;
  }
  return null;
}

function asrBySection(): SectionItemTags {
  const out: SectionItemTags = {};
  let base = 0;
  for (const s of ASR_SECTION_ORDER) {
    const bucket: Record<number, ItemTagRule> = {};
    for (let i = 1; i <= s.count; i++) {
      const rule = ASR_ITEM_TAGS[base + i];
      if (rule) bucket[i] = rule;
    }
    out[s.key] = bucket;
    base += s.count;
  }
  return out;
}

/** SXK-ADL 生活自理 18 項。CC 的 3、4、5 不出標籤（互動、專注、解決小問題）。 */
const ADL_ITEMS: SectionItemTags = {
  // SC 自我照顾 6 項
  SC: {
    1: { tags: ['adl.feeding'] },                             // 进食
    2: { tags: ['adl.dressing'] },                            // 穿脱上衣
    3: { tags: ['adl.dressing'] },                            // 穿脱裤子与鞋袜
    4: { tags: ['adl.hygiene'] },                             // 梳洗整理
    5: { tags: ['adl.toileting'] },                           // 如厕动作
    6: { tags: ['adl.hygiene'] },                             // 洗澡
  },
  // SP 括约肌控制 2 項
  SP: { 1: { tags: ['adl.toileting'] }, 2: { tags: ['adl.toileting'] } },
  // MO 移动与转位 4 項（只出標籤，ADL 只餵 ADL）
  MO: {
    1: { tags: ['mot.locomotion'] }, 2: { tags: ['mot.locomotion'] },
    3: { tags: ['mot.locomotion'] }, 4: { tags: ['mot.locomotion'] },
  },
  // CC 沟通与认知 6 項（均只出標籤）
  CC: {
    1: { tags: ['lang.comprehension'] },                      // 理解他人的话或指令
    2: { tags: ['lang.expression'] },                         // 表达自己的需求与想法
    6: { tags: ['adl.routines'] },                            // 记住并完成交代的事
  },
};

/**
 * SXK-GM 的球類兩題（§5.9）：P5 第 3 項「能踢固定的球」或第 6 項「能接住拋來的大球」
 * 答 ≤1 時，在 P5 的 `mot.balance` 之外**另加** `mot.ball_skills`。
 * 這是 `mot.ball_skills` 唯一的來源。
 */
const GM_ITEMS: SectionItemTags = {
  P5: { 3: { tags: ['mot.ball_skills'] }, 6: { tags: ['mot.ball_skills'] } },
};

/**
 * SXK-ASQ 的「个人社会」六項（§5.9）：前三項各指向一件生活自理，後三項才是社交。
 * 這一面向整體餵 SOC 的 band，逐題標籤不改那件事。
 */
const ASQ_ITEMS: SectionItemTags = {
  PE: {
    1: { tags: ['adl.feeding'] },                             // 会自己用汤匙吃完一餐
    2: { tags: ['adl.toileting'] },                           // 白天大小便能自己表示
    3: { tags: ['adl.dressing'] },                            // 会自己脱简单衣物
    4: { tags: ['soc.social_initiation'] },                   // 会和其他孩子在同一空间玩
    5: { tags: ['soc.social_initiation'] },                   // 会说自己的名字
    6: { tags: ['soc.social_initiation'] },                   // 会等一下下
  },
};

/**
 * SXK-WARN 每個時點的四條（§5.9）。十一個時點的四條**欄位相同**，
 * 因此記位置不記題號：第 1 條語言、第 2 條社交、第 3 條精細動作、第 4 條粗大動作。
 *
 * warn 不進路由（`ToolSpec.routed === false`），規則仍寫著 —— 日後要把它當
 * 「T1 之外的第二道紅旗」加回來時不必重做。
 */
export const WARN_POSITION_FEEDS: ReadonlyArray<{
  position: 1 | 2 | 3 | 4;
  dimension: DimensionCode;
  tags: FindingTag[];
}> = [
  { position: 1, dimension: 'LANG', tags: [] },
  { position: 2, dimension: 'SOC', tags: [] },
  { position: 3, dimension: 'MOT', tags: ['mot.fine_motor'] },
  { position: 4, dimension: 'MOT', tags: ['mot.locomotion'] },
];

/** warn 前置題的兩個勾各自指向哪個維度（§5.9）。勾了就算初篩異常。 */
export const WARN_REGRESSION_FEEDS: Record<string, DimensionCode> = {
  language: 'LANG',
  social: 'SOC',
};

/**
 * 工具 → 面向 key → 面向內題號 → 觸發時出的東西。
 *
 * 沒有列出的題號 = 該題不出標籤（§5.9 明寫的那些，以及 mchat 以外沒有逐題規則的工具）。
 */
export const ITEM_TAGS: Partial<Record<ToolId, SectionItemTags>> = {
  'mchat-rf': { all: MCHAT_ITEMS },
  'sxk-asb': ASB_ITEMS,
  'sxk-asr': asrBySection(),
  'sxk-adl': ADL_ITEMS,
  'sxk-gm': GM_ITEMS,
  'sxk-asq': ASQ_ITEMS,
};

/** 這一題觸發時出什麼；沒有規則時回 `null`。 */
export function itemRule(toolId: ToolId, section: string, itemNo: number): ItemTagRule | null {
  return ITEM_TAGS[toolId]?.[section]?.[itemNo] ?? null;
}
