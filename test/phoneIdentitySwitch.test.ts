import { describe, it, expect, afterAll } from 'vitest';

/** `A_PHONE_IDENTITY` 認不得的值：程序起不來（同其他開關，fail-closed，不讓人猜它落在哪一邊）。 */

afterAll(() => {
  process.env.A_PHONE_IDENTITY = '';
});

describe('A_PHONE_IDENTITY 的值', () => {
  it('認不得的值（yes）讓 server.ts 載入失敗', async () => {
    process.env.A_PHONE_IDENTITY = 'yes';
    await expect(import('../server')).rejects.toThrow(/A_PHONE_IDENTITY is not recognised/);
  }, 60_000); // 載入整個 server.ts，全套並行時慢
});
