/**
 * 返回鍵回上一個畫面（客戶 10/22，issue #86，`VITE_UI_1022`）。
 *
 * App 換主畫面（首頁、評估面板、T1、報告、居家訓練、個人中心……，即 `currentView`）只是換 state，
 * 瀏覽器歷史一格都沒動 —— 在微信裡按左上角返回，家長直接被踢回聊天視窗。1022 開著時每換一個主畫面
 * 就推一格歷史（記著是哪一個畫面），`popstate` 時換回那一格記的畫面；第一個畫面再返回才離開網站。
 *
 * 居家訓練自己有頁面堆疊（`src/components/training/layerStack.ts`），也推歷史。兩者共用同一條歷史：
 * 堆疊的每一格是把自己的鍵加進當下那一格（保留這裡的鍵），所以在訓練頁裡退一層，落點仍記著「居家訓練」。
 * 唯一要小心的是**帶著開著的層離開居家訓練**：堆疊卸下時會自己退掉那幾格（`history.go(-n)`，非同步），
 * 這時要等那一次退格落地再推新畫面那一格，不然新的一格會被退掉、畫面又被拉回居家訓練（`decidePush` 的 `defer`）。
 *
 * 規則是純函式（測得到）；`useViewHistory` 只把它接上 `window.history`。
 */
import { useEffect, useRef } from 'react';
import { LAYER_STATE_KEY } from '../components/training/layerStack';

export const VIEW_STATE_KEY = 'sxkView';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 一格歷史記的主畫面；不是我們推的（或認不得）回 null。 */
export function viewOf<V extends string>(state: unknown, isView: (v: string) => v is V): V | null {
  const raw = isObject(state) ? state[VIEW_STATE_KEY] : undefined;
  return typeof raw === 'string' && isView(raw) ? raw : null;
}

/** 新推的那一格只記主畫面（居家訓練的層不帶過去）。 */
export function stateForView(view: string): Record<string, unknown> {
  return { [VIEW_STATE_KEY]: view };
}

/** 現在這一格有沒有居家訓練開著的層。 */
export function hasTrainingLayers(state: unknown): boolean {
  const raw = isObject(state) ? state[LAYER_STATE_KEY] : undefined;
  return Array.isArray(raw) && raw.length > 0;
}

/**
 * 主畫面換了之後歷史要怎麼動：
 * - `none`：沒換、或是返回鍵換的（那一格本來就在歷史上）
 * - `push`：推一格
 * - `defer`：剛帶著開著的層離開居家訓練，等堆疊自己的退格落地（下一次 `popstate`）再推
 */
export function decidePush(prev: string, next: string, fromPop: boolean, topHasLayers: boolean): 'none' | 'push' | 'defer' {
  if (prev === next || fromPop) return 'none';
  return topHasLayers ? 'defer' : 'push';
}

/**
 * 把 `currentView` 接到瀏覽器歷史。`enabled` 為假時什麼都不做（1022 關著照舊）。
 */
export function useViewHistory<V extends string>(
  currentView: V,
  setCurrentView: (v: V) => void,
  isView: (v: string) => v is V,
  enabled: boolean,
): void {
  const prev = useRef(currentView);
  const fromPop = useRef(false);
  const deferred = useRef<V | null>(null);
  const viewRef = useRef(currentView);
  viewRef.current = currentView;

  // 第一格：記下進站時的畫面（不推，返回鍵從這裡再退就離開網站）。
  useEffect(() => {
    if (!enabled) return;
    window.history.replaceState({ ...(isObject(window.history.state) ? window.history.state : {}), ...stateForView(currentView) }, '');
    // 只在掛上時記一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onPop = (e: PopStateEvent) => {
      if (deferred.current !== null) {
        // 居家訓練的堆疊剛退完自己的格子：現在才推新畫面那一格，畫面不動。
        const target = deferred.current;
        deferred.current = null;
        window.history.pushState(stateForView(target), '');
        return;
      }
      const view = viewOf(e.state, isView);
      if (view !== null && view !== viewRef.current) {
        fromPop.current = true;
        setCurrentView(view);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled, isView, setCurrentView]);

  useEffect(() => {
    if (!enabled) return;
    const action = decidePush(prev.current, currentView, fromPop.current, hasTrainingLayers(window.history.state));
    prev.current = currentView;
    fromPop.current = false;
    if (action === 'push') window.history.pushState(stateForView(currentView), '');
    else if (action === 'defer') deferred.current = currentView;
  }, [currentView, enabled]);
}
