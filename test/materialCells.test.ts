import { describe, it, expect } from 'vitest';
import {
  MATERIAL_CELLS,
  MATERIAL_SEVERITIES,
  cellsForDimension,
  coverageOf,
  findMaterialCell,
  isMaterialSeverity,
  materialCellKey,
  readMaterialInput,
  type MaterialCellRow,
} from '../src/utils/materialCells';
import { DIMENSIONS_DATA } from '../src/data';
import { T1_AGE_BANDS } from '../src/t1Data';
import { statusLabel } from '../src/admin/adminView';

/**
 * 素材庫的格子空間（issue #20）。
 *
 * 這裡釘住的是「有哪些格子」與「一筆素材長什麼樣」。兩者錯掉的樣子都很安靜：
 * 少一個格子只會讓某個年齡段的孩子永遠拿不到干預包（畫面上看起來就是「準備中」），
 * 而一筆步驟壞掉的素材會在家長端顯示成一張破圖配一句空白指令。
 *
 * 配對邏輯（依孩子的維度／年齡段／嚴重度取出素材）是 issue #26，不在這裡。
 */

describe('九十個格子', () => {
  it('剛好是 維度 × 年齡段 × 嚴重度', () => {
    expect(MATERIAL_CELLS).toHaveLength(
      DIMENSIONS_DATA.length * T1_AGE_BANDS.length * MATERIAL_SEVERITIES.length
    );
    expect(MATERIAL_CELLS).toHaveLength(90);
  });

  it('沒有兩個格子的索引鍵相同', () => {
    const keys = MATERIAL_CELLS.map(c => materialCellKey(c.dimensionId, c.ageBandId, c.severity));
    expect(new Set(keys).size).toBe(keys.length);
  });

  // 格子是從九維與五段推導出來的，不是另外抄一份清單。抄一份的話，
  // 下一次維度正名（2026-07 已經發生過一次）會讓素材庫悄悄指向不存在的維度。
  it('維度與年齡段都來自唯一來源，名稱也一致', () => {
    const dimName = new Map(DIMENSIONS_DATA.map(d => [d.id, d.name]));
    const bandName = new Map(T1_AGE_BANDS.map(b => [b.id, b.name]));
    for (const cell of MATERIAL_CELLS) {
      expect(dimName.get(cell.dimensionId), cell.dimensionId).toBe(cell.dimensionName);
      expect(bandName.get(cell.ageBandId), cell.ageBandId).toBe(cell.ageBandName);
    }
  });

  it('嚴重度只有被標記的兩種 —— 正常的維度不需要干預素材', () => {
    expect([...MATERIAL_SEVERITIES]).toEqual(['borderline', 'delay']);
  });

  // 素材庫的嚴重度與報告上的判定是同一組字串。分成兩套的話，後台維護的是
  // 「需留意」那一格，而家長端拿 borderline 去查表卻查不到。
  it('嚴重度的說法沿用報告上的判定用語', () => {
    expect(MATERIAL_SEVERITIES.map(statusLabel)).toEqual(['需留意', '需关注']);
  });

  it('每個維度都有十個格子（五段各兩級）', () => {
    for (const dimension of DIMENSIONS_DATA) {
      expect(cellsForDimension(dimension.id, []), dimension.id).toHaveLength(10);
    }
  });
});

describe('查得到格子才收得下素材', () => {
  it('認得出真的格子', () => {
    const cell = findMaterialCell('language', 'B', 'delay');
    expect(cell).toMatchObject({ dimensionId: 'language', ageBandId: 'B', severity: 'delay' });
  });

  it('維度、年齡段、嚴重度任何一個不認得就回 null，不猜一格出來', () => {
    expect(findMaterialCell('fine_motor', 'B', 'delay')).toBeNull();
    expect(findMaterialCell('language', 'F', 'delay')).toBeNull();
    expect(findMaterialCell('language', 'B', 'normal')).toBeNull();
    expect(findMaterialCell(null, undefined, 42)).toBeNull();
  });

  it('嚴重度不收「正常」', () => {
    expect(isMaterialSeverity('borderline')).toBe(true);
    expect(isMaterialSeverity('delay')).toBe(true);
    expect(isMaterialSeverity('normal')).toBe(false);
    expect(isMaterialSeverity('')).toBe(false);
  });
});

