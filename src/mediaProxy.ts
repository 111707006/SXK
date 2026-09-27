/**
 * `/media` 的上游代理（Render 展示環境用，2026-09-27）。
 *
 * 【為什麼要有】
 * 示範片只放在正式站主機的 `/var/www/sxk/media/`（Keep 規格 K05，不進 git、不進 `dist/`），
 * Render 上沒有。直接把網址指到 `https://sxkscreen.com/media/…` 行不通：正式站整站過 helmet，
 * 回應帶 `Cross-Origin-Resource-Policy: same-origin`，瀏覽器會擋掉別的網站嵌入的 `<video>`／`<img>`。
 * 所以由 Render 的伺服器去拿（伺服器對伺服器不受 CORP 管），再原樣吐給家長的瀏覽器：
 * 正式站一行都不用改，資料庫裡的網址也照舊是 `/media/activities/A001.mp4`。
 *
 * 【怎麼接】`server.ts` 在 `/media` 的 `express.static` 後面掛它：本機有檔就用本機的，
 * 沒有才問上游。`MEDIA_UPSTREAM` 沒設就不掛 —— 正式站 A 照舊。
 *
 * 【只代理一種網址】`/activities/A001.mp4`、`/activities/A001.jpg`。這台伺服器不該變成一台
 * 替任何人向正式站拿任何東西的機器；其餘路徑交給下一個處理者（404）。
 *
 * 【原樣轉的東西】Range／If-None-Match／If-Modified-Since 往上送；狀態碼（200／206／304／404／416）
 * 與內容相關的標頭往回送。iPhone 播 mp4 一定先要一段 bytes，206 與 Content-Range 少一個就拒播。
 */
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import type express from 'express';

/** 允許代理的路徑（相對於 `/media` 掛載點）。 */
export const MEDIA_PROXY_PATH = /^\/activities\/A\d{3}\.(mp4|jpg)$/;

const FORWARD_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'] as const;
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
] as const;
/** 上游回這些才照轉；其餘（5xx、3xx 轉址……）一律 502，不把上游的錯誤頁吐給 `<video>`。 */
const PASS_THROUGH_STATUS = new Set([200, 206, 304, 404, 416]);

/**
 * 讀 `MEDIA_UPSTREAM`。空的＝不代理（回 null）。認不得的值直接丟錯讓程序起不來 ——
 * 打錯字的後果是展示環境每一支片都 404，而畫面上只是一張張破圖（同 `APP_MODE` 的 fail-closed）。
 * 只收「協定＋主機（＋埠）」：`https://sxkscreen.com`。帶路徑、帳密、查詢字串都不收。
 */
export function resolveMediaUpstream(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`MEDIA_UPSTREAM 不是一个网址：${JSON.stringify(value)}。例：https://sxkscreen.com`);
  }
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new Error(`MEDIA_UPSTREAM 必须是 https://（本机测试才收 http://127.0.0.1）：${JSON.stringify(value)}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error(`MEDIA_UPSTREAM 只写协定与主机，不带路径：${JSON.stringify(value)}。例：https://sxkscreen.com`);
  }
  return parsed.origin;
}

export function createMediaProxy(
  upstreamOrigin: string,
  fetchImpl: typeof fetch = fetch,
): express.RequestHandler {
  return async (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !MEDIA_PROXY_PATH.test(req.path)) {
      next();
      return;
    }
    const headers: Record<string, string> = {};
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = req.get(name);
      if (value) headers[name] = value;
    }
    // 家長關掉播放器（或跳到別的段落）時一起放掉上游那一條，不讓它在背景把整支片拉完。
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    let upstream: Response;
    try {
      upstream = await fetchImpl(`${upstreamOrigin}/media${req.path}`, {
        method: req.method,
        headers,
        redirect: 'manual',
        signal: abort.signal,
      });
    } catch {
      if (!res.headersSent) res.status(502).end();
      return;
    }
    if (!PASS_THROUGH_STATUS.has(upstream.status)) {
      await upstream.body?.cancel().catch(() => {});
      res.status(502).end();
      return;
    }
    res.status(upstream.status);
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value !== null) res.setHeader(name, value);
    }
    if (req.method === 'HEAD' || !upstream.body || upstream.status === 304) {
      await upstream.body?.cancel().catch(() => {});
      res.end();
      return;
    }
    const body = Readable.fromWeb(upstream.body as unknown as WebReadableStream<Uint8Array>);
    body.on('error', () => res.destroy());
    body.pipe(res);
  };
}
