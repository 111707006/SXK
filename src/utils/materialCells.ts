/**
 * 干預素材的**格子空間**與一筆素材的形狀 —— 純函式，不碰 React、不碰資料庫。
 *
 * 素材庫是一張 90 格的表：九個維度 × 五個年齡段 × 兩級嚴重度。格子從
 * `DIMENSIONS_DATA` 與 `T1_AGE_BANDS` **推導**出來，不另外抄一份清單 ——
 * 2026-07 的維度正名已經示範過抄一份的下場：六張表裡有一張沒跟著改，
 * 而 29 條測試全綠。
 *
 * 發育訓練的年齡差是關鍵的：把學齡前的精細動作訓練給一歲半的孩子，他做不到，
 * 家長會以為孩子又失敗了一次。因此格子是（維度，年齡段，嚴重度）三者的組合，
 * **不退回鄰近年齡段、不退回通用方案**（那條規則由 issue #26 的配對邏輯執行，
 * 這裡只負責讓「哪一格」有唯一的說法）。
 *
 * 內容以**圖文為主、影片連結為輔**：每一則步驟一張圖配一句指令，影片是選填的
 * 外部連結。這個決定讓素材庫完全不需要檔案上傳與物件儲存服務
 * （見 `docs/adr/0003-intervention-materials-are-images-and-text.md`）。
 */
import { DIMENSIONS_DATA } from '../data';
import { T1_AGE_BANDS } from '../t1Data';

/**
 * 需要干預素材的兩級嚴重度，就是報告上被標記的那兩種判定。
 *
 * 刻意與 `AssessmentStatus` 用同一組字串：分成兩套語彙的話，後台維護的是
 * 「需留意」那一格，而家長端拿著 `borderline` 去查表卻查不到。`normal` 不在
 * 其中 —— 沒有被標記的維度不需要干預素材。
 */
export const MATERIAL_SEVERITIES = ['borderline', 'delay'] as const;

export type MaterialSeverity = (typeof MATERIAL_SEVERITIES)[number];

/** 90 格中的一格。名稱一併帶著，呼叫端不必再查一次表。 */
export interface MaterialCell {
  dimensionId: string;
  dimensionName: string;
  ageBandId: string;
  ageBandName: string;
  severity: MaterialSeverity;
}

/** 一則分解步驟：一張圖，一句指令。兩者都是必填。 */
export interface MaterialStep {
  imageUrl: string;
  instruction: string;
}

/** 一格素材的可寫入內容。`id` 與時間戳由資料層決定，不在這裡。 */
export interface MaterialInput {
  dimensionId: string;
  ageBandId: string;
  severity: MaterialSeverity;
  title: string;
  /** 步驟的**順序就是家長照著做的順序**，因此陣列順序是資料的一部分。 */
  steps: MaterialStep[];
  /** 選填。`null` 代表這一格沒有影片，不是「還沒填」。 */
  videoUrl: string | null;
  active: boolean;
}

/** 資料層讀回來的一筆素材。 */
export interface MaterialRecord extends MaterialInput {
  id: number;
  updatedAt: string | null;
}

// ══════════════════════════════════════════════
// 格子空間
// ══════════════════════════════════════════════

/**
 * 全部 90 格，順序是「維度 → 年齡段 → 嚴重度」。
 *
 * 由九維與五段推導，因此維度改名或年齡段調整時這裡自動跟上，
 * 而 `test/materialCells.test.ts` 會擋住兩邊分岔。
 */
export const MATERIAL_CELLS: MaterialCell[] = DIMENSIONS_DATA.flatMap(dimension =>
  T1_AGE_BANDS.flatMap(band =>
    MATERIAL_SEVERITIES.map(severity => ({
      dimensionId: dimension.id,
      dimensionName: dimension.name,
      ageBandId: band.id,
      ageBandName: band.name,
      severity,
    }))
  )
);

