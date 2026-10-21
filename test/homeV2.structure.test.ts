import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 新版首頁（issue #72，規格 docs/specs/client-changes-2026-10-17.md §5）的接線：
 *   - 只在專案 A（`PRODUCT.features.home`）；B 不問伺服器、首頁與「首页」都畫不出來；
 *   - 開關關著（`/api/home/config` 回 false、或還沒回）畫面一行不動：首頁、「首页」、登入登記鈕都包在 `homeV2` 後面；
 *   - banner 是現有示範片一支：靜音、自動播放、循環、`playsinline`、封面先出（不能播就停在封面）；
 *   - 圖片先放佔位：不連任何生成的圖。
 */

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const app = read('src/App.tsx');
const home = read('src/home/HomePage.tsx');
const offline = read('src/home/OfflineServicePage.tsx');

describe('只在專案 A', () => {
  it('productConfig：A 的 features.home 是 true、B 是 false', async () => {
    const src = read('src/productConfig.ts');
    const full = src.slice(src.indexOf('full: {'), src.indexOf('t1only: {'));
    const b = src.slice(src.indexOf('t1only: {'));
    expect(full).toMatch(/home:\s*true/);
    expect(b).toMatch(/home:\s*false/);
  });

  it('App 只在 PRODUCT.features.home 時才問 /api/home/config', () => {
    const at = app.indexOf("'/api/home/config'");
    expect(at).toBeGreaterThan(0);
    const before = app.slice(Math.max(0, at - 600), at);
    expect(before).toMatch(/if \(!PRODUCT\.features\.home\) return;/);
  });

  it('homeV2 ＝ PRODUCT.features.home 且伺服器說開了', () => {
    expect(app).toMatch(/const homeV2 = PRODUCT\.features\.home && homeConfigOn;/);
  });
});

describe('開關關著：畫面一行不動', () => {
  it('首頁、線下服務點頁只在 homeV2 時畫', () => {
    // Ledo 版（`PRODUCT.features.ledo`）在同一個分支裡挑新舊首頁，所以往前看遠一點。
    for (const m of app.matchAll(/<(?:Ledo)?HomePage\b/g)) {
      const before = app.slice(Math.max(0, m.index! - 600), m.index!);
      expect(before).toMatch(/homeV2/);
    }
    expect(app).toMatch(/currentView === 'offline_service' && homeV2/);
    expect(app).toMatch(/currentView === 'home' && homeV2/);
  });

  it('導覽列的「首页」與頁首的登录／注册都包在 homeV2 後面', () => {
    // 導覽的幾個去處是一份清單（`navItems`，頁首與 Ledo 底欄共用），「首页」那一項包在 homeV2 後面。
    const nav = app.indexOf("id: 'nav-home-btn'");
    expect(nav).toBeGreaterThan(0);
    expect(app.slice(nav - 300, nav)).toMatch(/\.\.\.\(homeV2\s*\?/);
    const login = app.indexOf('id="header-login-btn"');
    expect(login).toBeGreaterThan(0);
    expect(app.slice(login - 400, login)).toMatch(/homeV2 && !userIdentity/);
  });

  it('「首页」在導覽列最前面，「评估面板 (9维)」保留', () => {
    expect(app.indexOf("id: 'nav-home-btn'")).toBeGreaterThan(0);
    expect(app.indexOf("id: 'nav-home-btn'")).toBeLessThan(app.indexOf("id: 'nav-dashboard-btn'"));
    expect(app).toContain('评估面板 (9维)');
  });

  it('未登入：開關開著先給首頁，點了卡或登录才是 AuthScreen', () => {
    expect(app).toMatch(/homeV2 && !homeLoginOpen \? \(/);
    expect(app).toContain('<AuthScreen onAuthSuccess={handleAuthSuccess} dbConfigured={dbConfigured} />');
  });

  it('登入之後去哪走 viewAfterLogin（從卡片來的帶到那一頁）', () => {
    expect(app).toMatch(/setCurrentView\(viewAfterLogin\(pendingHomeTarget, homeV2\)\)/);
  });
});

describe('banner', () => {
  it('現有示範片 A012（小推车），封面先出', () => {
    expect(home).toContain('/media/activities/A012.mp4');
    expect(home).toContain('/media/activities/A012.jpg');
    expect(home).toMatch(/poster=\{BANNER\.poster\}/);
  });

  it('靜音、自動播放、循環、playsinline（含 iOS 微信要的寫法）', () => {
    for (const attr of ['muted', 'autoPlay', 'loop', 'playsInline', 'webkit-playsinline', 'x5-playsinline']) {
      expect(home).toContain(attr);
    }
    // React 不保證把 muted 寫成屬性，iOS 看屬性決定能不能自動播放：掛上去後再設一次。
    expect(home).toMatch(/\.muted = true/);
  });
});

describe('圖片：三張卡都有照片（規格 §5.2：WebP＋JPG、各 ≤300 KB）', () => {
  it('三張照片都在 public/home/、各兩份；醫院照首頁卡與線下服務點頁共用；不再有佔位', () => {
    for (const name of ['home-training', 'home-t1', 'offline-hospital']) {
      for (const ext of ['webp', 'jpg']) {
        const f = `public/home/${name}.${ext}`;
        expect(home + offline).toContain(name);
        const size = statSync(join(root, f)).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(300 * 1024);
      }
    }
    expect(home).toMatch(/offline: HOSPITAL_PHOTO/);
    expect(offline).toContain('HOSPITAL_PHOTO');
    expect(home + offline).not.toContain('data-placeholder');
  });

  it('生成的人物照有提示詞確認紀錄（D17）', () => {
    expect(home).toContain('docs/reference/home-photo-prompts-2026-10-18.md');
    expect(read('docs/reference/home-photo-prompts-2026-10-18.md')).toMatch(/确认纪录：使用者 2026-10-18/);
  });

  it('線下服務點：醫院名稱、「即将开放」，沒有預約鈕', () => {
    expect(offline).toContain('HOME_COPY.offline.hospital');
    expect(offline).toContain('HOME_COPY.offline.status');
    expect(offline).not.toMatch(/预约|booking/i);
  });
});
