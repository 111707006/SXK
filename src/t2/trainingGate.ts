/**
 * 「线上干预」自己的收費站（使用者 2026-09-29：線上干預跟報告分開，從報告轉到線上干預那裡**再收一次**，
 * 但**現在先不收錢，直接通過**）。
 *
 * 原本線上干預的端點全躲在 T2 的付費閘門後面 —— 等於線上干預跟著 T2 一起賣。現在它們改走這一道：
 * 要登入，但不看有沒有買 T2；價錢 `TRAINING_PRICE_FEN`（預設 0＝免費）。T2 的報告照舊要買
 * （`/api/t2/findings*`、交卷那幾支還在 T2 閘門後面），所以沒買 T2 的家長進得了線上干預的頁面，
 * 但沒有報告、配不出活動 —— 頁面會帶他去做深度評估。
 *
 * 要開始收錢時：得先做一份「線上干預」的訂單與權益（付款、回呼、解鎖紀錄，同 T2 那一套），
 * 再讓這裡看它。在那之前設成非 0 會讓程序起不來 —— 一個寫著收費、其實誰都進得去（或誰都進不去）的收費站
 * 比沒有更糟。
 */

/**
 * 線上干預的端點（相對 `/api/t2`）看第一段。與 T2 閘門的分流只看這一份：
 * 認錯方向是安全的 —— 沒認出來的路徑落回 T2 閘門（更嚴）；而這幾段與 T2 自己的路徑
 * （`plan`、`diagnosis`、`tool-results`、`findings`）沒有交集，T2 的端點不會被當成線上干預放出去。
 * 比對照 Express 的路由規則：不分大小寫、容許結尾斜線（同 `server.ts` 的 `isT2IcsPath`）。
 */
const TRAINING_SEGMENTS: ReadonlySet<string> = new Set([
  'weekly-plan',
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
