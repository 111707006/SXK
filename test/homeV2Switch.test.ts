import { describe, it, expect, afterAll } from 'vitest';

/** `HOME_V2` 認不得的值：程序起不來（同其他開關，fail-closed，不讓人猜它落在哪一邊）。 */

afterAll(() => {
  process.env.HOME_V2 = '';
});

describe('HOME_V2 的值', () => {
  it('認不得的值（yes）讓 server.ts 載入失敗', async () => {
    process.env.HOME_V2 = 'yes';
    await expect(import('../server')).rejects.toThrow(/HOME_V2 is not recognised/);
  }, 60_000); // 載入整個 server.ts，全套並行時慢
});
