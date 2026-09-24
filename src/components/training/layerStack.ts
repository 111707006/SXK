/**
 * 家庭訓練的頁面堆疊（Keep 規格 §3 共同規則）：報告 → 計劃 → 詳情 → ……，抽屜也算一層。
 *
 * 【為什麼每推一層就 pushState 一次】
 * 這幾頁是蓋在報告上的一層一層，不是站內路由（App 沒有 router，也不碰 history）。家長在微信裡按
 * 返回、或按 Android 的實體返回鍵，瀏覽器做的是「退一格歷史」——我們不推的話，那一格是進報告之前
 * 的頁面，家長會整個離開報告。所以每推一層就推一格，返回鍵退一格時，由 `popstate` 關最上面那一層。
 *
 * 【整個堆疊放在那一格的 state 裡】
 * 每一格記的是「退到這一格時該有哪幾層」，`popstate` 時整個換成那一份，不是「關一層」。
 * 這樣一次退好幾格（`history.go(-2)`，打卡完「回到计划」）與前進鍵都不必另外處理：落在哪一格，
 * 堆疊就是那一格記的樣子。層只放可序列化的小物件（頁名、活動編號），資料由資料層另外讀。
 *
 * 【畫面上的返回（‹）也走歷史】
 * `back()` 只呼叫 `history.go(-1)`，真正關掉那一層的是隨後的 `popstate`。兩條路（畫面上的 ‹、
 * 瀏覽器的返回鍵）走同一個出口，歷史與畫面才不會各退各的。上一次退格還沒落地（`popstate` 還沒來）
 * 時再按，不再退：兩次 `go(-1)` 疊在同一個 tick 裡，各家瀏覽器不保證退兩格。
 *
 * 【卸載時】
 * 家長從計劃頁按「预约」，App 換到預約表，這一塊整個卸載，而歷史上還留著那幾格。不退掉的話，家長在
 * 預約表按返回要白按好幾次（那幾格已經沒有人聽）。所以卸載時還開著幾層，就退幾格。
 *
 * 【捲動還原】
 * 推第一層時把 `history.scrollRestoration` 改成 `manual`（`push` 裡的註解）。之後不改回來：
 * 它記在歷史的那一格上，改回 auto 的時機（退格落地之後）這裡已經不在場了；App 本身不用歷史，
 * 手動還原對它沒有差別。
 *
 * 【重新整理】
 * 重整後停在一格帶著堆疊的歷史上時，把那一格洗掉，不從半路開一個計劃頁（報告與資料都還沒讀）。
 *
 * 控制器（`createLayerHistory`）不碰 React、也不碰 `window`（由呼叫端注入），測試用一個照瀏覽器
 * 語意走的假歷史驗它（`test/trainingLayerStack.test.ts`）；React 那一層是底下的 `useLayerStack`。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

// ── 層 ──────────────────────────────────────────────────────────────────

/** 詳情頁從哪裡點進來：本週計劃的四支、換著玩、示範片庫。詳情的「系列列」照它決定列哪一組。 */
export type DetailSource = 'plan' | 'swap' | 'library';

/**
 * 蓋在報告上的頁面。計劃頁（票 6）、詳情、按 GO 之後的播放器、打卡成功（票 7）；
 * 示範片庫、打卡日曆（票 8，`LibraryScreen`、`CalendarScreen`）。
 *
 * - `go`：播放器。`mode` 是按 GO 那一刻決定的（有沒有片、家長選的跟練方式），記在這一格上，
 *   前進鍵開回來的是同一種。
 * - `checkin`：打卡成功。**取代**播放器那一層（`replaceTop`），在它上面按返回回到詳情，不回播放器。
 *   `checkinId`／`times`／`date` 是 POST 回來的那一筆、「第 N 次」與伺服器算的打卡日期。
 */
export type Route =
  | { name: 'plan' }
  | { name: 'detail'; id: string; from: DetailSource }
  | { name: 'go'; id: string; from: DetailSource; mode: 'video' | 'pictures' }
  | { name: 'checkin'; id: string; checkinId: number; times: number; date: string }
  | { name: 'library' }
  | { name: 'calendar' };

/**
 * 底部抽屜（§3.8）：動作列表、要準備、跟練方式要知道是哪一支活動（`id`／`from`，與詳情同一個讀法）；
 * 投屏說明只要知道有沒有片；加到日曆、问专家不看活動。
 *
 * 抽屜的 `calendar` 是「加到日曆」（`ReminderSheet`：星期、時間、.ics），不是打卡日曆那一頁（頁面的
 * `Route` 也有一個 `calendar`，票 8）。詳情的「加日历」與打卡日曆的提醒列都開這一個抽屜。
 */
