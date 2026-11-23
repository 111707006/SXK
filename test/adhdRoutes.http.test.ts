import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadApp, startTestApp, type TestClient } from './helpers/httpApp';
import { adhdRouteVerdict } from '../src/adhd/routeGate';

/** ⚠️ 必須在載入 `server.ts` 之前設定。 */
process.env.APP_MODE = 'adhd';

/**
 * 成人 ADHD（`APP_MODE=adhd`）：白名單以外的路徑在這個程序裡不存在（404），A、B 的端點一支都拿不到；
 * `/assess/` 回客戶頁面＋bridge 那一行。設計 `docs/specs/adhd-product-design.md` 第 2.1、3 節。
 */
describe('APP_MODE=adhd 的路由', () => {
  let client: TestClient;
  beforeAll(async () => {
    client = await startTestApp(await loadApp());
  });
  afterAll(async () => {
    await client?.close();
  });

  it.each([
    '/api/report',
    '/api/db/load',
    '/api/report-config',
    '/api/report-link',
    '/api/specialists',
    '/api/expert-booking',
    '/api/t2/plan',
    '/api/unlocks',
    '/api/payment/status',
    '/api/handoff/config',
    '/api/home/config',
    '/api/legal',
    '/api/wecom-qr',
    '/api/r/abc',
  ])('GET %s 是 404', async path => {
    const res = await client.get(path);
    expect(res.status).toBe(404);
  });

  it.each(['/api/report', '/api/db/save', '/api/expert-booking', '/api/handoff/start', '/internal/handoff/redeem'])(
    'POST %s 是 404',
    async path => {
      const res = await client.postJson(path, {});
      expect(res.status).toBe(404);
    },
  );

  it('掃碼報告 /r/:token 是 404', async () => {
    expect((await client.get('/r/abcdef')).status).toBe(404);
  });

  it('登入、資料庫狀態、合作單位 LOGO 放行（不是白名單擋的 404）', async () => {
    expect((await client.get('/api/db/status')).status).toBe(200);
    // 沒帶手機號 → 端點自己回 400，代表有走到端點
    expect((await client.postJson('/api/auth/sms/request', {})).status).toBe(400);
    expect((await client.get('/api/company-brand')).status).not.toBe(404);
  });

  it('/assess/ 回客戶頁面，</body> 前多一行 bridge', async () => {
    const res = await client.get('/assess/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('成人 ADHD 筛查版');
    expect(html).toMatch(/<script src="\/assess\/bridge\.js\?v=[0-9a-f]{12}"><\/script>\n<\/body>/);
  });

  it('/assess 轉到 /assess/ 並保留查詢字串', async () => {
    const res = await client.request('/assess?view=3', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/assess/?view=3');
  });

  it('/assess/bridge.js 是 JS', async () => {
    const res = await client.get('/assess/bridge.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
  });
});

describe('adhdRouteVerdict', () => {
  it.each([
    ['/api/auth/sms/verify', 'pass'],
    ['/api/adhd/assessments', 'pass'],
    ['/api/admin/me', 'pass'],
    ['/api/admin', 'pass'],
    ['/api/administrator', 'not_found'],
    ['/api/adhd', 'not_found'],
    ['/api/report', 'not_found'],
    ['/api', 'not_found'],
    ['/r/x', 'not_found'],
    ['/internal/handoff/redeem', 'not_found'],
    ['/', 'pass'],
    ['/admin', 'pass'],
    ['/assess/', 'pass'],
  ])('%s → %s', (path, verdict) => {
    expect(adhdRouteVerdict(path)).toBe(verdict);
  });
});
