/**
 * 讀客戶原檔與 bridge、組出站上那兩個檔（只給建置與伺服器用，會碰檔案系統）。
 * 規則在 `page.ts`。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADHD_BRIDGE_FILE, ADHD_PAGE_FILE, patchAdhdPage } from './page';

export interface AssessFiles {
  /** 套過 bridge 那一行的頁面。 */
  html: string;
  /** bridge.js 原文。 */
  bridge: string;
  /** bridge 內容的雜湊前 12 碼，放在 script 網址上換快取。 */
  bridgeVersion: string;
}

export function buildAssessFiles(rootDir: string): AssessFiles {
  const original = readFileSync(join(rootDir, ADHD_PAGE_FILE), 'utf8');
  const bridge = readFileSync(join(rootDir, ADHD_BRIDGE_FILE), 'utf8');
  const bridgeVersion = createHash('sha256').update(bridge).digest('hex').slice(0, 12);
  return { html: patchAdhdPage(original, bridgeVersion), bridge, bridgeVersion };
}

/** 正式站：讀建置時寫好的 `dist/assess/`（`vite.config.ts` 的 `adhdAssess()`）。 */
export function readBuiltAssessFiles(distDir: string): Omit<AssessFiles, 'bridgeVersion'> {
  return {
    html: readFileSync(join(distDir, 'assess', 'index.html'), 'utf8'),
    bridge: readFileSync(join(distDir, 'assess', 'bridge.js'), 'utf8'),
  };
}
