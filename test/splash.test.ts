import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { HomeMediaItem } from '../src/homeMedia/shape';
import { isSplashFreePath, readSplashSeen, shouldShowSplash, splashPossible, SPLASH_SEEN_KEY, writeSplashSeen } from '../src/home/splash';

/**
 * 開屏「該不該顯示」（#88，`HOME_MEDIA`）：開關（素材讀不到就是 null）、素材、工作階段、路徑；storage 壞掉不擋家長。
 */

const splash: HomeMediaItem = { id: 1, slot: 'splash', kind: 'image', url: '/media/home/s.jpg?v=1', posterUrl: null, link: '/', sortOrder: 1, active: true, createdAt: null };
const base = { hasHome: true, pathname: '/', seen: false };

describe('shouldShowSplash', () => {
  it('有素材、沒看過、在首頁 → 顯示', () => {
    expect(shouldShowSplash({ ...base, splash })).toBe(true);
  });

  it('沒有素材（開關關著、讀失敗、逾時）→ 不', () => {
    expect(shouldShowSplash({ ...base, splash: null })).toBe(false);
  });

  it('這個分頁看過了 → 不', () => {
    expect(shouldShowSplash({ ...base, seen: true, splash })).toBe(false);
  });

  it('沒有首頁的產品（B）→ 不', () => {
    expect(shouldShowSplash({ ...base, hasHome: false, splash })).toBe(false);
  });

  it.each(['/r/abc123', '/handoff', '/admin', '/admin/x'])('路徑 %s → 不', pathname => {
    expect(shouldShowSplash({ ...base, pathname, splash })).toBe(false);
    expect(splashPossible({ ...base, pathname })).toBe(false);
  });

  it.each(['/', '/anything'])('路徑 %s 照常', pathname => {
    expect(isSplashFreePath(pathname)).toBe(false);
  });
});

describe('工作階段的記號', () => {
  it('寫了讀得回來', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readSplashSeen(storage)).toBe(false);
    writeSplashSeen(storage);
    expect(map.get(SPLASH_SEEN_KEY)).toBe('1');
    expect(readSplashSeen(storage)).toBe(true);
  });

  it('storage 讀寫丟例外：當成沒看過、寫不進去不丟', () => {
    const broken = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceeded'); },
    };
    expect(readSplashSeen(broken)).toBe(false);
    expect(() => writeSplashSeen(broken)).not.toThrow();
    expect(readSplashSeen(null)).toBe(false);
  });
});

describe('接線', () => {
  it('開屏只掛在家長端的 App、有首頁的產品', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('{PRODUCT.features.home && <SplashScreen />}');
  });

  it('3 秒、右上角跳过、點畫面去連結', () => {
    const src = readFileSync('src/home/SplashScreen.tsx', 'utf8');
    expect(src).toContain('id="splash-skip"');
    expect(src).toContain('onClick={() => openMediaLink(splash.link)}');
    expect(readFileSync('src/home/splash.ts', 'utf8')).toContain('export const SPLASH_SECONDS = 3;');
  });
});
