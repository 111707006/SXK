/**
 * T1 報告上那張「建议进入 T2 深度评估」卡的資料與字（使用者 2026-10-11）。
 *
 * 原本報告上直接列出要填的每一份問卷、題量與分鐘數（「建议填写 7 份问卷，约 140 分钟」）；使用者：「客人看到这么多题
 * 也不想做了」。報告上改成一張短卡：哪幾個方面、幾項、價錢、一顆按鈕；**逐份清單留到按下去之後的作答頁**
 * （`T2Assessment`／`T2AssessmentV3` 照舊列）。
 *
 * 價錢（套餐價與劃掉的原價，使用者 2026-10-13 定名）照幾項分檔，表在 `pricing.ts`，伺服器算好放在 plan 的 `pricing`（2026-10-13）。
 *
 * 「幾項」與「哪幾個方面」都從伺服器算好的 plan 數，這裡不重算：
 * - 舊題庫（暫行題量）：必做那幾份；方面＝它們為哪幾個維度做的。
 * - 完整版（`T2_RECOMMEND_V3`）：推薦的每一份；方面＝有對到單一維度的那幾份（綜合問卷沒有單一維度，不列）。
 */

import { SITE_DIMENSION_NAME } from './dimensionMap';
import { DIMENSION_CODES } from './types';
import type { DimensionCode, T2Plan } from './types';
import type { ParentPlanV3 } from './recommend/parentPlan';

export const PROMO_TITLE = '建议进入 T2 深度评估';
export const PROMO_PRICE_LABEL = '套餐价';
export const PROMO_GUIDE_LABEL = '原价';
export const PROMO_UNLOCK = '解锁深度评估';
export const PROMO_START = '开始深度评估';
/** 推薦的每一份都做完了（審查 #3）：按鈕改成這句，按下去是作答頁（底下有「生成报告」）。 */
export const PROMO_ALL_DONE = '查看并生成报告';
/** 免費期間（`PAYWALL_FREE`）價錢底下那一行：價錢只是參考，現在不收費。 */
export const PROMO_FREE_NOTE = '目前免费开放，直接开始即可';

/**
 * 1022（簡報第 23 頁「购买动机不强，需要修改」，使用者 2026-10-27）：卡上多列「做完可以得到什么」。
 * 客戶沒給文案，這是暫採的寫法；每一句都要是做完真的拿得到的東西。
 */
export const PROMO_BENEFITS_TITLE_1022 = '做完可以得到';
export const PROMO_BENEFITS_1022: ReadonlyArray<string> = [
  '每个方面更细的结果：哪些已经稳定、哪些还要多练',
  '照结果排好的居家训练计划，每周几个活动，附示范片跟着做',
];
/** 伺服器開著訓練計劃（`TRAINING_PLAN`）時才列：做完 T2 附送一個月（ADR-0013）。 */
export const PROMO_BONUS_1022 = '附送一个月居家训练';

export interface EntrancePromo {
  /** 幾項深度評估（＝要填幾份）。 */
  count: number;
  /** 家長看到的維度名稱，照九碼的固定順序、不重複。 */
  dimensions: string[];
}

function namesOf(dims: Iterable<DimensionCode>): string[] {
  const set = new Set(dims);
  return DIMENSION_CODES.filter(d => set.has(d)).map(d => SITE_DIMENSION_NAME[d]);
}

export function promoFromV2(plan: Pick<T2Plan, 'required'>): EntrancePromo {
  return {
    count: plan.required.length,
    dimensions: namesOf(plan.required.flatMap(i => i.forDimensions)),
  };
}

export function promoFromV3(plan: Pick<ParentPlanV3, 'tools'>): EntrancePromo {
  return {
    count: plan.tools.length,
    dimensions: namesOf(plan.tools.flatMap(t => (t.dimension ? [t.dimension] : []))),
  };
}

/**
 * 卡上那一段說明。方面用全形引號框起來（畫面上那幾個字另外上色，所以拆成前、中、後三段回傳）。
 * 沒有任何單一方面可以點名（例如只推了一份綜合問卷）時不點名。
 */
export function promoSentence(dimensions: ReadonlyArray<string>): { before: string; highlight: string | null; after: string } {
  const after = '建议进入更专业的单项深度评估，以提高单项判断的准确性。';
  if (dimensions.length === 0) {
    return { before: '目前孩子的筛查结果有需要进一步了解的地方，', highlight: null, after };
  }
  return { before: '目前孩子在', highlight: `“${dimensions.join('、')}”`, after: `方面的筛查结果需要进一步了解，${after}` };
}

export function promoCountLabel(count: number): string {
  return `${count} 项深度评估`;
}

export function promoDoneLabel(count: number): string {
  return `已完成 ${count} / ${count} 项`;
}
