/**
 * 在後台的瀏覽器裡讀一支示範片的片長、抽一格當封面（主機上不保證有 ffmpeg，見 `activityMedia.ts` 檔頭）。
 *
 * 抽第 1 秒（片子不到 3 秒就抽三分之一處）—— 第 0 格常是黑的。封面 960 寬、jpeg，與
 * `scripts/t2-prepare-media.ts` 抽的那 17 張同尺寸。讀不到（瀏覽器不支援那種編碼）就回 `poster: null`，
 * 片子照樣傳，封面之後可以再補；片長讀不到也是 null。逾時 20 秒。
 */

export interface VideoInfo {
  seconds: number | null;
  poster: Blob | null;
}

const POSTER_WIDTH = 960;

export function readVideoInfo(file: Blob, timeoutMs = 20_000): Promise<VideoInfo> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    let seconds: number | null = null;
    let finished = false;
    const finish = (poster: Blob | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve({ seconds, poster });
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        seconds = Math.max(1, Math.round(video.duration));
        video.currentTime = video.duration < 3 ? video.duration / 3 : 1;
      } else {
        finish(null);
      }
    };
    video.onseeked = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);
      const canvas = document.createElement('canvas');
      canvas.width = POSTER_WIDTH;
      canvas.height = Math.round((h / w) * POSTER_WIDTH);
      const ctx = canvas.getContext('2d');
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => finish(blob), 'image/jpeg', 0.85);
    };
    video.src = url;
  });
}