export type SheetState =
  | { kind: 'expert' }
  | { kind: 'actions'; id: string; from: DetailSource }
  | { kind: 'equip'; id: string; from: DetailSource }
  | { kind: 'mode'; id: string; from: DetailSource }
  | { kind: 'cast'; hasVideo: boolean }
  | { kind: 'calendar' };

export type Layer = { type: 'page'; route: Route } | { type: 'sheet'; sheet: SheetState };

/** 歷史 state 上放堆疊的那個鍵。state 上原本的其他鍵照留。 */
export const LAYER_STATE_KEY = 'sxkTraining';

// ── 控制器 ──────────────────────────────────────────────────────────────

/** `window.history` 用得到的那幾樣。 */
export interface HistoryLike {
  readonly state: unknown;
  scrollRestoration?: 'auto' | 'manual';
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  go(delta: number): void;
}

type PopListener = (event: { state: unknown }) => void;

/** `window` 用得到的那兩樣。 */
export interface PopTarget {
  addEventListener(type: 'popstate', listener: PopListener): void;
  removeEventListener(type: 'popstate', listener: PopListener): void;
}

export interface LayerHistory {
  layers(): Layer[];
  /** 推一層＝推一格歷史。 */
  push(layer: Layer): void;
  /**
   * 換掉最上面那一層（詳情切到同系列的另一支），歷史不多一格。堆疊是空的就等於 `push`。
   * 上一次的退格還沒落地時不換（那一層正要被關掉）。
   */
  replaceTop(layer: Layer): void;
  /** 關最上面那一層：退一格歷史，由 `popstate` 關。 */
  back(): void;
  /** 退到只剩 `depth` 層（0＝回到報告）。 */
  popTo(depth: number): void;
  /**
   * 回到堆疊裡的某一層（打卡完「回到计划」）。它在堆疊裡：退到它為止。不在（家長從報告的活動卡
   * 直接進詳情，堆疊最底下是詳情）：退到只剩一層，落地之後把那一層換成它 —— 歷史上只留一格，
   * 再按返回就回到報告。
   */
  returnTo(layer: Layer): void;
  /** 不再聽 `popstate`；還開著幾層就退幾格。 */
  dispose(): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 一格歷史上的一層長得對不對。**帶參數的層要把參數帶齊**：少了活動編號的播放器、少了那一筆 id 的
 * 打卡成功畫不出來，與其畫一個壞掉的頁，不如當成認不得（整格回到報告）。
 * 不認得的頁名照舊放行 —— 部署之後按前進鍵，歷史上可能留著下一版才有的頁（`TrainingOverlay` 的退路）。
 */
function isLayer(value: unknown): value is Layer {
  if (!isObject(value)) return false;
  if (value.type === 'page') {
    const route = value.route;
    if (!isObject(route) || typeof route.name !== 'string') return false;
    switch (route.name) {
      case 'detail':
      case 'go':
        return typeof route.id === 'string';
      case 'checkin':
        return (
          typeof route.id === 'string' &&
          Number.isInteger(route.checkinId) &&
          Number.isInteger(route.times) &&
          typeof route.date === 'string'
        );
      default:
        return true;
    }
  }
  if (value.type === 'sheet') {
    const sheet = value.sheet;
    if (!isObject(sheet) || typeof sheet.kind !== 'string') return false;
    return !['actions', 'equip', 'mode'].includes(sheet.kind) || typeof sheet.id === 'string';
  }
  return false;
}

/** 兩層是不是同一層（頁名與參數都一樣）。層都是小的可序列化物件。 */
function sameLayer(a: Layer, b: Layer): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 一格歷史記的堆疊。沒有、或有任何一層認不得，都當成沒有任何一層（回到報告）。 */
function readLayers(state: unknown): Layer[] {
  const raw = isObject(state) ? state[LAYER_STATE_KEY] : undefined;
  if (!Array.isArray(raw) || !raw.every(isLayer)) return [];
  return raw;
}

function withLayers(state: unknown, layers: Layer[]): Record<string, unknown> {
  return { ...(isObject(state) ? state : {}), [LAYER_STATE_KEY]: layers };
}

function withoutLayers(state: unknown): unknown {
  if (!isObject(state)) return state;
  const { [LAYER_STATE_KEY]: _dropped, ...rest } = state;
  return rest;
}

export function createLayerHistory(deps: {
  history: HistoryLike;
  target: PopTarget;
  onChange: (layers: Layer[]) => void;
}): LayerHistory {
  const { history, target, onChange } = deps;
  let layers: Layer[] = [];
  /** 我們自己發出去、還沒等到 `popstate` 的退格有幾格（0＝沒有）。 */
  let pending = 0;
  let disposed = false;
  /** `returnTo` 退格落地之後要換上去的那一層（沒有就是 `null`）。 */
  let replaceOnLand: Layer | null = null;

  if (readLayers(history.state).length > 0) history.replaceState(withoutLayers(history.state), '');

  const set = (next: Layer[]) => {
    layers = next;
    onChange(next);
  };

  const swapTop = (layer: Layer) => {
    const next = [...layers.slice(0, -1), layer];
    history.replaceState(withLayers(history.state, next), '');
    set(next);
  };

  const onPop: PopListener = event => {
    pending = 0;
    const landed = readLayers(event.state);
    const swap = replaceOnLand;
    replaceOnLand = null;
    if (swap && landed.length > 0) {
      layers = landed;
      swapTop(swap);
      return;
    }
    set(landed);
  };
  target.addEventListener('popstate', onPop);

  const retreat = (steps: number) => {
    if (disposed || pending > 0 || steps <= 0) return;
    pending = steps;
    history.go(-steps);
  };

  const push = (layer: Layer) => {
    if (disposed) return;
    // 推第一層之前，把報告那一格（與之後推的每一格）的捲動還原改成手動：這幾層蓋在報告上、報告頁本身
    // 不捲，退回報告那一格時沒有東西要還原；而卸載時的退格（家長按了「预约」）落地時，App 已經換到下一頁、
    // 正在捲去預約區塊，瀏覽器若照 auto 還原，會把那一頁捲回推第一層那時報告的高度。
    if (layers.length === 0 && history.scrollRestoration === 'auto') history.scrollRestoration = 'manual';
    const next = [...layers, layer];
    history.pushState(withLayers(history.state, next), '');
    pending = 0;
    set(next);
  };

  return {
    layers: () => layers,
    push,
    replaceTop(layer) {
      // 退格還沒落地（家長剛按了返回或 ✕）：最上面那一層正要被關掉，換它就是寫進一格等一下就退掉的
      // 歷史（或落地後換掉下面那一層）。例：打卡還在送時家長關了播放器，POST 回來不再換成打卡成功。
      if (disposed || pending > 0) return;
      if (layers.length === 0) {
        push(layer);
        return;
      }
      swapTop(layer);
    },
    back() {
      retreat(layers.length > 0 ? 1 : 0);
    },
    popTo(depth) {
      retreat(layers.length - Math.max(0, depth));
    },
    returnTo(layer) {
      // 上一次的退格還沒落地：與 `back` 同一條規矩，不再動
      if (disposed || pending > 0 || layers.length === 0) return;
      const at = layers.findIndex(l => sameLayer(l, layer));
      if (at >= 0) {
        retreat(layers.length - (at + 1));
        return;
      }
      if (layers.length === 1) {
        swapTop(layer);
        return;
      }
      replaceOnLand = layer;
      retreat(layers.length - 1);
    },
    dispose() {
      if (disposed) return;
      target.removeEventListener('popstate', onPop);
      // 已經在路上的那幾格不再退一次
      const remaining = layers.length - pending;
      disposed = true;
      layers = [];
      if (remaining > 0) history.go(-remaining);
    },
  };
}

// ── React ───────────────────────────────────────────────────────────────

/** 頁面與抽屜用的導覽動作。全部經過歷史（檔頭）。 */
export interface LayerNav {
  openPage(route: Route): void;
  openSheet(sheet: SheetState): void;
  /** 換掉最上面那一層（不多一格歷史）。 */
  replacePage(route: Route): void;
  back(): void;
  /** 退到只剩 `depth` 層；0＝回到報告。 */
  popTo(depth: number): void;
  /** 回到某一頁（打卡完「回到计划」）：堆疊裡有就退到它，沒有就退到只剩一層再換成它。 */
  returnToPage(route: Route): void;
}

export interface LayerStack extends LayerNav {
  layers: Layer[];
}

/**
 * 掛在 `window.history` 上的堆疊。一個報告頁只該有一份（`TrainingSection` 持有）。
 * 開著任何一層時鎖住底下報告頁的捲動：iOS 上蓋著的全螢幕層捲到底時，會把手勢傳給底下那一頁。
 */
export function useLayerStack(): LayerStack {
  const [layers, setLayers] = useState<Layer[]>([]);
  const ref = useRef<LayerHistory | null>(null);

  useEffect(() => {
    const controller = createLayerHistory({ history: window.history, target: window, onChange: setLayers });
    ref.current = controller;
    return () => {
      controller.dispose();
      ref.current = null;
    };
  }, []);

  const open = layers.length > 0;
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  const nav = useMemo<LayerNav>(
    () => ({
      openPage: route => ref.current?.push({ type: 'page', route }),
      openSheet: sheet => ref.current?.push({ type: 'sheet', sheet }),
      replacePage: route => ref.current?.replaceTop({ type: 'page', route }),
      back: () => ref.current?.back(),
      popTo: depth => ref.current?.popTo(depth),
      returnToPage: route => ref.current?.returnTo({ type: 'page', route }),
    }),
    [],
  );

  return { layers, ...nav };
}
