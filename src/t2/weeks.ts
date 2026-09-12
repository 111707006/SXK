/**
 * 「哪一週」（票 #60，規格 v2 §9.2 `GET /api/t2/weekly-plan?week=`）。純函式，沒有 I/O。
 *
 * 【為什麼要有這一檔】
 * 每週活動是**一週一筆**：同一週查兩次要拿到同一份。那句話只有在「哪一週」有唯一答案時才成立，
 * 而「今天是哪一週」牽涉兩件會漂的事：星期幾算一週的開始、用誰的時區算。兩件都寫死在這裡，
 * 因為它們同時決定資料庫裡的 `week_start` 與家長畫面上的日期 —— 兩邊各算一次就會在跨日那幾個
 * 小時對不上，而對不上的症狀是「星期一早上活動換了兩次」。
 *
 * 【時區：Asia/Shanghai，寫死】
 * 與 `src/admin/adminView.ts` 同一個理由：這個模組同時跑在伺服器與瀏覽器上。用執行環境的本地
 * 時區的話，同一位家長在伺服器（UTC 的容器）與手機（+08:00）上會拿到不同的「這一週」。
 * 用固定偏移量而不是 `Intl`：中國沒有日光節約時間，一個常數就夠，而 `Intl` 的時區資料在
 * 精簡過的 Node 映像檔裡不一定在。
 *
 * 【一週從星期一開始】
 * 客戶的活動是「這一週練什麼」，而家長講的一週是週一到週日。星期日開始（`getDay() === 0`）
 * 是 JavaScript 的預設，不是任何人的生活。
 */

/** Asia/Shanghai 相對 UTC 的偏移量（分鐘）。中國沒有日光節約時間，所以是一個常數。 */
export const WEEK_TIME_ZONE_OFFSET_MINUTES = 8 * 60;

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 一個 `YYYY-MM-DD` 是不是真的日期（`'2026-02-31'` 不是）。
 * 只認這一種格式：`Date.parse` 對 `'2026/9/1'`、`'Sep 1 2026'` 也點頭，而那些字串從查詢字串
 * 進來時，我們無從得知家長的瀏覽器是怎麼組出來的。
 */
export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** 這個瞬間在 Asia/Shanghai 是哪一天（`YYYY-MM-DD`）。 */
export function calendarDateOf(instant: Date): string {
  const shifted = new Date(instant.getTime() + WEEK_TIME_ZONE_OFFSET_MINUTES * MS_PER_MINUTE);
  return shifted.toISOString().slice(0, 10);
}

/**
 * 這一天所在那一週的**星期一**（`YYYY-MM-DD`）。
 *
 * 吃 `YYYY-MM-DD`（當成 Asia/Shanghai 的日曆日）或一個瞬間（先換算成 Asia/Shanghai 的日曆日）。
 * 認不得的字串丟錯 —— 查詢字串上的 `week=` 是家長的瀏覽器組出來的，安靜地當成「這一週」的話，
 * 家長會看到一份與他選的日期無關的活動，而畫面上沒有任何地方看得出來。
 */
export function weekStartOf(day: Date | string): string {
  const date = typeof day === 'string' ? day : calendarDateOf(day);
  if (!isCalendarDate(date)) {
    throw new Error(`weeks：要是 YYYY-MM-DD 的日期，拿到 ${JSON.stringify(day)}`);
  }
  const [y, m, d] = date.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  // getUTCDay()：0 是星期日。往前推到星期一 → (dow + 6) % 7 天。
  const back = (new Date(utc).getUTCDay() + 6) % 7;
  return new Date(utc - back * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 這一週的星期日（`YYYY-MM-DD`）。畫面上寫「9 月 7 日 – 9 月 13 日」用的。 */
export function weekEndOf(day: Date | string): string {
  const start = weekStartOf(day);
  return new Date(Date.parse(`${start}T00:00:00.000Z`) + 6 * MS_PER_DAY).toISOString().slice(0, 10);
}
