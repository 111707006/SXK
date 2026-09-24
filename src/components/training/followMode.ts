/**
 * 「跟练方式」（Keep 規格 §3.8）：按 GO 之後看示範片跟著做，或只看圖文步驟。
 *
 * 【存在瀏覽器本機，不上伺服器】
 * 這是個人偏好，不是資料：換一支手機回到預設「看示范片」沒有關係。所以不進 `t2_practice_prefs`。
 *
 * 【讀寫都包起來】
 * `localStorage` 在微信、隱私模式、iOS 的一些設定下讀不到或寫不進去，連拿 `window.localStorage`
 * 這個動作都可能丟例外。讀不到就是預設；寫不進去就是這一次有效（畫面上的狀態照換），下次回到預設。
 * 呼叫端傳一個「怎麼拿到 storage」的函式進來，讓「拿」這一步也在 try 裡，也讓測試不必有瀏覽器。
 */

export type FollowMode = 'video' | 'pictures';

export const FOLLOW_MODE_KEY = 'sxk.t2.followMode';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type StorageGetter = () => StorageLike | null | undefined;

/** 瀏覽器的 `localStorage`（伺服端渲染、測試時沒有 `window` 也不丟）。 */
export const browserStorage: StorageGetter = () => (typeof window === 'undefined' ? undefined : window.localStorage);

/** 家長上次選的；沒選過、讀不到、存的值認不得都是「看示范片」。 */
export function readFollowMode(storage: StorageGetter = browserStorage): FollowMode {
  try {
    return storage()?.getItem(FOLLOW_MODE_KEY) === 'pictures' ? 'pictures' : 'video';
  } catch {
    return 'video';
  }
}

/** 記下家長選的。寫不進去回 `false`（呼叫端照樣用這一次選的，只是下次不記得）。 */
export function writeFollowMode(storage: StorageGetter, mode: FollowMode): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(FOLLOW_MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

/** 按 GO 之後實際走哪一種：沒有示範片一律圖文。 */
export function followModeFor(chosen: FollowMode, hasClip: boolean): FollowMode {
  return hasClip ? chosen : 'pictures';
}
