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
    scrollRestoration: 'auto' as 'auto' | 'manual',
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

describe('播放器、打卡成功、抽屜也都是一層（票 7）', () => {
  const go: Layer = { type: 'page', route: { name: 'go', id: 'A001', from: 'plan', mode: 'video' } };
  const done: Layer = { type: 'page', route: { name: 'checkin', id: 'A001', checkinId: 12, times: 3, date: '2026-09-23' } };
  const actions: Layer = { type: 'sheet', sheet: { kind: 'actions', id: 'A001', from: 'plan' } };

  it('播放器開著時按返回：關掉播放器回到詳情，不離開報告（✕ 也是這一條）', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.push(go);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan, detail]);
  });

  it('做完了打卡：打卡成功取代播放器（歷史不多一格）；在打卡成功按返回回到詳情，不回播放器', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.push(go);
    stack.replaceTop(done);
    expect(browser.calls.push).toBe(3);
    expect(stack.layers()).toEqual([plan, detail, done]);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan, detail]);
  });

  it('動作列表抽屜裡按 GO：抽屜換成播放器，返回回到詳情', async () => {
    const { browser, stack } = setup();
    stack.push(detail);
    stack.push(actions);
    stack.replaceTop(go);
    expect(stack.layers()).toEqual([detail, go]);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([detail]);
  });

  it.each([
    ['動作列表', actions],
    ['要準備', { type: 'sheet', sheet: { kind: 'equip', id: 'A001', from: 'plan' } } as Layer],
    ['跟練方式', { type: 'sheet', sheet: { kind: 'mode', id: 'A001', from: 'plan' } } as Layer],
    ['投屏', { type: 'sheet', sheet: { kind: 'cast', hasVideo: true } } as Layer],
    ['加到日曆', { type: 'sheet', sheet: { kind: 'calendar' } } as Layer],
    ['問專家', expert],
  ])('%s抽屜開在詳情上：返回只關抽屜', async (_name, sheet) => {
    const { browser, stack } = setup();
    stack.push(plan);
    stack.push(detail);
    stack.push(sheet);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([plan, detail]);
  });

  it('投屏說明開在播放器上：返回只關說明，播放器還在', async () => {
    const { browser, stack } = setup();
    stack.push(detail);
    stack.push(go);
    stack.push({ type: 'sheet', sheet: { kind: 'cast', hasVideo: true } });
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([detail, go]);
  });

  describe('「回到计划」（returnTo）', () => {
    it('計劃頁在堆疊裡：一次退到它', async () => {
      const { browser, stack } = setup();
      stack.push(plan);
      stack.push(detail);
      stack.push(done);
      stack.returnTo(plan);
      expect(browser.calls.go).toEqual([-2]);
      await flush();
      expect(stack.layers()).toEqual([plan]);
    });

    it('從報告的活動卡直接進詳情（堆疊裡沒有計劃頁）：退到第一層再把它換成計劃頁；再按返回回到報告', async () => {
      const { browser, stack } = setup();
      stack.push(detail);
      stack.push(done);
      stack.returnTo(plan);
      expect(browser.calls.go).toEqual([-1]);
      await flush();
      expect(stack.layers()).toEqual([plan]);
      expect(browser.depth).toBe(1);
      browser.pressBack();
      await flush();
      expect(stack.layers()).toEqual([]);
      expect(browser.depth).toBe(0);
    });

    it('只剩一層、又不是計劃頁：原地換成計劃頁，不動歷史的格數', () => {
      const { browser, stack } = setup();
      stack.push(done);
      stack.returnTo(plan);
      expect(browser.calls.go).toEqual([]);
      expect(stack.layers()).toEqual([plan]);
    });

    it('上一次的退格還沒落地時再按：不再退，也不換', async () => {
      const { browser, stack } = setup();
      stack.push(detail);
      stack.push(done);
      stack.back();
      stack.returnTo(plan);
      expect(browser.calls.go).toEqual([-1]);
      await flush();
      expect(stack.layers()).toEqual([detail]);
    });
  });

  it('歷史上的一格少了必要的欄位（播放器沒有編號、打卡成功沒有那一筆的 id）：當成沒有任何一層', async () => {
    const { browser, stack } = setup();
    stack.push(plan);
    browser.history.replaceState({ sxkTraining: [{ type: 'page', route: { name: 'go' } }] });
    stack.push(detail);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([]);

    stack.push(plan);
    browser.history.replaceState({ sxkTraining: [{ type: 'page', route: { name: 'checkin', id: 'A001', times: 1 } }] });
    stack.push(detail);
    browser.pressBack();
    await flush();
    expect(stack.layers()).toEqual([]);
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

  it('推第一層時把捲動還原改成手動：卸載時退回報告那一格，瀏覽器不把下一頁捲回舊位置', () => {
    // 家長在計劃頁按「预约」→ App 換到 T1 報告並捲到預約區塊；這時卸載退格落地，
    // 捲動還原是 auto 的話，瀏覽器會把新的一頁捲回推第一層那時報告頁的高度。
    const { browser, stack } = setup();
    expect(browser.history.scrollRestoration).toBe('auto');
    stack.push(plan);
    expect(browser.history.scrollRestoration).toBe('manual');
  });

  it('推進去的那一格保留原本歷史狀態的其他鍵', () => {
    const { browser, stack } = setup({ other: 1 });
    stack.push(plan);
    expect(browser.history.state).toEqual({ other: 1, sxkTraining: [plan] });
  });
});
