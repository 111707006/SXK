/**
 * 後台上傳示範片與封面（使用者 2026-10-08：「後台要做一個能夠放影片的地方」，客戶之後自己傳 300 支）。
 *
 * 【放哪裡】照 Keep 規格 K05 的定案：主機上的 `MEDIA_DIR/activities/`，檔名就是活動編號
 * （`A001.mp4`、`A001.jpg`），`server.ts` 已經把那個目錄掛在 `/media`（只在專案 A）。頻寬與物件儲存之後再說
 * （使用者同日：「頻寬之後弄，現在不用」）。日後搬物件儲存只換這一檔的寫入與網址。
 *
 * 【怎麼收】請求本體就是檔案（`Content-Type: video/mp4`／`image/jpeg`），不經 multipart、不進記憶體：
 * 一路串流寫到同目錄的暫存檔，超過上限立刻停、刪暫存檔回 413；寫完看開頭幾個位元組
 * （mp4 第 4–8 位元組是 `ftyp`、jpeg 開頭 `FF D8 FF`），對了才改名蓋掉正式檔名 —— 改名是原子的，
 * 家長正在看的那一支不會讀到半個檔。檔名由伺服器依編號決定，不收前端的檔名（不會寫到目錄外）。
 *
 * 【封面與片長】主機上不保證有 ffmpeg，所以由後台的瀏覽器抽一格當封面、讀片長
 * （`src/admin/videoFrame.ts`），封面另一支上傳；片長跟著影片那一支的 `?seconds=` 送來，伺服器只檢查範圍。
 *
 * 【網址帶版本】存進活動庫的網址是 `/media/activities/A001.mp4?v=<時間>`：`/media` 快取一小時，
 * 客戶換一支片、檔名不變的話，家長最久一小時看到的還是舊的；帶了版本就是新網址。`/media` 不看查詢字串。
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Readable } from 'stream';

/** 一支示範片的上限。客戶的片是 10 秒到幾分鐘的手機片，300 MB 是寬界；更大的多半是傳錯檔。 */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
/** 封面上限（瀏覽器抽出來的 960 寬 jpeg 約 100 KB）。 */
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
/** 片長上限（秒），同 `activityAdmin.ts` 的 `MAX_VIDEO_SECONDS` 一樣寬。 */
export const MAX_UPLOAD_SECONDS = 3600;

export type MediaKind = 'video' | 'poster';

const EXT: Record<MediaKind, string> = { video: 'mp4', poster: 'jpg' };
const MAX_BYTES: Record<MediaKind, number> = { video: MAX_VIDEO_BYTES, poster: MAX_POSTER_BYTES };
const CONTENT_TYPES: Record<MediaKind, ReadonlyArray<string>> = {
  video: ['video/mp4'],
  poster: ['image/jpeg'],
};
const WHAT: Record<MediaKind, string> = { video: '示范片', poster: '封面' };

/** 看開頭幾個位元組認檔案種類。 */
export function looksLike(kind: MediaKind, head: Buffer): boolean {
  if (kind === 'video') return head.length >= 8 && head.subarray(4, 8).toString('latin1') === 'ftyp';
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

/** 存進活動庫的網址（帶版本，理由見檔頭）。 */
export function mediaUrlOf(activityId: string, kind: MediaKind, version: number): string {
  return `/media/activities/${activityId}.${EXT[kind]}?v=${version}`;
}

/** `?seconds=` → 片長；沒帶是 null，帶了但不對回 undefined。 */
export function readSeconds(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= 1 && n <= MAX_UPLOAD_SECONDS ? n : undefined;
}

export type SaveResult = { ok: true; bytes: number } | { ok: false; status: number; error: string };

/**
 * 把請求本體存成 `<dir>/activities/<id>.<ext>`。`contentType` 是請求的標頭（不認得的直接 415，一個位元組都不收）。
 * 檔名只由 `activityId` 決定，呼叫端要先確認它符合 `A\d{3}` 且活動庫裡有。
 */
export async function saveActivityMedia(
  body: Readable,
  contentType: string | undefined,
  dir: string,
  activityId: string,
  kind: MediaKind,
  max: number = MAX_BYTES[kind],
): Promise<SaveResult> {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!CONTENT_TYPES[kind].includes(type)) {
    body.resume();
    return { ok: false, status: 415, error: kind === 'video' ? '示范片只收 mp4 档。' : '封面只收 jpg 图。' };
  }
  const folder = path.join(dir, 'activities');
  await fs.promises.mkdir(folder, { recursive: true });
  const finalPath = path.join(folder, `${activityId}.${EXT[kind]}`);
  const tmpPath = path.join(folder, `.upload-${activityId}-${crypto.randomBytes(6).toString('hex')}`);

  let bytes = 0;
  let head = Buffer.alloc(0);
  let tooBig = false;
  const out = fs.createWriteStream(tmpPath, { flags: 'wx' });
  try {
    await new Promise<void>((resolve, reject) => {
      body.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
        if (bytes > max) {
          tooBig = true;
          body.unpipe(out);
          body.resume();
          out.destroy();
          resolve();
        }
      });
      body.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      body.pipe(out);
    });
  } catch (err) {
    await fs.promises.rm(tmpPath, { force: true });
    throw err;
  }

  const refuse = async (status: number, error: string): Promise<SaveResult> => {
    await fs.promises.rm(tmpPath, { force: true });
    return { ok: false, status, error };
  };
  if (tooBig) return refuse(413, `${WHAT[kind]}太大了（上限 ${Math.round(max / 1024 / 1024)} MB）。`);
  if (bytes === 0) return refuse(400, `没有收到${WHAT[kind]}的内容。`);
  if (!looksLike(kind, head)) return refuse(415, kind === 'video' ? '这个档案不是 mp4 影片。' : '这个档案不是 jpg 图。');

  await fs.promises.rename(tmpPath, finalPath);
  return { ok: true, bytes };
}
