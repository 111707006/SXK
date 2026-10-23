import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYER_STATE_KEY } from '../src/components/training/layerStack';
import { decidePush, hasTrainingLayers, stateForView, viewOf, VIEW_STATE_KEY } from '../src/utils/viewHistory';

/**
 * 返回鍵回上一個畫面（issue #86，`VITE_UI_1022`）：主畫面 ↔ 歷史狀態的對應。
 */

const VIEWS = ['home', 'dashboard', 't1_screening', 'report', 'training'] as const;
type V = typeof VIEWS[number];
const isView = (v: string): v is V => (VIEWS as readonly string[]).includes(v);

describe('一格歷史記的畫面', () => {
  it('推的那一格只記畫面', () => {
    expect(stateForView('report')).toEqual({ [VIEW_STATE_KEY]: 'report' });
  });

  it('讀得回來；居家訓練的層加在同一格上也讀得回來', () => {
    expect(viewOf(stateForView('dashboard'), isView)).toBe('dashboard');
    expect(viewOf({ ...stateForView('training'), [LAYER_STATE_KEY]: [{ type: 'page', route: { name: 'calendar' } }] }, isView)).toBe('training');
  });

  it('不是我們推的、認不得的畫面都是 null（不亂換）', () => {
    expect(viewOf(null, isView)).toBeNull();
    expect(viewOf({}, isView)).toBeNull();
    expect(viewOf({ [VIEW_STATE_KEY]: 'nope' }, isView)).toBeNull();
    expect(viewOf({ [VIEW_STATE_KEY]: 3 }, isView)).toBeNull();
  });

  it('看得出這一格有沒有居家訓練開著的層', () => {
    expect(hasTrainingLayers(stateForView('training'))).toBe(false);
    expect(hasTrainingLayers({ [LAYER_STATE_KEY]: [] })).toBe(false);
    expect(hasTrainingLayers({ [LAYER_STATE_KEY]: [{ type: 'page', route: { name: 'calendar' } }] })).toBe(true);
  });
});

describe('換畫面時歷史怎麼動', () => {
  it('換了就推一格', () => {
    expect(decidePush('home', 'dashboard', false, false)).toBe('push');
  });

  it('沒換、或是返回鍵換的，不推', () => {
    expect(decidePush('report', 'report', false, false)).toBe('none');
    expect(decidePush('report', 't1_screening', true, false)).toBe('none');
  });

  it('帶著開著的層離開居家訓練：等堆疊自己退完再推', () => {
    expect(decidePush('training', 'dashboard', false, true)).toBe('defer');
  });

  it('首頁→評估面板→T1→報告，連按返回依序回去（模擬歷史）', () => {
    const stack: unknown[] = [stateForView('home')];
    let view: V = 'home';
    const go = (next: V) => {
      if (decidePush(view, next, false, false) === 'push') stack.push(stateForView(next));
      view = next;
    };
    const back = () => {
      stack.pop();
      const v = viewOf(stack[stack.length - 1], isView);
      if (v) view = v;
    };
    go('dashboard'); go('t1_screening'); go('report');
    const seen: V[] = [];
    while (stack.length > 1) { back(); seen.push(view); }
    expect(seen).toEqual(['t1_screening', 'dashboard', 'home']);
  });
});

describe('接線', () => {
  it('App 只在 1022 開著時接上', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('useViewHistory(currentView, setCurrentView, isAppView, PRODUCT.features.ui1022);');
  });
});
