/**
 * 新版首頁（開關 `HOME_V2`，issue #72，規格 docs/specs/client-changes-2026-10-17.md §5、D15–D17）的去向與字。
 *
 * 只有專案 A 有（`PRODUCT.features.home`）；開不開由伺服器決定（`GET /api/home/config`）。
 * 這裡是純函式，`App.tsx` 只照著切 `currentView`。
 */

import { WORDING_1022 } from '../wording1022';

/** 首頁的卡片會帶去的那幾頁（`App.tsx` 的 `currentView` 的一部分）。 */
export type HomeTarget = 'training' | 'dashboard' | 'offline_service';

export interface HomeCard {
  id: 'training' | 't1' | 'offline';
  title: string;
  target: HomeTarget;
  more: string;
}

/** 照客戶示意圖：左一張大卡、右兩張小卡（D16）。 */
export const HOME_CARDS: ReadonlyArray<HomeCard> = [
  { id: 'training', title: '线上家庭干预练习', target: 'training', more: '了解更多' },
  { id: 't1', title: 'T1综合评估', target: 'dashboard', more: '了解更多' },
  { id: 'offline', title: '线下服务点', target: 'offline_service', more: '了解更多' },
];

/**
 * 客戶 10/22（issue #84，`VITE_UI_1022`）：兩張卡，T1 在前、居家訓練在後；線下服務點不放（那一頁的路由留著）。
 * 副標是客戶給的固定句。去處不變（居家訓練卡改去訓練計劃頁在規格三）。
 */
export const HOME_CARDS_1022: ReadonlyArray<HomeCard & { sub: string }> = [
  { id: 't1', title: WORDING_1022.home.t1Card.title, sub: WORDING_1022.home.t1Card.subtitle, target: 'dashboard', more: '了解更多' },
  { id: 'training', title: WORDING_1022.home.trainingCard.title, sub: WORDING_1022.home.trainingCard.subtitle, target: 'training', more: '了解更多' },
];

export const HOME_COPY = {
  /** 頁首中間那一行（客戶示意圖原字）。 */
  siteTitle: '儿童综合发展评估网',
  navLabel: '首页',
  login: '登录',
  register: '注册',
  /** 線下服務點介紹頁（Q-8：只放醫院名稱、照片、「即将开放」）。 */
  offline: {
    title: '线下服务点',
    hospital: '上海禾新医院',
    status: '即将开放',
    back: '回到首页',
  },
} as const;

/** 點一張卡：已登入直接去；未登入先登入，記住要去哪（登入後 `viewAfterLogin` 帶過去）。 */
export function openHomeCard(
  target: HomeTarget,
  loggedIn: boolean,
): { view: HomeTarget } | { login: true; after: HomeTarget } {
  return loggedIn ? { view: target } : { login: true, after: target };
}

/** 開關開著時的預設頁是首頁；關著照舊是評估面板（登出、通行證失效、登入後都回到這裡）。 */
export function landingView(homeV2: boolean): 'home' | 'dashboard' {
  return homeV2 ? 'home' : 'dashboard';
}

/** 登入之後停哪：從卡片來的帶到那一頁，直接按登入的停預設頁。開關關著一律照舊。 */
export function viewAfterLogin(pending: HomeTarget | null, homeV2: boolean): HomeTarget | 'home' {
  if (!homeV2) return 'dashboard';
  return pending ?? 'home';
}

/**
 * 上一次問到的開關值，記在這台裝置上：下一次開頁先照它畫，不必等 `/api/home/config` 回來才從登入頁閃成首頁。
 * 只是提示 —— 回來的值不同就照回來的改。讀寫包 try/catch（隱私模式、被擋的 storage 一律當成沒記過）。
 */
const HOME_HINT_KEY = 'senxinkang_home_v2';

export function readHomeV2Hint(): boolean {
  try {
    return localStorage.getItem(HOME_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHomeV2Hint(on: boolean): void {
  try {
    localStorage.setItem(HOME_HINT_KEY, on ? '1' : '0');
  } catch {
    // 記不下來就每次等伺服器回來，畫面照樣對。
  }
}
