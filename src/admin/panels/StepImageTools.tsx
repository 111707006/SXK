import { useRef, useState } from 'react';
import { Camera, ImageUp, Loader2, X } from 'lucide-react';
import { adminApi } from '../adminApi';

/**
 * 分解步驟的配圖（使用者 2026-10-21：「影片前面每個動作要有一張圖」）。兩條路，存的都是同一支端點：
 *
 * - 上傳圖片：手上有圖就直接傳（png 會先在瀏覽器轉成 jpeg）。
 * - 從示範片截這一格：在小播放器裡拖到這個動作的那一刻，按「用这一格」—— 後台的瀏覽器把畫面畫到 canvas
 *   轉 jpeg 再傳（同 `videoFrame.ts`，主機不必有 ffmpeg）。示範片在站內 `/media`，同源，canvas 讀得到。
 *
 * 上傳成功當場就存進活動庫（只改這一步的 `imageUrl`），所以表單裡還沒存的步驟增刪、搬順序會讓第幾步對不上：
 * 那時候按鈕停用，請先存檔。
 */

const WIDTH = 960;

function toJpeg(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.round((h / w) * WIDTH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

async function fileToJpeg(file: File): Promise<Blob | null> {
  if (file.type === 'image/jpeg') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function StepImageTools({ activityId, step, videoUrl, blockedReason, onUploaded }: {
  activityId: string;
  /** 第幾步，從 1 起 */
  step: number;
  /** 已存的示範片網址；沒有就不出「截一格」 */
  videoUrl: string | null;
  /** 有值＝現在不能傳（表單裡的步驟還沒存），按鈕停用並顯示這句 */
  blockedReason: string | null;
  onUploaded: (imageUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (blob: Blob | null) => {
    if (!blob) {
      setError('这张图读不出来，换一张试试。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { activity } = await adminApi.uploadStepImage(activityId, step, blob);
      const url = activity.steps[step - 1]?.imageUrl;
      if (url) onUploaded(url);
      setCapturing(false);
    } catch (err: any) {
      setError(err?.message ?? '上传失败，请再试一次。');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError('示范片还没载入好，等一下再按。');
      return;
    }
    v.pause();
    await send(await toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const disabled = busy || blockedReason !== null;
  const btn = 'inline-flex items-center gap-1 rounded-lg border border-brand-stone px-2.5 py-1.5 text-[11px] font-bold text-brand-forest hover:bg-brand-sage/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div className="space-y-2" data-testid={`step-image-tools-${step}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} disabled={disabled} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />}
          上传图片
        </button>
        {videoUrl && (
          <button type="button" className={btn} disabled={disabled} onClick={() => setCapturing(c => !c)}>
            <Camera size={12} />
            从示范片截这一格
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) await send(await fileToJpeg(f));
          }}
        />
      </div>
      {blockedReason && <p className="text-[11px] text-brand-charcoal/60">{blockedReason}</p>}
      {error && <p className="text-[11px] font-bold text-rose-700">{error}</p>}
      {capturing && videoUrl && (
        <div className="space-y-1.5 rounded-xl bg-brand-cream/40 p-2">
          <div className="flex items-center justify-between text-[11px] text-brand-charcoal/70">
            <span>拖到第 {step} 步这个动作的那一刻，再按「用这一格」</span>
            <button type="button" aria-label="收起" onClick={() => setCapturing(false)} className="cursor-pointer"><X size={12} /></button>
          </div>
          <video ref={videoRef} src={videoUrl} controls muted playsInline preload="auto" crossOrigin="anonymous" className="w-full rounded-lg bg-black" />
          <button type="button" className={btn} disabled={busy} onClick={() => void capture()}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            用这一格当第 {step} 步的图
          </button>
        </div>
      )}
    </div>
  );
}
