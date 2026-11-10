/**
 * 企業微信客服二維碼（使用者 2026-11-10：「二維碼後台可以換」，放在後台「合作公司」分頁）。**只給伺服器**。
 *
 * 一張預設（未歸屬的家長、或公司沒設自己的）＋每家合作公司各一張（選填）。
 * 檔案就是資料：存在 `MEDIA_DIR/wecom/default.<jpg|png>`、`company-<id>.<jpg|png>`，不另開資料表、不必跑遷移。
 * 網址帶 `?v=<修改時間>`（`/media` 快取一小時，換圖要立刻生效）。
 * 都沒有＝家長端照舊用建置內建的 `/kefu-qr.jpg`（`PRODUCT.expertBooking.wechatQrSrc`）。
 */
import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import { saveUpload, type UploadResult, type UploadSpec } from '../admin/activityMedia';

export type WecomQrKey = 'default' | { companyId: number };

/** 上限 2 MB（同首頁素材的圖）。 */
export const MAX_WECOM_QR_BYTES = 2 * 1024 * 1024;
const EXTS = ['jpg', 'png'] as const;

const isJpg = (h: Buffer) => h.length >= 3 && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
const isPng = (h: Buffer) => h.length >= 4 && h[0] === 0x89 && h.subarray(1, 4).toString('latin1') === 'PNG';

const SPEC: UploadSpec = {
  types: { 'image/jpeg': 'jpg', 'image/png': 'png' },
  max: MAX_WECOM_QR_BYTES,
  looksRight: (h, ext) => (ext === 'png' ? isPng(h) : isJpg(h)),
  what: '二维码图',
  wrongType: '二维码只收 jpg 或 png 图。',
  wrongContent: '这个档案不是 jpg／png 图。',
};

export function stemOf(key: WecomQrKey): string {
  return key === 'default' ? 'default' : `company-${key.companyId}`;
}

const folderOf = (mediaDir: string) => path.join(mediaDir, 'wecom');

/** 這一張的網址（`/media/wecom/<檔名>?v=<修改時間>`），沒有就 `null`。 */
export async function findWecomQr(mediaDir: string, key: WecomQrKey): Promise<string | null> {
  const stem = stemOf(key);
  for (const ext of EXTS) {
    try {
      const st = await fs.promises.stat(path.join(folderOf(mediaDir), `${stem}.${ext}`));
      if (st.isFile()) return `/media/wecom/${stem}.${ext}?v=${Math.floor(st.mtimeMs)}`;
    } catch {
      // 沒有這個副檔名
    }
  }
  return null;
}

/** 目錄裡全部：預設那一張與每家公司的（鍵是公司 id）。 */
export async function listWecomQrs(mediaDir: string): Promise<{ default: string | null; companies: Record<number, string> }> {
  let files: string[] = [];
  try {
    files = await fs.promises.readdir(folderOf(mediaDir));
  } catch {
    // 目錄還不在
  }
  const companies: Record<number, string> = {};
  for (const f of files) {
    const m = /^company-(\d{1,9})\.(jpg|png)$/.exec(f);
    if (m && companies[Number(m[1])] === undefined) {
      const url = await findWecomQr(mediaDir, { companyId: Number(m[1]) });
      if (url) companies[Number(m[1])] = url;
    }
  }
  return { default: await findWecomQr(mediaDir, 'default'), companies };
}

/** 存一張（請求本體就是圖）；成功後刪掉另一個副檔名的舊檔，同一個鍵永遠只有一張。 */
export async function saveWecomQr(body: Readable, contentType: string | undefined, mediaDir: string, key: WecomQrKey): Promise<UploadResult> {
  const stem = stemOf(key);
  const saved = await saveUpload(body, contentType, folderOf(mediaDir), stem, SPEC);
  if (saved.ok) {
    for (const ext of EXTS) {
      if (ext !== saved.ext) await fs.promises.rm(path.join(folderOf(mediaDir), `${stem}.${ext}`), { force: true });
    }
  }
  return saved;
}

/** 拿掉這一張（回到上一層：公司 → 預設 → 內建）。 */
export async function removeWecomQr(mediaDir: string, key: WecomQrKey): Promise<void> {
  const stem = stemOf(key);
  for (const ext of EXTS) await fs.promises.rm(path.join(folderOf(mediaDir), `${stem}.${ext}`), { force: true });
}
