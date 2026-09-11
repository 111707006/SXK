import type { AssessmentStatus } from '../types';

/**
 * 家長看到的嚴重度用語 —— 全站唯一的一份。
 *
 * 【為什麼要集中】
 * 2026-09-11 之前，同一個 `delay` 在五個地方有五種寫法：評估面板寫「迟缓风险」、
 * 篩查結論頁寫「发育迟缓」、報告九宮格寫「落后风险偏高」、AI 報告區寫「需关注」、
 * 腦區拓樸圖寫「传导风险/偏弱」。家長從第一頁走到最後一頁，同一顆紅燈換了五個名字，
 * 而每一個都帶著「迟缓／落后／风险」。
 *
 * 【用語依據】
 * 客戶 2026-09-11 的《家长报告用语对照表》
 * （`docs/reference/client-mockups/家长报告用语对照表-2026-09-11.md`）。三條原則：
 *   1. 狀態判定 → 行動建議：不說「有问题」，說「建议进一步了解」
 *   2. 缺陷框架 → 發展框架：不說「落后／迟缓」，說「仍在建立中」「需要更多支持」
 *   3. 保留分級，只換掉情緒衝擊：紅／黃／綠三級與優先順序都留住
 *
 * 表上「必改」的字（障碍、诊断、异常、迟缓、落后、失调、严重、风险、警告、必须、
 * 治疗、矫正……）不得出現在這個檔案，也不得出現在家長會看到的元件裡；
 * `test/parentWording.structure.test.ts` 會擋。
 *
 * ⚠️ 這裡只管**家長端的稱呼**。程式裡的狀態值仍是 `normal` / `borderline` / `delay`，
 * 團隊內部的詞仍是 CONTEXT.md 的「需留意（黃燈）／需關注（紅燈）」—— 那是判定，
 * 這裡是說法。改這裡不會動到任何判定門檻。
 */
export interface StatusWording {
  /**
   * 短標籤，放在卡片角落的膠囊裡。控制在 6 個字以內 —— 篩查結論頁的卡片在
   * 平板寬度下，圖示＋最長的維度名「生活自理与适应」＋這個膠囊剛好塞滿一行。
   */
  label: string;
  /**
   * 對照表「落地建議」逐字指定的三級標示：
   *   红色→「建议优先安排专业咨询」；橙色→「建议进一步了解」；绿色→「目前发展稳定」
   * 用在有一整行寬度可用的地方（報告九宮格底部的膠囊、圖例）。
   */
  tag: string;
  /**
   * 句子裡的中性描述。對照表的一句話公式是
   * 「（能力方面）＋（中性描述）＋（行動建議）」，這是中間那一段：
   *   「语言沟通方面【与同龄常见的发展节奏有差距】，建议近期安排专业咨询。」
   */
  describe: string;
}

export const STATUS_WORDING: Record<AssessmentStatus, StatusWording> = {
  normal: {
    label: '发展稳定',
    tag: '目前发展稳定',
    describe: '目前发展稳定',
  },
  borderline: {
    // 對照表：轻度 → 目前需要少量支持／可在日常中练习
    label: '需要少量支持',
    tag: '建议进一步了解',
    describe: '仍在建立中',
  },
  delay: {
    // 對照表：中度 → 目前需要较多支持；明显落后 → 与同龄常见的发展节奏有差距
    label: '需要较多支持',
    tag: '建议优先安排专业咨询',
    describe: '与同龄常见的发展节奏有差距',
  },
};

/*
 * 這裡曾經有一支 `concernLabel(concernScore)`，給報告雷達圖的圖例分四級
 * （≥6 差距较明显／=5 需要较多支持／3–4 需要少量支持／≤2 发展稳定）。
 *
 * **2026-09-11 定案廢除**（ADR-0007、CONTEXT.md「關注分」）：那是第二套刻度。
 * 它畫的線比篩查判定寬鬆一格 —— 得分 6 的維度在篩查頁亮黃燈，在雷達圖上卻說
 * 「大致良好」，而 CONTEXT.md 對嚴重度的定義是「與報告上的判定是同一組值，
 * 不另立一套刻度」。圖表現在一律照 `STATUS_WORDING` 的三級走，關注分只剩
 * 「雷達圖那一角凸出去多少」這一個工作。
 *
 * 留這段話是為了讓下一個想「圖例只有三級好像太粗」的人先看到這裡。
 */

/**
 * 對照表要求固定放在報告最上方的定位句。原句照抄，不要潤飾 ——
 * 「这一句能大幅降低家长看到红色标示时的冲击」。
 */
export const SCREENING_DISCLAIMER = '本报告为发展筛查，用于发现需要进一步了解的方面，不是诊断。';

/**
 * 全綠時的結論。對照表：「结果正常时也要说清楚……避免让家长觉得白做一场。」原句照抄。
 */
export const ALL_CLEAR_SUMMARY = '本次筛查各方面发展稳定，可作为日后对照的基线记录。';

/**
 * 把被標記的維度組成一句結論，照對照表的公式：
 * 「（能力方面）＋（中性描述）＋（行動建議）」。
 *
 * 紅燈與黃燈分開講 —— 兩者的行動建議不同（一個是優先諮詢，一個是進一步了解），
 * 混成「X、Y 等 N 个维度值得关注」就把優先順序丟掉了，而對照表第三條原則
 * 正是「分级、优先级、建议方向都要留住」。
 *
 * @returns 沒有任何維度被標記時回 `null`，呼叫端自己決定要不要放 {@link ALL_CLEAR_SUMMARY}。
 */
export function flaggedSummary(
  scores: ReadonlyArray<{ dimensionName: string; status: AssessmentStatus }>
): string | null {
  const red = scores.filter(s => s.status === 'delay').map(s => s.dimensionName);
  const yellow = scores.filter(s => s.status === 'borderline').map(s => s.dimensionName);
  if (red.length === 0 && yellow.length === 0) return null;

  const parts: string[] = [];
  if (red.length > 0) {
    parts.push(`${red.join('、')}方面${STATUS_WORDING.delay.describe}，${STATUS_WORDING.delay.tag}`);
  }
  if (yellow.length > 0) {
    parts.push(`${yellow.join('、')}方面${STATUS_WORDING.borderline.describe}，${STATUS_WORDING.borderline.tag}`);
  }
  return `本次筛查提示：${parts.join('；')}。`;
}
