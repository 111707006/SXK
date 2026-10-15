/**
 * 「线上干预」自己的收費站（使用者 2026-09-29：線上干預跟報告分開，從報告轉到線上干預那裡**再收一次**，
 * 但**現在先不收錢，直接通過**）。
 *
 * 線上干預要先買過 T2（使用者 2026-10-15 釐清，ADR-0012）：兩次付費分開但有先後 —— 先付費做 T2、拿到報告，
 * 線上干預的購買入口只在 T2 報告裡。所以線上干預的端點兩道都過：先過 T2 閘門，再過這一道；價錢
 * `TRAINING_PRICE_FEN`（預設 0＝免費）。沒買 T2 的家長打這幾支是 403（T2 閘門），線上干預頁顯示「上鎖」。
 *
 * 要開始收錢時：得先做一份「線上干預」的訂單與權益（付款、回呼、解鎖紀錄，同 T2 那一套），
 * 再讓這裡看它。在那之前設成非 0 會讓程序起不來 —— 一個寫著收費、其實誰都進得去（或誰都進不去）的收費站
 * 比沒有更糟。
 */

/**
 * 線上干預的端點（相對 `/api/t2`）看第一段。與 T2 閘門的分流只看這一份：
 * 認錯方向是安全的 —— 沒認出來的路徑落回 T2 閘門（更嚴）；而這幾段與 T2 自己的路徑
 * （`plan`、`tool-results`、`findings`）沒有交集，T2 的端點不會被當成線上干預放出去。
 * 比對照 Express 的路由規則：不分大小寫、容許結尾斜線（同 `server.ts` 的 `isT2IcsPath`）。
 */
const TRAINING_SEGMENTS: ReadonlySet<string> = new Set([
  'weekly-plan',
  'training-period',
  'library',
  'activities',
  'checkins',
  'practice-prefs',
  'practice-prefs.ics',
]);

export function isTrainingPath(path: string): boolean {
  const first = path.toLowerCase().replace(/^\/+/, '').split('/')[0];
  return TRAINING_SEGMENTS.has(first);
}

/** 線上干預的價錢（分）。沒設或 0 ＝ 免費、直接通過；其他值現在一律拒絕（見檔頭）。 */
export function resolveTrainingPriceFen(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value || value === '0') return 0;
  throw new Error(
    `TRAINING_PRICE_FEN=${JSON.stringify(raw)}：线上干预的收费还没接上付款（订单、回呼、解锁纪录都还没做），现在只能是 0 或不设。`,
  );
}
