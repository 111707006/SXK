/**
 * 跟裝置有關的兩件事（Keep 規格 §3.8，票 7）。實機行為（微信、AirPlay、Chromecast）要在手機上驗；
 * 這裡只放判斷，測試在 `test/trainingDevice.test.ts`。
 */

/**
 * 微信內建瀏覽器（iPhone 與 Android 都帶 `MicroMessenger`）。它下載不了檔案，`.ics` 要先
 *「在浏览器打开」；投屏也叫不出瀏覽器的選單。
 */
export function isWeChatBrowser(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}

type CastableVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };

/**
 * 先試瀏覽器自己的投屏：`video.remote.prompt()`（Remote Playback API，Chrome 與 Safari）、再試 Safari 的
 * `webkitShowPlaybackTargetPicker()`（AirPlay）。叫得出來回 `true`；叫不出來（沒有片、附近沒有裝置、
 * 瀏覽器不支援）回 `false`，呼叫端開說明抽屜。
 *
 * 家長自己把選單關掉（`NotAllowedError`）算叫得出來：他看過選單了，不必再跳一張說明。
 * **要在點擊的當下呼叫**（不能先 await 別的東西）：瀏覽器只在使用者操作裡放行這個選單。
 */
export async function tryNativeCast(video: HTMLVideoElement | null): Promise<boolean> {
  const v = video as CastableVideo | null;
  if (!v) return false;
  if (v.remote && typeof v.remote.prompt === 'function') {
    try {
      await v.remote.prompt();
      return true;
    } catch (err) {
      return err instanceof DOMException && err.name === 'NotAllowedError';
    }
  }
  if (typeof v.webkitShowPlaybackTargetPicker === 'function') {
    try {
      v.webkitShowPlaybackTargetPicker();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
