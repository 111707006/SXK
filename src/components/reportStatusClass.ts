/**
 * 三級 band 的膠囊顏色。與 T1 報告九宮格同一組色：綠／黃／紅照篩查判定，
 * 沒有第二把尺（ADR-0007）。「沒有判定」的那幾格取 `dimensionStatus` 的 `tone`（v2.1 S02）：
 * 沒做的（`partial`／`not_assessed`）帶 T1 的紅／黃，借的就是這裡的 `delay`／`borderline`；
 * `no_tool` 是灰（`state`）—— 它不是沒做，是沒得做，不在這把尺上。
 */
export const STATUS_CLASS: Record<'normal' | 'borderline' | 'delay' | 'state', string> = {
  normal: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  borderline: 'bg-amber-50 border-amber-200 text-amber-800',
  delay: 'bg-rose-50 border-rose-200 text-rose-800',
  state: 'bg-brand-cream/60 border-brand-stone text-brand-charcoal/70',
};
