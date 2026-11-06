/**
 * 進站連結＋二維碼＋「下载二维码」（客戶 11/03 第 2、29 頁）：合作公司分頁與推薦人分頁共用。
 * 點「二维码」展開一張小圖，下載是 PNG（`entryQr.ts` 在瀏覽器畫）。
 */
import { useEffect, useRef, useState } from 'react';
import { Download, QrCode } from 'lucide-react';
import { drawQr, entryQrFileName, qrMatrix } from './entryQr';
import { Button } from './ui';

export default function EntryLinkQr({ url, code }: { url: string; code: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && ref.current) drawQr(ref.current, qrMatrix(url), 4);
  }, [open, url]);

  const download = () => {
    const canvas = drawQr(document.createElement('canvas'), qrMatrix(url), 12);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = entryQrFileName(code);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-1.5">
      <code className="block break-all text-[10px] text-brand-charcoal/55">{url}</code>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <QrCode size={12} /> {open ? '收起二维码' : '二维码'}
        </Button>
        <Button variant="ghost" className="!px-2 !py-1" id={`entry-qr-download-${code}`} onClick={download}>
          <Download size={12} /> 下载二维码
        </Button>
      </div>
      {open && <canvas ref={ref} aria-label={`${url} 的二维码`} className="h-[120px] w-[120px] rounded-lg border border-brand-stone" />}
    </div>
  );
}
