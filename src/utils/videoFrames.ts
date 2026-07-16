/**
 * Client-side video frame extraction (no ffmpeg / no server upload).
 * Loads a video File into a hidden <video>, seeks to evenly-spaced timestamps,
 * draws each frame to a downscaled canvas and returns JPEG base64 data URLs.
 * Keeps the payload small enough to POST as JSON to the motion-eval endpoint.
 */
export async function extractVideoFrames(
  file: File,
  frameCount: number = 8,
  maxWidth: number = 640,
  quality: number = 0.7
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    (video as any).playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    const frames: string[] = [];
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let targets: number[] = [];
    let idx = 0;

    const fail = (err: any) => { cleanup(); reject(err instanceof Error ? err : new Error(String(err))); };

    video.onerror = () => fail(new Error('无法读取视频文件'));

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const w = video.videoWidth || maxWidth;
      const h = video.videoHeight || Math.round(maxWidth * 9 / 16);
      const scale = w > maxWidth ? maxWidth / w : 1;
      canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx = canvas.getContext('2d');
      if (!ctx) return fail(new Error('canvas 不可用'));

      if (duration === 0) {
        // Streaming/unknown-duration fallback: grab a single current frame
        targets = [0];
      } else {
        targets = Array.from({ length: frameCount }, (_, i) =>
          Math.min(duration - 0.05, ((i + 0.5) / frameCount) * duration)
        );
      }
      seekNext();
    };

    const seekNext = () => {
      if (idx >= targets.length) { cleanup(); return resolve(frames); }
      try {
        video.currentTime = targets[idx];
      } catch (e) {
        fail(e);
      }
    };

    video.onseeked = () => {
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        return fail(e);
      }
      idx++;
      seekNext();
    };

    // Safety timeout so a stuck seek never hangs the UI forever
    setTimeout(() => {
      if (frames.length > 0) { cleanup(); resolve(frames); }
      else fail(new Error('抽帧超时'));
    }, 20000);
  });
}