/** 索引鍵的唯一寫法。分開拼字串的地方多了，就會有兩種拼法對不起來。 */
export function materialCellKey(dimensionId: string, ageBandId: string, severity: string): string {
  return `${dimensionId}/${ageBandId}/${severity}`;
}

export function isMaterialSeverity(value: unknown): value is MaterialSeverity {
  return typeof value === 'string' && (MATERIAL_SEVERITIES as readonly string[]).includes(value);
}

const CELL_BY_KEY = new Map(
  MATERIAL_CELLS.map(cell => [materialCellKey(cell.dimensionId, cell.ageBandId, cell.severity), cell])
);

/**
 * 三個值對應到的格子；任何一個不認得就回 `null`，**不猜**。
 *
 * 猜一格出來的代價是把別的年齡段的訓練內容存進這一格 —— 而畫面上看起來
 * 完全正常。
 */
export function findMaterialCell(
  dimensionId: unknown,
  ageBandId: unknown,
  severity: unknown
): MaterialCell | null {
  if (typeof dimensionId !== 'string' || typeof ageBandId !== 'string' || !isMaterialSeverity(severity)) {
    return null;
  }
  return CELL_BY_KEY.get(materialCellKey(dimensionId, ageBandId, severity)) ?? null;
}

// ══════════════════════════════════════════════
// 後台的格子檢視
// ══════════════════════════════════════════════

export interface MaterialCellRow {
  cell: MaterialCell;
  /** `null` 代表這一格還沒建立素材。**已停用的素材不是 `null`** —— 見下。 */
  material: MaterialRecord | null;
}

/**
 * 某個維度的十格（五段 × 兩級），照年齡段與嚴重度排好，各自帶上已建立的素材。
 *
 * 「未建立」與「已停用」刻意分得開：對家長來說結果一樣（都拿不到素材），
 * 對維護的人完全不同 —— 一個是還沒做，一個是做了又收回去。混成同一種狀態，
 * 就沒有人知道 90 格裡還剩幾格要做。
 */
export function cellsForDimension(dimensionId: string, materials: MaterialRecord[]): MaterialCellRow[] {
  const byKey = new Map(
    materials.map(m => [materialCellKey(m.dimensionId, m.ageBandId, m.severity), m])
  );
  return MATERIAL_CELLS.filter(cell => cell.dimensionId === dimensionId).map(cell => ({
    cell,
    material: byKey.get(materialCellKey(cell.dimensionId, cell.ageBandId, cell.severity)) ?? null,
  }));
}

export interface MaterialCoverage {
  total: number;
  filled: number;
  active: number;
  /**
   * 落在 90 格之外的素材筆數 —— 正常情況永遠是 0。
   *
   * 維度改名時就不是 0 了（2026-07 已經發生過一次）：舊的 `dimension_id`
   * 還在資料庫裡，但沒有任何一格對得上它。這種列**在任何一個維度的十格裡都
   * 看不到**，只算進總數的話，畫面會說「已建立 12 格」而點得到的只有 11 格，
   * 然後被當成畫面壞掉。分開數，讓它有話可說。
   */
  orphaned: number;
}

/** 整份素材庫的進度。四個數字各自代表一件事，混在一起就沒有一個是可信的。 */
export function coverageOf(materials: MaterialRecord[]): MaterialCoverage {
  const known = materials.filter(m => findMaterialCell(m.dimensionId, m.ageBandId, m.severity) !== null);
  return {
    total: MATERIAL_CELLS.length,
    filled: known.length,
    active: known.filter(m => m.active).length,
    orphaned: materials.length - known.length,
  };
}

// ══════════════════════════════════════════════
// 收下一筆素材
// ══════════════════════════════════════════════

const MAX_TITLE = 128;
const MAX_INSTRUCTION = 500;
const MAX_URL = 512;

/**
 * 一格素材最多幾則步驟。**匯出給編輯畫面用**，兩邊才會說同一件事 ——
 * 前端不知道上限的話，使用者加到第 21 步才被整筆退回，而前 20 步是他剛剛
 * 一句一句打出來的。
 */
