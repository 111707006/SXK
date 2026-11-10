import { describe, expect, it } from 'vitest';
import { cspDirectives, readCspMode, summariseCspReport } from '../src/security/csp';

describe('CSP_MODE', () => {
  it('不設、off、0 都是關；report、enforce 照收', () => {
    expect(readCspMode(undefined)).toBe('off');
    expect(readCspMode('')).toBe('off');
    expect(readCspMode('off')).toBe('off');
    expect(readCspMode('0')).toBe('off');
    expect(readCspMode('report')).toBe('report');
    expect(readCspMode('enforce')).toBe('enforce');
  });

  it('認不得的值起不來', () => {
    expect(() => readCspMode('on')).toThrow(/CSP_MODE/);
    expect(() => readCspMode('1')).toThrow(/CSP_MODE/);
  });
});

describe('CSP 的內容', () => {
  const d = cspDirectives();

  it('腳本只收自己站上的：沒有 unsafe-inline、unsafe-eval、萬用字元', () => {
    expect(d['script-src']).toEqual(["'self'"]);
    for (const [k, v] of Object.entries(d)) {
      expect(v, k).not.toContain('*');
      if (k !== 'style-src') expect(v, k).not.toContain("'unsafe-inline'");
      expect(v, k).not.toContain("'unsafe-eval'");
    }
  });

  it('不讓別的網站把頁面嵌進去、不收 plugin、表單只送回自己', () => {
    expect(d['frame-ancestors']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['form-action']).toEqual(["'self'"]);
    expect(d['connect-src']).toEqual(["'self'"]);
  });
});

describe('違規回報寫進日誌的那一行', () => {
  it('舊格式（csp-report）：指令、被擋的來源、頁面路徑；查詢字串與掃碼 token 不進日誌', () => {
    const line = summariseCspReport({
      'csp-report': {
        'document-uri': 'https://sxkscreen.com/r/abcDEF123secret?x=1',
        'effective-directive': 'img-src',
        'blocked-uri': 'http://evil.example/x.png',
      },
    });
    expect(line).toBe('img-src blocked=http://evil.example/x.png page=https://sxkscreen.com/r/…');
    expect(line).not.toContain('secret');
  });

  it('新格式（reports+json 的 body）也讀得懂；inline 違規寫 (inline)', () => {
    expect(summariseCspReport({ effectiveDirective: 'script-src-elem', blockedURL: '', documentURL: 'https://sxkscreen.com/' }))
      .toBe('script-src-elem blocked=(inline) page=https://sxkscreen.com/');
  });

  it('形狀不對回 null', () => {
    expect(summariseCspReport(null)).toBeNull();
    expect(summariseCspReport({})).toBeNull();
    expect(summariseCspReport('x')).toBeNull();
  });
});
