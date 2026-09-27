import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { resolveMediaUpstream } from '../src/mediaProxy';

/**
 * `/media` 的上游代理（Render 展示環境，2026-09-27；`src/mediaProxy.ts`）。
 *
 * Render 上沒有片子，瀏覽器又不能直接嵌正式站的（正式站回 `Cross-Origin-Resource-Policy: same-origin`），
 * 所以由伺服器去拿。這裡用一台本機的假「正式站」驗：
 * 1. **Range 原樣轉**：206＋Content-Range 少一個，iPhone 就拒播 —— 只有實機才看得到的故障。
 * 2. **本機有檔就不問上游**：正式站 A 若哪天也設了這個變數，不能每支片都繞一圈。
 * 3. **只代理 `/activities/A001.mp4|jpg` 那一種網址**：這台伺服器不能變成替任何人向正式站拿東西的機器。
 * 4. **上游壞了回 502，不把錯誤頁當片子吐出去**；上游 404 照回 404。
 */

const CLIP = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
const LOCAL_POSTER = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-media-proxy-'));
process.env.MEDIA_DIR = TMP;
fs.mkdirSync(path.join(TMP, 'activities'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'activities', 'A002.jpg'), LOCAL_POSTER);

/** 上游收到過的請求（路徑＋Range），驗「沒有去問」用。 */
const asked: Array<{ path: string; range?: string }> = [];

const upstream = http.createServer((req, res) => {
  asked.push({ path: req.url ?? '', range: req.headers.range });
  if (req.url === '/media/activities/A099.mp4') {
    res.writeHead(500, { 'Content-Type': 'text/html' }).end('<h1>oops</h1>');
    return;
  }
  if (req.url !== '/media/activities/A001.mp4') {
    res.writeHead(404).end();
    return;
  }
  const common = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    ETag: '"clip-1"',
    'Cache-Control': 'public, max-age=3600',
  };
  const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? '');
  if (m) {
    const [start, end] = [Number(m[1]), Number(m[2])];
    res.writeHead(206, { ...common, 'Content-Range': `bytes ${start}-${end}/${CLIP.length}`, 'Content-Length': end - start + 1 });
    res.end(req.method === 'HEAD' ? undefined : CLIP.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { ...common, 'Content-Length': CLIP.length });
  res.end(req.method === 'HEAD' ? undefined : CLIP);
});

let client: TestClient;

beforeAll(async () => {
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  // 在載入 server.ts 之前設：它在模組層級就讀掉了。
  process.env.MEDIA_UPSTREAM = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  await new Promise<void>(resolve => upstream.close(() => resolve()));
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('本機沒有的片，向上游拿', () => {
  it('整支：200、video/mp4、位元組原樣、宣告支援 Range', async () => {
    const res = await client.get('/media/activities/A001.mp4');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('etag')).toBe('"clip-1"');
    expect(Buffer.from(await res.arrayBuffer()).equals(CLIP)).toBe(true);
  });

  it('Range：206、Content-Range、只回那一段', async () => {
    const res = await client.get('/media/activities/A001.mp4', { Range: 'bytes=10-19' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 10-19/1000');
    expect(Buffer.from(await res.arrayBuffer()).equals(CLIP.subarray(10, 20))).toBe(true);
    expect(asked.at(-1)).toEqual({ path: '/media/activities/A001.mp4', range: 'bytes=10-19' });
  });

  it('HEAD：有長度、沒有本體', async () => {
    const res = await client.request('/media/activities/A001.mp4', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe(String(CLIP.length));
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it('上游 404 照回 404', async () => {
    const res = await client.get('/media/activities/A123.mp4');
    expect(res.status).toBe(404);
  });

  it('上游壞了回 502，不把它的錯誤頁吐出去', async () => {
    const res = await client.get('/media/activities/A099.mp4');
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('');
  });
});

describe('不問上游的情況', () => {
  it('本機有檔就用本機的', async () => {
    const before = asked.length;
    const res = await client.get('/media/activities/A002.jpg');
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(LOCAL_POSTER)).toBe(true);
    expect(asked.length).toBe(before);
  });

  it.each([
    ['別的目錄', '/media/other/A001.mp4'],
    ['別的副檔名', '/media/activities/A001.txt'],
    ['不是活動編號', '/media/activities/index.mp4'],
    ['路徑穿越', '/media/activities/..%2f..%2fetc%2fpasswd'],
  ])('%s：404，而且沒有去問上游', async (_label, url) => {
    const before = asked.length;
    const res = await client.get(url);
    expect(res.status).toBe(404);
    expect(asked.length).toBe(before);
  });
});

describe('resolveMediaUpstream：MEDIA_UPSTREAM 收什麼', () => {
  it('沒設＝不代理', () => {
    expect(resolveMediaUpstream(undefined)).toBeNull();
    expect(resolveMediaUpstream('  ')).toBeNull();
  });

  it('https 的主機，結尾斜線可有可無', () => {
    expect(resolveMediaUpstream('https://sxkscreen.com')).toBe('https://sxkscreen.com');
    expect(resolveMediaUpstream('https://sxkscreen.com/')).toBe('https://sxkscreen.com');
  });

  it('本機測試才收 http', () => {
    expect(resolveMediaUpstream('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    expect(() => resolveMediaUpstream('http://sxkscreen.com')).toThrow(/https/);
  });

  // 打錯字的後果是展示環境每一支片都 404，畫面上只是一張張破圖 —— 寧可起不來。
  it.each([
    ['沒有協定', 'sxkscreen.com'],
    ['帶了路徑', 'https://sxkscreen.com/media'],
    ['帶了查詢字串', 'https://sxkscreen.com/?x=1'],
    ['帶了帳密', 'https://u:p@sxkscreen.com'],
  ])('%s：丟錯讓程序起不來', (_label, value) => {
    expect(() => resolveMediaUpstream(value)).toThrow();
  });
});
