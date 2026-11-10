import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `LISTEN_HOST`（2026-11-10 稽核）：不設照舊 0.0.0.0；正式站設 127.0.0.1 只收本機。認不得的值起不來。
 */
afterAll(() => {
  process.env.LISTEN_HOST = '';
});

describe('LISTEN_HOST', () => {
  it('不設：照舊綁 0.0.0.0（startServer 用 LISTEN_HOST，不再寫死）', () => {
    const src = readFileSync('server.ts', 'utf8');
    expect(src).toContain("if (!raw) return '0.0.0.0';");
    expect(src).toContain('app.listen(PORT, LISTEN_HOST, () => {');
    expect(src).not.toContain("app.listen(PORT, '0.0.0.0'");
    expect(src).toContain("['0.0.0.0', '127.0.0.1', '::', '::1']");
  });

  it('打錯字（localhst）讓 server.ts 載入失敗', async () => {
    process.env.LISTEN_HOST = 'localhst';
    await expect(import('../server')).rejects.toThrow(/LISTEN_HOST/);
  }, 60_000);
});
