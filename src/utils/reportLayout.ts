import { useSyncExternalStore } from 'react';

/**
 * 報告版面的伺服器開關（#71）：`GET /api/report-config`。家長端、後台、掃碼頁畫同一個 `ReportBody`，
 * 三處都從這裡拿 `noWeeklyPlan` 傳進去（報告本體自己不 fetch）。
 *
 * - 整個分頁只問一次（`main.tsx` 一進站就開始問，報告畫出來時通常已經回來了）。
 * - 還沒回來、或問不到（舊伺服器沒有這一支、斷線）＝關＝照舊畫週計劃圖 —— 與開關的預設同一邊。
 * - `ready`：問完了（不論結果）。要依版面捲動的地方（`AnalysisReport` 捲到 T2 卡）等它，
 *   不然捲完之後版面才換，卡片又被推走。
 */
export interface ReportLayout {
  noWeeklyPlan: boolean;
  ready: boolean;
}

const PENDING: ReportLayout = { noWeeklyPlan: false, ready: false };
let current: ReportLayout = PENDING;
let started: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** 回應的形狀不對一律當關（只認 `noWeeklyPlan === true`）。 */
export function reportLayoutFrom(body: unknown): ReportLayout {
  const on = typeof body === 'object' && body !== null && (body as { noWeeklyPlan?: unknown }).noWeeklyPlan === true;
  return { noWeeklyPlan: on, ready: true };
}

/** 問多久就放棄（照「關」畫）：要依版面捲動的地方在等 `ready`，不能無限等下去。 */
export const REPORT_LAYOUT_TIMEOUT_MS = 5000;

export function loadReportLayout(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!started) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), REPORT_LAYOUT_TIMEOUT_MS);
    let failed = false;
    started = fetchImpl('/api/report-config', controller ? { signal: controller.signal } : undefined)
      .then(resp => (resp.ok ? resp.json() : null))
      .catch(() => {
        failed = true;
        return null;
      })
      .then(body => {
        clearTimeout(timer);
        current = reportLayoutFrom(body);
        // 問不到（斷線、逾時）先照「關」畫、`ready` 照樣給；下一個掛上來的畫面再問一次，不把這一次的失敗記一整個分頁。
        if (failed) started = null;
        listeners.forEach(l => l());
      });
  }
  return started;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadReportLayout();
  return () => { listeners.delete(listener); };
}

export function useReportLayout(): ReportLayout {
  return useSyncExternalStore(subscribe, () => current, () => PENDING);
}

/** 只給測試：回到還沒問過的狀態。 */
export function resetReportLayoutForTest() {
  current = PENDING;
  started = null;
  listeners.clear();
}

/** 只給測試：目前的值。 */
export function reportLayoutSnapshot(): ReportLayout {
  return current;
}
