import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 靜態檔快取與壓縮（2026-11-10 稽核）。
 * - `/assets` 的檔名帶內容雜湊，Node 給一年 immutable；找不到 404，不落到 SPA 兜底。
 * - nginx 預設不壓縮代理回來的回應（`gzip_proxied` off），A、B 兩個 server 區塊各自打開。
 * - nginx 不能再用 `proxy_set_header Cache-Control` 假裝設快取（那是送給 Node 的請求標頭）。
 */
describe('靜態檔快取與壓縮', () => {
  const server = readFileSync('server.ts', 'utf8').replace(/\r\n/g, '\n');

  it('/assets 一年 immutable，而且排在一般 static 與 SPA 兜底前面', () => {
    const assets = server.indexOf("'/assets',\n      express.static(path.join(distPath, 'assets'), {");
    const general = server.indexOf('app.use(express.static(distPath));');
    const fallback = server.indexOf("app.get('*', (req, res) => {\n      res.sendFile(path.join(distPath, 'index.html'));");
    expect(assets).toBeGreaterThan(-1);
    expect(assets).toBeLessThan(general);
    expect(general).toBeLessThan(fallback);
    const block = server.slice(assets, general);
    expect(block).toContain('immutable: true');
    expect(block).toContain("maxAge: '365d'");
    expect(block).toContain('fallthrough: false');
  });

  it('nginx：A、B 都打開代理回應的壓縮，不再有假的 Cache-Control', () => {
    const nginx = readFileSync('deploy/nginx.conf', 'utf8').replace(/\r\n/g, '\n');
    const active = nginx.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    expect(active.match(/gzip_proxied any;/g)?.length).toBe(2);
    expect(active.match(/gzip_types [^;]*application\/javascript/g)?.length).toBe(2);
    expect(active).not.toMatch(/proxy_set_header Cache-Control/);
  });
});
