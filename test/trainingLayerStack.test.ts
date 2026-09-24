import { describe, it, expect } from 'vitest';
import { createLayerHistory, type Layer } from '../src/components/training/layerStack';

/**
 * 家庭訓練的頁面堆疊與瀏覽器歷史（Keep 規格 §3 共同規則）。
 *
 * 「每推一層就 `history.pushState` 一次，瀏覽器返回鍵與 Android 實體返回鍵關的是最上面那一層——
 * 家長在微信裡按返回，不該整個離開報告。」專案沒有 jsdom，這裡用一個照瀏覽器語意走的假歷史
 * （pushState 截掉前進的那幾格、go 之後非同步發 popstate）驗控制器，不驗 React。
 */

type Listener = (event: { state: unknown }) => void;

/** 照瀏覽器語意走的假歷史：一串 entry、一個游標；`go` 之後在下一個 microtask 發 popstate。 */
function fakeBrowser(initialState: unknown = null) {
  const entries: Array<{ state: unknown }> = [{ state: initialState }];
  let index = 0;
  const listeners = new Set<Listener>();
  const calls = { push: 0, replace: 0, go: [] as number[] };
  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(state: unknown) {
      calls.push += 1;
      entries.splice(index + 1);
      entries.push({ state: structuredClone(state) });
      index += 1;
    },
    replaceState(state: unknown) {
      calls.replace += 1;
      entries[index] = { state: structuredClone(state) };
    },
    go(delta: number) {
      calls.go.push(delta);
      const next = Math.max(0, Math.min(entries.length - 1, index + delta));
      if (next === index) return;
      queueMicrotask(() => {
        index = next;
        for (const fn of [...listeners]) fn({ state: entries[index].state });
      });
    },
  };
  const target = {
    addEventListener: (_type: 'popstate', fn: Listener) => listeners.add(fn),
    removeEventListener: (_type: 'popstate', fn: Listener) => listeners.delete(fn),
  };
  return {
    history,
    target,
    calls,
    /** 家長按了瀏覽器／實體返回鍵。 */
    pressBack: () => history.go(-1),
    pressForward: () => history.go(1),
    get depth() {
      return index;
    },
    get length() {
      return entries.length;
    },
    listenerCount: () => listeners.size,
  };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const plan: Layer = { type: 'page', route: { name: 'plan' } };
const detail: Layer = { type: 'page', route: { name: 'detail', id: 'A001', from: 'plan' } };
const expert: Layer = { type: 'sheet', sheet: { kind: 'expert' } };

function setup(initialState: unknown = null) {
  const browser = fakeBrowser(initialState);
  const seen: Layer[][] = [];
  const stack = createLayerHistory({ history: browser.history, target: browser.target, onChange: l => seen.push(l) });
  return { browser, stack, seen };
}

describe('推一層就 pushState 一次', () => {
  it('推計劃頁、再推詳情：歷史多兩格，堆疊是兩層', () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    expect(browser.calls.push).toBe(2);
    expect(browser.length).toBe(3);
    expect(stack.layers()).toEqual([plan, detail]);
  });
});

describe('返回鍵關最上面那一層，不整個離開報告', () => {
  it('按一次返回只關詳情，計劃頁還在；再按一次回到報告', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);

    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan]);

    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([]);
    // 停在報告那一格（進來之前那一格），沒有往更前面退
    expect(browser.depth).toBe(0);
  });

  it('抽屜也是一層：開著「问专家」時按返回，只關抽屜', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(expert);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan]);
  });

  it('畫面上的返回（‹）走同一條路：退一格歷史，由 popstate 關那一層', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.back();
    expect(browser.calls.go).toEqual([-1]);
    await flush();
    expect(stack.layers()).toEqual([plan]);
  });

  it('堆疊是空的時候，畫面上的返回不動歷史（不把家長退出報告）', () => {
    const { browser, stack } = setup();
    stack.back();
    expect(browser.calls.go).toEqual([]);
  });

  it('連按兩下畫面上的返回：上一次的退格還沒落地時不再退，只關一層', async () => {
    // 兩次 `history.go(-1)` 疊在同一個 tick 裡，各家瀏覽器（尤其微信內建的）不保證退兩格；
    // 退一格、畫面關一層是唯一在每一家都對得上的結果。
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.back();
    stack.back();
    expect(browser.calls.go).toEqual([-1]);
    await flush();
    expect(stack.layers()).toEqual([plan]);
    // 落地之後照常能再退
    stack.back();
    await flush();
    expect(stack.layers()).toEqual([]);
  });
});

describe('其餘移動', () => {
  it('換掉最上面一層（詳情切到同系列的另一支）用 replaceState，歷史不多一格', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    const other: Layer = { type: 'page', route: { name: 'detail', id: 'A003', from: 'plan' } };
    stack.replaceTop(other);
    expect(browser.calls.push).toBe(2);
    expect(browser.calls.replace).toBe(1);
    expect(stack.layers()).toEqual([plan, other]);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan]);
  });

  it('退回某一層（打卡後「回到计划」）一次退好幾格', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.push(expert);
    stack.popTo(1);
    expect(browser.calls.go).toEqual([-2]);
    await flush();
    expect(stack.layers()).toEqual([plan]);
  });

  it('前進鍵把剛關掉的那一層開回來', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    browser.pressBack();
    await flush();
    browser.pressForward();
    await flush();
    expect(stack.layers()).toEqual([plan, detail]);
  });
});

describe('邊界', () => {
  it('離開（元件卸載）時還開著幾層，就把那幾格歷史退掉，並且不再聽 popstate', async () => {
    const { browser, stack, seen } = setup();
    stack.push(plan);
    stack.push(detail);
    seen.length = 0;
    stack.dispose();
    expect(browser.calls.go).toEqual([-2]);
    expect(browser.listenerCount()).toBe(0);
    await flush();
    expect(browser.depth).toBe(0);
    expect(seen).toEqual([]);
  });

  it('重新整理後停在一格帶著堆疊的歷史上：先把那一格洗掉，不從半路開一個計劃頁', () => {
    const { browser, stack } = setup({ other: 1, sxkTraining: [plan] });
    expect(stack.layers()).toEqual([]);
    expect(browser.calls.replace).toBe(1);
    expect(browser.history.state).toEqual({ other: 1 });
  });

  it('popstate 帶著認不得的東西：當成沒有任何一層', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    browser.history.replaceState({ sxkTraining: [{ type: 'page' }, 42, 'x'] });
    stack.push(detail);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([]);
  });

  it('推進去的那一格保留原本歷史狀態的其他鍵', () => {
    const { browser, stack } = setup({ other: 1 });
    stack.push(plan);
    expect(browser.history.state).toEqual({ other: 1, sxkTraining: [plan] });
  });
});
