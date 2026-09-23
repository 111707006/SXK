import { describe, it, expect } from 'vitest';
import { MAX_STEPS, readSteps } from '../src/utils/activitySteps';

/**
 * 分解步驟的讀法（#63；ADR-0008 改成圖選填，Keep 規格 K04）。
 *
 * 原本住在 `materialCells.ts`，素材庫與活動庫共用；素材庫退場後（ADR-0005）只剩活動庫
 * 一個呼叫端，規則原封不動搬過來 —— 圖的網址、上限、順序 —— 這幾條當初是為了家長端
 * 那一頁定的，跟哪個庫在用它無關。「每一步要同時有圖有字」2026-09-23 由 ADR-0008 取代：
 * 指令仍必填，圖選填；有圖時照舊只收 `https://` 或站內 `/…`。
 */

const step = { imageUrl: '/a.png', instruction: '做一次' };

describe('readSteps', () => {
  it('活動允許零步 —— 300 支種子全部是零步，內容團隊先填目標月齡再慢慢補圖文', () => {
    expect(readSteps([])).toEqual({ ok: true, steps: [] });
  });

  it('不是陣列就拒收', () => {
    expect(readSteps('nope').ok).toBe(false);
    expect(readSteps(undefined).ok).toBe(false);
    expect(readSteps({ imageUrl: '/a.png', instruction: 'x' }).ok).toBe(false);
  });

  // 截斷的話，使用者按下儲存後畫面上還有第 21 步而資料庫裡沒有，
  // 而被吃掉的那幾句要等到家長照著做才會有人發現。
  it('步驟超過上限時整筆拒收，不默默截斷', () => {
    const twenty = readSteps(Array.from({ length: MAX_STEPS }, () => step));
    expect(twenty.ok).toBe(true);
    if (twenty.ok) expect(twenty.steps).toHaveLength(MAX_STEPS);
    const over = readSteps(Array.from({ length: MAX_STEPS + 1 }, () => step));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain(String(MAX_STEPS));
  });

  // ADR-0008：客戶的手冊「怎么玩」只有文字。照舊規則（每步一定要有圖）300 支沒有一支存得進去。
  it('圖選填：沒有圖、圖是 null、空字串或只有空白，都存成 null', () => {
    expect(readSteps([{ instruction: '做一次' }])).toEqual({ ok: true, steps: [{ imageUrl: null, instruction: '做一次' }] });
    expect(readSteps([{ imageUrl: null, instruction: '做一次' }])).toEqual({
      ok: true,
      steps: [{ imageUrl: null, instruction: '做一次' }],
    });
    expect(readSteps([{ imageUrl: '', instruction: '做一次' }])).toEqual({ ok: true, steps: [{ imageUrl: null, instruction: '做一次' }] });
    expect(readSteps([{ imageUrl: '  ', instruction: '做一次' }])).toEqual({
      ok: true,
      steps: [{ imageUrl: null, instruction: '做一次' }],
    });
  });

  it('有圖沒圖可以混在同一串裡，順序照收', () => {
    const r = readSteps([step, { instruction: '再做一次' }]);
    expect(r).toEqual({
      ok: true,
      steps: [
        { imageUrl: '/a.png', instruction: '做一次' },
        { imageUrl: null, instruction: '再做一次' },
      ],
    });
  });

  it('指令文字仍然必填，並說出是第幾步', () => {
    expect(readSteps([{ imageUrl: 'https://x/1.png' }]).ok).toBe(false);
    expect(readSteps([{ imageUrl: '/a.png', instruction: '   ' }]).ok).toBe(false);
    const r = readSteps([step, { imageUrl: '/b.png' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('第 2 步');
  });

  it('一則步驟不是物件、或圖的網址不是字串，整筆拒收', () => {
    expect(readSteps(['做一次']).ok).toBe(false);
    expect(readSteps([null]).ok).toBe(false);
    const r = readSteps([step, { imageUrl: 5, instruction: '做一次' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('第 2 步');
  });

  it('圖的網址只收 https:// 或站內路徑 —— http:// 在家長端是混合內容，一張破圖沒有人會收到訊息', () => {
    expect(readSteps([{ imageUrl: 'https://cdn.example.com/1.png', instruction: '做一次' }]).ok).toBe(true);
    expect(readSteps([{ imageUrl: '/s/1.png', instruction: '做一次' }]).ok).toBe(true);
    expect(readSteps([{ imageUrl: 'http://x/1.png', instruction: '不是 https' }]).ok).toBe(false);
    expect(readSteps([{ imageUrl: '//evil.example.com/x.png', instruction: 'x' }]).ok).toBe(false);
    expect(readSteps([{ imageUrl: 'javascript:alert(1)', instruction: 'x' }]).ok).toBe(false);
  });

  // 步驟的順序就是家長照著做的順序，因此陣列的順序是資料的一部分。
  it('步驟的順序照收、前後空白修掉，不重新排序', () => {
    const r = readSteps([
      { imageUrl: ' /2.png ', instruction: ' 第二 ' },
      { imageUrl: '/1.png', instruction: '第一' },
    ]);
    expect(r).toEqual({
      ok: true,
      steps: [
        { imageUrl: '/2.png', instruction: '第二' },
        { imageUrl: '/1.png', instruction: '第一' },
      ],
    });
  });
});
