import { describe, it, expect } from 'vitest';
import path from 'path';
import { homeMediaFileOf } from '../src/homeMedia/files';

/** 刪首頁素材時要刪的檔：只認 `/media/home/<一段檔名>`，解出來一定在 `home/` 裡面。 */
describe('homeMediaFileOf', () => {
  const root = path.resolve('/srv/media/home');
  it('正常的網址（帶 ?v=）→ home/ 裡的檔', () => {
    expect(homeMediaFileOf(root, '/media/home/banner-1-abcd1234.jpg?v=17')).toBe(path.join(root, 'banner-1-abcd1234.jpg'));
    expect(homeMediaFileOf(root, '/media/home/poster-3-0a0b0c0d.jpg')).toBe(path.join(root, 'poster-3-0a0b0c0d.jpg'));
  });
  it('穿越、別的資料夾、子目錄、編碼過的斜線、空的一律 null', () => {
    for (const bad of [
      '/media/home/../outside.txt', '/media/home/..', '/media/home/a/b.jpg', '/media/home/..%2Fx', '/media/home/%2e%2e',
      '/media/activities/A001.mp4', 'https://evil.com/media/home/x.jpg', '/media/home/', '/media/home/.hidden', null, undefined, '',
    ]) expect(homeMediaFileOf(root, bad as any), String(bad)).toBeNull();
  });
});
