import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp, startTestApp, type TestClient } from './helpers/httpApp';

/** `CSP_MODE=report`：回應帶 Report-Only（不擋）、回報端點收得下瀏覽器的格式。 */
let client: TestClient;

beforeAll(async () => {
  process.env.CSP_MODE = 'report';
  vi.resetModules();
  client = await startTestApp(await loadApp());
}, 60_000);

afterAll(async () => {
  await client?.close();
  process.env.CSP_MODE = '';
});

describe('CSP_MODE=report', () => {
  it('送 Content-Security-Policy-Report-Only，不送會擋的那一個', async () => {
    const resp = await client.get('/api/db/status');
    expect(resp.headers.get('content-security-policy')).toBeNull();
    const policy = resp.headers.get('content-security-policy-report-only') ?? '';
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain('report-uri /api/csp-report');
  });

  it('回報端點收 application/csp-report，回 204', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resp = await client.request('/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({ 'csp-report': { 'document-uri': 'https://sxkscreen.com/', 'effective-directive': 'img-src', 'blocked-uri': 'http://x.test/a.png' } }),
    });
    expect(resp.status).toBe(204);
    expect(warn.mock.calls.some(c => String(c[0]).includes('img-src blocked=http://x.test/a.png'))).toBe(true);
    warn.mockRestore();
  });
});
