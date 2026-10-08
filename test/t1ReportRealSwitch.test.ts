import { describe, it, expect, afterAll } from 'vitest';

/** `T1_REPORT_REAL` 認不得的值：程序起不來（同其他開關，fail-closed，不讓人猜它落在哪一邊）。 */

afterAll(() => {
  process.env.T1_REPORT_REAL = '';
});

describe('T1_REPORT_REAL 的值', () => {
  it('認不得的值（yes）讓 server.ts 載入失敗', async () => {
    process.env.T1_REPORT_REAL = 'yes';
    await expect(import('../server')).rejects.toThrow(/T1_REPORT_REAL is not recognised/);
  });
});
