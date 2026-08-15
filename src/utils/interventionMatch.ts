/**
 * 干預包的**配對邏輯**（issue #26）—— 純函式，不碰 React、不碰資料庫、不讀時鐘。
 *
 * 一句話：孩子的（維度，年齡段，嚴重度）決定他拿到哪一格素材，**三者都要對上**。
 *
 * 為什麼這件事值得一個獨立模組：唯一真正危險的錯誤是「找不到就給一個最接近的」。
 * 那一行加上去之後畫面完全正常 —— 家長看到一份圖文步驟、照著做、孩子做不到。
 * 把學齡前的精細動作訓練給一歲半的孩子，家長會以為孩子又失敗了一次，而系統
 * 從頭到尾沒有任何一個地方看起來壞掉。**不退回鄰近年齡段、不退回通用方案**由
 * `test/interventionMatch.test.ts` 逐條釘住。
 *
 * 空格子回一個明確的原因碼，而不是一個空陣列 —— 沿用 `/api/specialists` 已經
 * 在用的作法（見 `src/utils/specialists.ts`）：空陣列本身說不出話，而幾種空法
 * 在畫面上必須長得不一樣。
 */
import { ageBandOf } from './ageBandDrift';
import {
  findMaterialCell,
  isMaterialSeverity,
  type MaterialCell,
  type MaterialRecord,
  type MaterialSeverity,
} from './materialCells';
import type { AssessmentStatus, DimensionScore } from '../types';

/** 一則分解步驟，就是家長照著做的那一步。 */
export interface InterventionStep {
  imageUrl: string;
  instruction: string;
}

/**
 * 端到家長面前的內容。
 *
 * 刻意不是 `MaterialRecord`：`id` 與 `active` 是後台維護用的欄位，家長端拿到它們
 * 只會讓「已停用」這種維護狀態有機會漏到畫面上，而那對家長沒有任何意義。
 */
export interface InterventionPack {
  title: string;
  steps: InterventionStep[];
  /** `null` 代表這一格沒有影片，不是「還沒填」。 */
  videoUrl: string | null;
}

/**
 * 配對的結果。四種都要說得出話 —— 「拿不到素材」有四種原因，
 * 對家長只有兩種是有意義的（準備中、不需要），另兩種是資料壞掉。
 */
export type InterventionOutcome =
  /** 這一格有啟用中的素材 */
  | { status: 'ok'; cell: MaterialCell; pack: InterventionPack }
  /** 這一格還沒有可用的素材（沒建立，或建了又停用）—— 對家長是同一件事 */
  | { status: 'preparing'; cell: MaterialCell }
  /**
   * 這一格**有**素材，但內容讀不成一份可以照著做的步驟。
   *
   * 與 `preparing` 分開是必要的：`preparing` 的意思是「還沒有人做這一格」，
   * 而這裡是「做了，但那一列壞了」。混成同一個答案，一列壞掉的素材就會躲進
   * 另外八十幾格還沒建的裡面，永遠不會有人去修它。
   */
  | { status: 'unusable'; cell: MaterialCell }
  /** 這個維度沒有被標記，本來就不需要干預 */
  | { status: 'not_flagged' }
  /** 維度、月齡或嚴重度認不得 —— 不是「還沒建」，是問錯了問題 */
  | { status: 'out_of_scope' };

export interface InterventionRequest {
  dimensionId: unknown;
  /** 孩子的**實足月齡**，見下方 `matchIntervention` 的說明。 */
  ageMonth: unknown;
  /** `'normal'` 是合法輸入，代表這個維度沒被標記。 */
  severity: unknown;
}

