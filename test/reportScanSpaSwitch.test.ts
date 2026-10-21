import { describe, it, expect, afterAll } from 'vitest';

/** `REPORT_SCAN_SPA` 認不得的值：程序起不來（同其他開關，fail-closed，不讓人猜它落在哪一邊）。 */

afterAll(() => {
  process.env.REPORT_SCAN_SPA = '';
});

describe('REPORT_SCAN_SPA 的值', () => {
  it('認不得的值（yes）讓 server.ts 載入失敗', async () => {
    process.env.REPORT_SCAN_SPA = 'yes';
    await expect(import('../server')).rejects.toThrow(/REPORT_SCAN_SPA is not recognised/);
  }, 60_000); // 載入整個 server.ts，全套並行時慢
});
