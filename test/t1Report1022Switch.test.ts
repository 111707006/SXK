import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * `T1_REPORT_1022`（#81）：認不得的值起不來；沒開 `T1_REPORT_REAL` 就開它也起不來（新寫法只在新版報告裡）。
 * 每一案重新載入 `server.ts`（它在 import 當下把環境變數讀成常數）。
 */

afterEach(() => {
  process.env.T1_REPORT_REAL = '';
  process.env.T1_REPORT_1022 = '';
  vi.resetModules();
});

describe('T1_REPORT_1022 的值', () => {
  it('認不得的值（yes）讓 server.ts 載入失敗', async () => {
    process.env.T1_REPORT_REAL = '1';
    process.env.T1_REPORT_1022 = 'yes';
    await expect(import('../server')).rejects.toThrow(/T1_REPORT_1022 is not recognised/);
  }, 60_000);

  it('開了 T1_REPORT_1022、沒開 T1_REPORT_REAL：載入失敗', async () => {
    process.env.T1_REPORT_1022 = '1';
    await expect(import('../server')).rejects.toThrow(/T1_REPORT_1022 requires T1_REPORT_REAL/);
  }, 60_000);
});
