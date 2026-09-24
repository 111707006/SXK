import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 示範片與封面的靜態目錄 `/media`（Keep 規格 K05、§6.2 甲，使用者 2026-09-24 定）。
 *
 * 【為什麼不放 `dist/`】
 * `dist/` 每次部署整個換掉，片子放進去下一次部署就沒了。所以片子另放一個目錄（預設
 * `<cwd>/media`，`MEDIA_DIR` 可覆寫），由 `server.ts` 掛在 `/media`，網址是 `/media/activities/A001.mp4`。
 *
 * 【這裡在防什麼】
 * 1. **Range 要回 206**：iPhone 的 Safari／微信播 mp4 一定先要一段 bytes，伺服器回 200 整支的話
 *    iOS 會直接拒播 —— 那是一台一台實機才看得到的故障。
 * 2. **不存在要 404，不能落到 SPA 兜底**：正式站的 `app.get('*')` 會對任何路徑回 `index.html`＋200，
 *    `<video>` 拿到一頁 HTML 不會報錯，只是播不動；封面是一張破圖。
 * 3. **目錄不在不能讓伺服器起不來**：專案 A 的主機第一次部署新版時片子可能還沒傳上去。
 * 4. **快取不能是 immutable**：檔名固定（A001.mp4），內容可能換（客戶補拍）。
 * 5. 專案 B 沒有這條路（另一檔 `activityMediaProjectB.http.test.ts`）。
 *
 * 不驗登入與付費：片子是公開的靜態網址，網址本身只在付費閘門後的活動資料裡拿得到（規格沒要求鎖片子）。
 */

// 目錄**先不建**：載入 server.ts 的那一刻它不在（第 3 條），之後才放檔進去。
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-media-'));
const MEDIA = path.join(TMP, 'media');
process.env.MEDIA_DIR = MEDIA;

/** 一支假的「片」：內容不必是真的 mp4，只要位元組可以逐一比對。 */
const CLIP = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
const POSTER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('目錄還不在（第一次部署、片子還沒傳上去）', () => {
  it('伺服器照樣起得來，片子回 404', async () => {
    const res = await client.get('/media/activities/A001.mp4');
    expect(res.status).toBe(404);
  });
});

describe('目錄在', () => {
  beforeAll(() => {
    fs.mkdirSync(path.join(MEDIA, 'activities'), { recursive: true });
    fs.writeFileSync(path.join(MEDIA, 'activities', 'A001.mp4'), CLIP);
    fs.writeFileSync(path.join(MEDIA, 'activities', 'A001.jpg'), POSTER);
  });

  it('整支：200、video/mp4、位元組原樣、宣告支援 Range', async () => {
    const res = await client.get('/media/activities/A001.mp4');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(Buffer.from(await res.arrayBuffer()).equals(CLIP)).toBe(true);
  });

  it('Range：206、Content-Range 對、只給那一段（iOS 播 mp4 必要）', async () => {
    const res = await client.get('/media/activities/A001.mp4', { Range: 'bytes=100-199' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 100-199/${CLIP.length}`);
    expect(Buffer.from(await res.arrayBuffer()).equals(CLIP.subarray(100, 200))).toBe(true);
  });

  it('iOS 的第一個探測請求 bytes=0-1 也是 206', async () => {
    const res = await client.get('/media/activities/A001.mp4', { Range: 'bytes=0-1' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 0-1/${CLIP.length}`);
  });

  it('封面：200、image/jpeg', async () => {
    const res = await client.get('/media/activities/A001.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer()).equals(POSTER)).toBe(true);
  });

  it('快取：有 ETag、max-age 不超過一天、不是 immutable（檔名固定、內容可能換）', async () => {
    const res = await client.get('/media/activities/A001.mp4');
    expect(res.headers.get('etag')).toBeTruthy();
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).not.toMatch(/immutable/);
    const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('帶 ETag 再問一次：304', async () => {
    const first = await client.get('/media/activities/A001.mp4');
    const etag = first.headers.get('etag')!;
    // 瀏覽器重新驗證時送的是 `max-age=0`。不自己帶的話，Node 的 fetch 會替條件請求補上
    // `Cache-Control: no-cache`（fetch 規格），伺服器依規定就不回 304 —— 那是測試工具的行為，不是伺服器的。
    const again = await client.get('/media/activities/A001.mp4', { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' });
    expect(again.status).toBe(304);
  });

  it.each([
    ['不存在的片', '/media/activities/A020.mp4'],
    ['目錄本身（不列目錄、不轉址）', '/media/activities/'],
    ['目錄不加斜線', '/media/activities'],
    ['往上跳出目錄', '/media/activities/..%2f..%2fpackage.json'],
    ['點開頭的檔', '/media/activities/.DS_Store'],
  ])('%s：404，不落到 SPA 兜底', async (_, url) => {
    if (url.endsWith('.DS_Store')) fs.writeFileSync(path.join(MEDIA, 'activities', '.DS_Store'), 'x');
    const res = await client.get(url);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type') ?? '').not.toMatch(/text\/html/);
  });

  it('只收 GET／HEAD：POST 404', async () => {
    const res = await client.request('/media/activities/A001.mp4', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('HEAD：200、帶長度、沒有內容', async () => {
    const res = await client.request('/media/activities/A001.mp4', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe(String(CLIP.length));
  });

  it('跑著的時候目錄被整個拿掉：404，不是 500', async () => {
    fs.rmSync(MEDIA, { recursive: true, force: true });
    const res = await client.get('/media/activities/A001.mp4');
    expect(res.status).toBe(404);
  });
});
