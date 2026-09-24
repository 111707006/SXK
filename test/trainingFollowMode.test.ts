import { describe, it, expect } from 'vitest';
import { FOLLOW_MODE_KEY, followModeFor, readFollowMode, writeFollowMode } from '../src/components/training/followMode';

/**
 * 「跟练方式」（Keep 規格 §3.8）：看示范片跟着做／只看图文步骤。存在瀏覽器本機，**不上伺服器** ——
 * 這是個人偏好，不是資料。`localStorage` 在微信、隱私模式、iOS 的一些設定下讀不到或寫不進去
 *（連拿 `window.localStorage` 這個動作都可能丟例外），所以讀寫都包起來：讀不到就是預設「看示范片」，
 * 寫不進去就是這一次有效、下次回到預設，畫面不壞。
 */

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('讀', () => {
  it('沒存過 → 看示范片', () => {
    expect(readFollowMode(() => memoryStorage())).toBe('video');
  });

  it('存過「只看图文步骤」→ 讀回來', () => {
    expect(readFollowMode(() => memoryStorage({ [FOLLOW_MODE_KEY]: 'pictures' }))).toBe('pictures');
  });

  it('存的是認不得的值 → 看示范片', () => {
    expect(readFollowMode(() => memoryStorage({ [FOLLOW_MODE_KEY]: 'countdown' }))).toBe('video');
  });

  it('拿 localStorage 就丟例外、getItem 丟例外、根本沒有 → 看示范片，不丟出來', () => {
    expect(
      readFollowMode(() => {
        throw new Error('SecurityError');
      }),
    ).toBe('video');
    expect(readFollowMode(() => throwing)).toBe('video');
    expect(readFollowMode(() => undefined)).toBe('video');
  });
});

describe('寫', () => {
  it('寫進去、讀得回來', () => {
    const storage = memoryStorage();
    expect(writeFollowMode(() => storage, 'pictures')).toBe(true);
    expect(readFollowMode(() => storage)).toBe('pictures');
    expect(writeFollowMode(() => storage, 'video')).toBe(true);
    expect(readFollowMode(() => storage)).toBe('video');
  });

  it('寫不進去 → 回 false，不丟出來', () => {
    expect(writeFollowMode(() => throwing, 'pictures')).toBe(false);
    expect(
      writeFollowMode(() => {
        throw new Error('SecurityError');
      }, 'pictures'),
    ).toBe(false);
    expect(writeFollowMode(() => undefined, 'pictures')).toBe(false);
  });
});

describe('按 GO 之後走哪一種', () => {
  it('有示範片：照家長選的', () => {
    expect(followModeFor('video', true)).toBe('video');
    expect(followModeFor('pictures', true)).toBe('pictures');
  });

  it('沒有示範片：一律圖文（選了看示範片也一樣，那一個選項在抽屜裡是灰的）', () => {
    expect(followModeFor('video', false)).toBe('pictures');
    expect(followModeFor('pictures', false)).toBe('pictures');
  });
});
