import { describe, it, expect } from 'vitest';
import { KITV3_BANKS, isKitV3Tool } from '../src/t2/kitv3';
import { V3_RECIPES } from '../scripts/t2/kitv3-recipes';
import { KITV3_LOADERS } from '../src/t2/kitv3/lazy';

describe('完整版題庫登錄表', () => {
  it('與配方表一支不多、一支不少；每一份的 code 就是鍵', () => {
    expect(Object.keys(KITV3_BANKS).sort()).toEqual(V3_RECIPES.map(r => r.code).sort());
    for (const [code, bank] of Object.entries(KITV3_BANKS)) expect(bank.code, code).toBe(code);
  });

  it('isKitV3Tool 只認登錄表上的代碼', () => {
    expect(isKitV3Tool('SXK-GM')).toBe(true);
    expect(isKitV3Tool('sxk-gm')).toBe(false);
    expect(isKitV3Tool('toString')).toBe(false);
  });

  it('延遲載入表（畫面用）與登錄表一支不多、一支不少，載回來的就是同一份', async () => {
    expect(Object.keys(KITV3_LOADERS).sort()).toEqual(Object.keys(KITV3_BANKS).sort());
    for (const [code, load] of Object.entries(KITV3_LOADERS)) expect(await load(), code).toBe(KITV3_BANKS[code]);
  });
});
