/**
 * `/api/db/save` 遇到「這個分頁讀的不是最新那一份」時怎麼合（2026-11-17 code review 第 1 項）。
 *
 * 家長端存檔是整份送上來。以前伺服器整份蓋掉：手機剛做完 T1，電腦上沒重新整理的舊分頁一存檔，
 * 新報告就不見；後台刪掉的報告也會被舊分頁寫回來。現在前端帶著它上次讀到的版本（`baseRevision`）
 * 與那時有的報告 id（`baseReportIds`）；版本對不上才走這裡，對得上照舊整份存。
 *
 * - 報告：伺服器現有的全留；送來的裡面伺服器沒有的，**不在** `baseReportIds` 裡才收（這個分頁新做的）；
 *   在裡面＝它是從伺服器讀到、之後在別處被刪掉的，不寫回去。不看時間，兩台裝置的鐘可以不準。
 * - 成績：哪一份的 `completedAt` 比較晚用哪一份（一樣晚用伺服器的）。
 * - 訂單：伺服器的全留，加上送來的新 id。
 * - 孩子資料：用送來的（這一次存檔多半就是在改它）；送來是空的才留伺服器的。
 */
export interface SyncPayload {
  child: unknown;
  completedScores: unknown[];
  orders: unknown[];
  reportHistory: unknown[];
}

const idOf = (x: unknown): string | null => {
  const id = (x as { id?: unknown } | null)?.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
};

function latestCompletedAt(scores: unknown[]): number {
  let latest = 0;
  for (const s of scores) {
    const t = Date.parse(String((s as { completedAt?: unknown } | null)?.completedAt ?? ''));
    if (!Number.isNaN(t) && t > latest) latest = t;
  }
  return latest;
}

export function mergeStaleSave(stored: SyncPayload, incoming: SyncPayload, baseReportIds: ReadonlyArray<string>): SyncPayload {
  const base = new Set(baseReportIds);
  const storedReportIds = new Set(stored.reportHistory.map(idOf));
  const newReports = incoming.reportHistory.filter(r => {
    const id = idOf(r);
    return id !== null && !storedReportIds.has(id) && !base.has(id);
  });
  const storedOrderIds = new Set(stored.orders.map(idOf));
  const newOrders = incoming.orders.filter(o => {
    const id = idOf(o);
    return id !== null && !storedOrderIds.has(id);
  });
  return {
    child: incoming.child ?? stored.child,
    completedScores:
      latestCompletedAt(incoming.completedScores) > latestCompletedAt(stored.completedScores)
        ? incoming.completedScores
        : stored.completedScores,
    orders: [...stored.orders, ...newOrders],
    reportHistory: [...stored.reportHistory, ...newReports],
  };
}

/** 一列 `user_data` 的版本：`updated_at` 的毫秒數；讀不到回 null（不比版本，照舊整份存）。 */
export function revisionOf(row: { updated_at?: unknown } | null | undefined): number | null {
  if (!row?.updated_at) return null;
  const t = row.updated_at instanceof Date ? row.updated_at.getTime() : Date.parse(String(row.updated_at));
  return Number.isNaN(t) ? null : t;
}