describe('一筆素材的形狀', () => {
  const valid = {
    dimensionId: 'language',
    ageBandId: 'B',
    severity: 'delay',
    title: '轮流发声游戏',
    steps: [
      { imageUrl: 'https://cdn.example.com/1.png', instruction: '面对面坐下，与孩子视线齐高。' },
      { imageUrl: '/materials/2.png', instruction: '发出一个单音，等孩子回应再发下一个。' },
    ],
    videoUrl: 'https://v.example.com/abc',
    active: true,
  };

  it('收得下一筆完整的素材', () => {
    const result = readMaterialInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.title).toBe('轮流发声游戏');
    expect(result.input.steps).toHaveLength(2);
    expect(result.input.videoUrl).toBe('https://v.example.com/abc');
  });

  it('影片連結是選填 —— 圖文才是主體', () => {
    for (const videoUrl of [undefined, null, '', '   ']) {
      const result = readMaterialInput({ ...valid, videoUrl });
      expect(result.ok, String(videoUrl)).toBe(true);
      if (result.ok) expect(result.input.videoUrl).toBeNull();
    }
  });

  it('至少要有一則步驟 —— 沒有步驟的素材在家長端是一張空白頁', () => {
    expect(readMaterialInput({ ...valid, steps: [] }).ok).toBe(false);
    expect(readMaterialInput({ ...valid, steps: 'nope' }).ok).toBe(false);
  });

  // 截斷的話，使用者按下儲存後畫面上還有第 21 步而資料庫裡沒有，
  // 而被吃掉的那幾句要等到家長照著做才會有人發現。
  it('步驟超過上限時整筆拒收，不默默截斷', () => {
    const step = { imageUrl: '/a.png', instruction: '做一次' };
    const twenty = readMaterialInput({ ...valid, steps: Array.from({ length: 20 }, () => step) });
    expect(twenty.ok).toBe(true);
    if (twenty.ok) expect(twenty.input.steps).toHaveLength(20);
    expect(readMaterialInput({ ...valid, steps: Array.from({ length: 21 }, () => step) }).ok).toBe(false);
  });

  it('每一則步驟都要有圖也要有指令文字', () => {
    expect(readMaterialInput({ ...valid, steps: [{ imageUrl: 'https://x/1.png' }] }).ok).toBe(false);
    expect(readMaterialInput({ ...valid, steps: [{ instruction: '做一次' }] }).ok).toBe(false);
    expect(
      readMaterialInput({ ...valid, steps: [{ imageUrl: '  ', instruction: '做一次' }] }).ok
    ).toBe(false);
  });

  // 步驟的順序就是家長照著做的順序，因此陣列的順序是資料的一部分，
  // 不是顯示時才決定的事。
  it('步驟的順序照收，不重新排序', () => {
    const result = readMaterialInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.steps.map(s => s.instruction)).toEqual([
      '面对面坐下，与孩子视线齐高。',
      '发出一个单音，等孩子回应再发下一个。',
    ]);
  });

  /**
   * 網址只收 `https://` 或站內的 `/…`。
   *
   * 家長端整站走 https，`http://` 的圖會被瀏覽器當成混合內容擋掉 —— 後台看起來
   * 存好了，家長那邊是一張破圖。`javascript:` 與 `data:` 則是直接把一段可執行
   * 的東西存進資料庫再貼到家長的頁面上。
   */
  it('圖與影片的網址只收 https:// 或站內路徑', () => {
    const bad = ['http://cdn.example.com/1.png', 'javascript:alert(1)', 'data:image/png;base64,AAA', 'cdn.example.com/1.png'];
    for (const imageUrl of bad) {
      expect(readMaterialInput({ ...valid, steps: [{ imageUrl, instruction: '做一次' }] }).ok, imageUrl).toBe(false);
    }
    for (const videoUrl of bad) {
      expect(readMaterialInput({ ...valid, videoUrl }).ok, videoUrl).toBe(false);
    }
  });

  it('格子不存在就整筆拒收', () => {
    expect(readMaterialInput({ ...valid, dimensionId: 'fine_motor' }).ok).toBe(false);
    expect(readMaterialInput({ ...valid, ageBandId: 'Z' }).ok).toBe(false);
    expect(readMaterialInput({ ...valid, severity: 'normal' }).ok).toBe(false);
  });

  it('標題必填', () => {
    expect(readMaterialInput({ ...valid, title: '' }).ok).toBe(false);
    expect(readMaterialInput({ ...valid, title: '   ' }).ok).toBe(false);
  });

  it('拒收時說得出是哪裡不對', () => {
    const result = readMaterialInput({ ...valid, steps: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('停用是一個明確的值，不是「沒填」', () => {
    expect(readMaterialInput({ ...valid, active: false }).ok && readMaterialInput({ ...valid, active: false }).ok).toBe(true);
    const off = readMaterialInput({ ...valid, active: false });
    const missing = readMaterialInput({ ...valid, active: undefined });
    expect(off.ok && off.input.active).toBe(false);
    // 沒填視為啟用：新增表單的預設是啟用，漏送這個欄位不該把素材悄悄關掉。
    expect(missing.ok && missing.input.active).toBe(true);
  });
});

describe('後台的格子檢視', () => {
  const material = (over: Partial<MaterialCellRow['material']> & { id: number }) => ({
    id: over.id,
    dimensionId: over.dimensionId ?? 'language',
    ageBandId: over.ageBandId ?? 'B',
    severity: over.severity ?? ('delay' as const),
    title: over.title ?? '素材',
    videoUrl: over.videoUrl ?? null,
    steps: over.steps ?? [{ imageUrl: '/a.png', instruction: '做一次' }],
    active: over.active ?? true,
    updatedAt: over.updatedAt ?? null,
  });

  it('一個維度的十格照年齡段與嚴重度排列，並帶上已建立的素材', () => {
    const rows = cellsForDimension('language', [material({ id: 1 })]);
    expect(rows.map(r => `${r.cell.ageBandId}/${r.cell.severity}`)).toEqual([
      'A/borderline', 'A/delay',
      'B/borderline', 'B/delay',
      'C/borderline', 'C/delay',
      'D/borderline', 'D/delay',
      'E/borderline', 'E/delay',
    ]);
    const filled = rows.filter(r => r.material !== null);
    expect(filled).toHaveLength(1);
    expect(filled[0].cell.ageBandId).toBe('B');
  });

  it('別的維度的素材不會出現在這個維度的格子上', () => {
    const rows = cellsForDimension('language', [material({ id: 1, dimensionId: 'cognitive' })]);
    expect(rows.every(r => r.material === null)).toBe(true);
  });

  /**
   * 「未建立」與「已停用」在畫面上必須分得開。
   *
   * 兩者對家長來說結果一樣（都拿不到素材），但對維護的人完全不同：一個是還沒做，
   * 一個是做了又收回去。混成同一格顏色，就沒有人知道 90 格裡還剩幾格要做。
   */
  it('已停用的素材仍然掛在它的格子上，不會被當成未建立', () => {
    const rows = cellsForDimension('language', [material({ id: 1, active: false })]);
    const row = rows.find(r => r.cell.ageBandId === 'B' && r.cell.severity === 'delay')!;
    expect(row.material?.active).toBe(false);
  });

  it('覆蓋率分開數「已建立」與「啟用中」', () => {
    const coverage = coverageOf([
      material({ id: 1, ageBandId: 'A' }),
      material({ id: 2, ageBandId: 'B', active: false }),
    ]);
    expect(coverage).toEqual({ total: 90, filled: 2, active: 1, orphaned: 0 });
  });

  it('一筆素材都沒有時覆蓋率是零，不是空白', () => {
    expect(coverageOf([])).toEqual({ total: 90, filled: 0, active: 0, orphaned: 0 });
  });

  /**
   * 維度改名之後，舊的 `dimension_id` 還留在資料庫裡而沒有任何一格對得上。
   * 這種列在任何一個維度的十格裡都看不到 —— 算進「已建立」的話，畫面會說
   * 已建立 2 格而點得到的只有 1 格。
   */
  it('落在 90 格之外的素材單獨數，不混進已建立', () => {
    const coverage = coverageOf([
      material({ id: 1 }),
      material({ id: 2, dimensionId: 'fine_motor' }),
    ]);
    expect(coverage).toEqual({ total: 90, filled: 1, active: 1, orphaned: 1 });
  });
});
