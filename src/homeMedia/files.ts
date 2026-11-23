/**
 * 首頁素材的檔案（伺服器專用）：刪一張素材時，盡力把 `MEDIA_DIR/home/` 底下它的檔與封面一起刪掉。
 *
 * 只認 `/media/home/<檔名>[?v=…]` 這種網址、檔名只能是一段（不含 `/`、`\`、`..`），解出來的路徑還要落在
 * `home/` 裡面才動手 —— 資料庫裡的網址被竄改成 `/media/home/../../etc/passwd` 也碰不到外面。
 * 刪不掉（檔已經不在、權限）只回報，不讓請求失敗：那一列已經刪了，留一個沒人指到的檔不影響畫面。
 */
import fs from 'fs';
import path from 'path';

const PREFIX = '/media/home/';

/** 網址 → `home/` 裡的絕對路徑；不是這個資料夾裡的檔就回 null。 */
export function homeMediaFileOf(homeFolder: string, url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url.startsWith(PREFIX)) return null;
  const name = url.slice(PREFIX.length).split(/[?#]/)[0];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) return null;
  const root = path.resolve(homeFolder);
  const full = path.resolve(root, name);
  return path.dirname(full) === root ? full : null;
}

/** 刪掉這些網址對到的檔；回刪不掉的（給呼叫端記 log）。找不到檔不算失敗。 */
export async function removeHomeMediaFiles(homeFolder: string, urls: Array<string | null | undefined>): Promise<string[]> {
  const failed: string[] = [];
  for (const url of urls) {
    const file = homeMediaFileOf(homeFolder, url);
    if (!file) continue;
    try {
      await fs.promises.rm(file, { force: true });
    } catch (err: any) {
      failed.push(`${path.basename(file)}: ${err?.message ?? err}`);
    }
  }
  return failed;
}
