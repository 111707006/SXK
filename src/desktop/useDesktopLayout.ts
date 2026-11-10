import { createContext, useContext, useSyncExternalStore } from 'react';
import { PRODUCT } from '../productConfig';

/**
 * 電腦版側欄工作台（`VITE_DESKTOP_LAYOUT`，`PRODUCT.features.desktopLayout`）。
 *
 * 只在視窗 ≥ 1024px（Tailwind `lg`）時成立。用 JS 判斷、不靠 `lg:` 的 class，是為了讓 1024px 以下
 * **DOM 一模一樣**：側欄與頁首那一排導覽有同一組 id（`nav-home-btn` 等，測試與捲動靠它找），兩邊同時在
 * DOM 裡就撞 id。開關關著時永遠 false，連 matchMedia 都不問。
 */
export const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function snapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

const never = () => () => {};
const no = () => false;

/** 開關開著、視窗夠寬（只給 `App.tsx` 決定要不要畫側欄）。 */
export function useDesktopWide(): boolean {
  const on = PRODUCT.features.desktopLayout;
  return useSyncExternalStore(on ? subscribe : never, on ? snapshot : no, no);
}

/**
 * 家長端正在畫側欄外框（`App.tsx` 提供）。頁面元件看這個換排法：後台、掃碼頁、列印也用同一批元件
 * （例如 `ReportBody`），它們不在這個範圍裡，永遠是 false，畫面一行不動。
 */
export const DesktopLayoutScope = createContext(false);

export function useDesktopLayout(): boolean {
  return useContext(DesktopLayoutScope);
}