export const MAX_STEPS = 20;

export type MaterialInputResult =
  | { ok: true; input: MaterialInput }
  | { ok: false; error: string };

/**
 * 網址只收 `https://` 或站內的 `/…`。
 *
 * 家長端整站走 https，`http://` 的圖會被瀏覽器當成混合內容擋掉 —— 後台看起來
 * 存好了，家長那邊是一張破圖，而且沒有人會收到訊息。`javascript:` 與 `data:`
 * 則是把一段可執行的東西存進資料庫，再原樣貼到家長的頁面上。
 *
 * 站內路徑要放行是因為這個 repo **沒有檔案上傳能力**：隨著建置一起出貨的
 * `public/` 圖檔是唯一不依賴外部主機的來源。
 */
function isAllowedUrl(value: string): boolean {
  if (value.startsWith('https://')) return value.length > 'https://'.length;
  // `//example.com` 是協定相對網址，不是站內路徑 —— 擋掉。
  return value.startsWith('/') && !value.startsWith('//');
}

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function readSteps(raw: unknown): { ok: true; steps: MaterialStep[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: '每一格素材至少要有一则分解步骤。' };
  }
  // 超過上限**整筆拒收**，不默默截斷。截斷的話，使用者按下儲存後畫面上還有
  // 第 21 步，而資料庫裡沒有 —— 而步驟是一句一句寫出來的，被吃掉的那幾句
  // 要等到家長照著做、發現最後幾步不見了才會有人知道。
  if (raw.length > MAX_STEPS) {
    return { ok: false, error: `一格素材最多 ${MAX_STEPS} 则步骤，目前有 ${raw.length} 则。` };
  }
  const steps: MaterialStep[] = [];
  for (const [index, item] of raw.entries()) {
    const imageUrl = readText((item as any)?.imageUrl, MAX_URL);
    const instruction = readText((item as any)?.instruction, MAX_INSTRUCTION);
    if (!imageUrl || !instruction) {
      return { ok: false, error: `第 ${index + 1} 步要同时填写分解图与指令文字。` };
    }
    if (!isAllowedUrl(imageUrl)) {
      return { ok: false, error: `第 ${index + 1} 步的分解图网址必须是 https:// 开头，或站内的 / 路径。` };
    }
    steps.push({ imageUrl, instruction });
  }
  return { ok: true, steps };
}

/**
 * 把請求的內容讀成一筆素材，讀不出來就說是哪裡不對。
 *
 * 回傳判別聯集而不是 `MaterialInput | null`：呼叫端要把原因原封不動送回畫面，
 * 而「存不下去但不說為什麼」正是後台最容易讓人放棄的地方。
 */
export function readMaterialInput(body: unknown): MaterialInputResult {
  const raw = (body ?? {}) as Record<string, unknown>;

  const cell = findMaterialCell(raw.dimensionId, raw.ageBandId, raw.severity);
  if (!cell) {
    return { ok: false, error: '维度、年龄段或严重度不在素材库的 90 格之内。' };
  }

  const title = readText(raw.title, MAX_TITLE);
  if (!title) return { ok: false, error: '请填写素材标题。' };

  const steps = readSteps(raw.steps);
  if (!steps.ok) return steps;

  // 影片是選填。空字串與只有空白都等於「這一格沒有影片」，
  // 而不是一個存進去之後點下去打不開的連結。
  const videoUrl = readText(raw.videoUrl, MAX_URL);
  if (videoUrl && !isAllowedUrl(videoUrl)) {
    return { ok: false, error: '影片链接必须是 https:// 开头。' };
  }

  return {
    ok: true,
    input: {
      dimensionId: cell.dimensionId,
      ageBandId: cell.ageBandId,
      severity: cell.severity,
      title,
      steps: steps.steps,
      videoUrl,
      // 沒填視為啟用：新增表單的預設是啟用，漏送這個欄位不該把素材悄悄關掉。
      active: raw.active !== false,
    },
  };
}