/** 月齡只收非負整數。`NaN` 硬算會落進 A 段（`NaN >= 12` 是 false）—— 一個看起來很正常的年齡段。 */
function isAgeMonth(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** 一個請求對應到 90 格中的哪一格。`cell` 只在 `status === 'ok'` 時存在。 */
export type CellResolution =
  | { status: 'ok'; cell: MaterialCell }
  | { status: 'not_flagged' }
  | { status: 'out_of_scope' };

/**
 * 這個請求問的是哪一格。**取素材之前唯一該問的問題。**
 *
 * **年齡段由 `ageMonth` 算出來，不由呼叫端指定**：哪一段是一條規則，散成兩處
 * 就會有兩種說法。適用範圍外的月齡跟著 `getT1AgeBand` 落到最近的一段，與孩子
 * 實際做過的那份題目一致 —— 否則一個 9 個月大的孩子會拿到一份有結果卻沒有
 * 下一步的報告。
 *
 * 用的是**實足月齡**（今天幾個月大）而不是測評月齡（篩查當下幾個月大）。這兩個
 * 值在孩子跨段後會分岔，而干預包是**現在要在家做的事**：訓練的難度必須配得上
 * 他今天做得到什麼，不是三個月前做得到什麼。報告本身仍照測評月齡讀（見
 * `AnalysisReport` 的 `reportChild`），兩者用不同的年齡是刻意的，因此畫面上
 * 必須把干預包對應的年齡段寫出來。
 */
export function resolveInterventionCell(request: InterventionRequest): CellResolution {
  // 沒被標記的維度不需要干預素材，這不是缺一格。先擋掉，才不會有人去補
  // 一格「正常」的素材 —— 那一格在 90 格裡根本不存在。
  if (request.severity === 'normal') return { status: 'not_flagged' };

  if (!isMaterialSeverity(request.severity) || !isAgeMonth(request.ageMonth)) {
    return { status: 'out_of_scope' };
  }

  const band = ageBandOf(request.ageMonth);
  const cell = findMaterialCell(request.dimensionId, band.id, request.severity);
  return cell ? { status: 'ok', cell } : { status: 'out_of_scope' };
}

/**
 * 依（維度，年齡段，嚴重度）取出那一格的素材。
 *
 * @param materials 候選素材。傳整份素材庫或只傳那一格查回來的一筆都可以 ——
 *   這個函式一律只認完全對上的那一筆，多餘的候選不會變成備胎。**查詢已經把
 *   範圍縮到一格時仍然要走這裡**：縮範圍的那一句 SQL 哪天被放寬（少一個
 *   `AND`、多一個 `OR`），比對這一關仍然擋得住，而放寬的那一句不會有人發現。
 */
export function matchIntervention(
  request: InterventionRequest,
  materials: readonly MaterialRecord[]
): InterventionOutcome {
  const resolved = resolveInterventionCell(request);
  if (resolved.status !== 'ok') return resolved;
  const cell = resolved.cell;

  // 完全相等，一個欄位都不能鬆。任何一種「最接近」的比法都會在這裡長出來。
  const found = materials.find(
    m =>
      m?.active === true &&
      m.dimensionId === cell.dimensionId &&
      m.ageBandId === cell.ageBandId &&
      m.severity === cell.severity
  );
  if (!found) return { status: 'preparing', cell };

  // 步驟的形狀在這裡**自己驗一次**，不假設呼叫端餵進來的東西一定經過
  // `materialFromRow`。少了這一關，一則 `null` 步驟會讓下面那行 map 拋出
  // TypeError —— 一個純函式對著合法型別的輸入炸掉，而錯誤訊息裡沒有任何
  // 一個字說得出是哪一格壞了。
  const steps = Array.isArray(found.steps) ? found.steps : [];
  if (steps.length === 0 || !steps.every(isUsableStep)) {
    return { status: 'unusable', cell };
  }

  return {
    status: 'ok',
    cell,
    pack: {
      title: found.title,
      // 順序就是家長照著做的順序，因此陣列順序是資料的一部分，原樣帶出去。
      steps: steps.map(s => ({ imageUrl: s.imageUrl, instruction: s.instruction })),
      videoUrl: found.videoUrl ?? null,
    },
  };
}

/**
 * 一則步驟要能照著做，圖與指令兩者缺一不可。
 *
 * **壞掉一則就整份不算數**（上面用的是 `every`，不是 `filter`）：挑掉壞的那幾則
 * 會端出一份少了中間某一步的訓練，而家長會把手上這幾步照著做完 —— 他沒有辦法
 * 知道自己拿到的是殘缺的版本。少一步的訓練比沒有訓練更糟。
 */
function isUsableStep(step: unknown): step is InterventionStep {
  if (!step || typeof step !== 'object') return false;
  const { imageUrl, instruction } = step as Partial<InterventionStep>;
  return typeof imageUrl === 'string' && imageUrl !== ''
    && typeof instruction === 'string' && instruction !== '';
}

/**
 * 某個維度該用哪一級嚴重度去配對 —— **最深的那一層成績說了算**。
 *
 * 深度評估比篩查精確，那正是家長付費買的東西：T3 做完之後還拿 T1 的判定去配
 * 干預包，等於把他買到的結論丟掉。反過來也一樣要成立 —— 深度評估說沒問題時
 * 就是沒問題，較淺的一層不會把它蓋回去。
 *
 * 回 `null` 代表這個維度沒有任何一筆讀得懂的成績。**不預設成正常，也不預設成
 * 需關注**：前者會讓該給的干預包消失，後者會給一個沒有依據的訓練。
 */
export function severityForIntervention(
  scores: readonly DimensionScore[] | null | undefined,
  dimensionId: string
): AssessmentStatus | null {
  const TIER_DEPTH: Record<string, number> = { T1: 1, T2: 2, T3: 3 };
  let deepest = 0;
  let status: AssessmentStatus | null = null;

  for (const s of scores ?? []) {
    if (!s || s.dimensionId !== dimensionId) continue;
    const depth = TIER_DEPTH[s.tierId] ?? 0;
    if (depth === 0 || depth < deepest) continue;
    if (!isAssessmentStatus(s.status)) continue;
    deepest = depth;
    status = s.status;
  }
  return status;
}

function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return value === 'normal' || value === 'borderline' || value === 'delay';
}

/** 型別匯出給呼叫端用，省得再從 `materialCells` 拉一次。 */
export type { MaterialCell, MaterialSeverity };
