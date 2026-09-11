import type { AssessmentStatus, DimensionScore } from '../types';

/**
 * 後台讀 `report_history` 的唯一關口（ADR-0007）。
 *
 * 【為什麼是一支共用的函式】
 * 後台的家長詳情與列印頁看的都是「最近一份報告」。兩個畫面各寫一次
 * `sort(...)[0]` 的話，有一天其中一個會被改成挑別的一份 —— 客服在抽屜裡看到的
 * 與他印出來交給家長的就成了兩份不同的報告，而兩邊都說自己是「最近一份」。
 *
 * 【為什麼要把形狀收乾淨】
 * `user_data.report_history` 是**家長端存上去、伺服器原封不動收下**的一串 JSON。
 * 欄位可以少、型別可以不對（舊版客戶端、寫到一半斷線、手動改過的列）。TypeScript
 * 說它是 `AssessmentRecord[]`，那只是宣告，不是事實。
 *
 * 而後台沒有 error boundary 包著家長分頁：`ReportBody` 在 `scores.filter(...)` 上
 * 撞一個 `undefined` 會讓 React 一路 unwind 到根節點，**整個管理中心變白畫面**，
 * 不只是那一個抽屜。家長掃碼帶走的那一頁（`server.ts` 的 `/r/:token`）早就是
 * 這樣防的（`Array.isArray(record.scores) ? record.scores : []`），後台不該是例外。
 *
 * 【修，不是拒】
 * 除了「根本沒有 aiReport」（那代表這筆只是篩查紀錄，不是報告）之外，一律盡量
 * 修好後照樣顯示 —— 少一個欄位就讓那一塊不出現，不要因為一個壞掉的欄位就把
 * 整份報告藏起來。唯一不修的是那四個儀表數字：**缺了就回 `null`，不補 0**。
 * 補出來的 0 在畫面上是四個歸零的儀表，而家長會以為那是他孩子的分數。
 */

/** 四個儀表的數字。四個都在才算數。 */
export interface CriticalMetrics {
  neuralPlasticity: number;
  sensoryIntegration: number;
  familyEnvironmentScore: number;
  motorControlIndex: number;
}

/** 收乾淨之後的報告 —— `ReportBody` 只吃這個形狀，不再碰原始 JSON。 */
export interface RenderableReport {
  /** 報告編號由它算出。空字串代表這筆沒有可用的 id，編號那一行整行不出現。 */
  id: string;
  createdAt: string;
  isAiGenerated?: boolean;
  /**
   * 報告內文裡稱呼孩子的那個名字。
   *
   * 只需要名字，不需要整個 `Child` —— 月齡與性別寫在抽屜的標頭，由後台自己的
   * 資料供應，報告本體用不到。
   */
  childName: string;
  scores: DimensionScore[];
  aiReport: {
    summary: string;
    neuralPathwayAnalysis: string;
    rehabSuggestions: string[];
    homeGuidance: string[];
    prognosisPrediction: string;
    /** `null` = 這份報告沒存下這四個數字，儀表那一區整塊不出現。 */
    criticalMetrics: CriticalMetrics | null;
  };
}

const VALID_STATUSES: ReadonlyArray<AssessmentStatus> = ['normal', 'borderline', 'delay'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 認不得的判定收成 `normal`。
 *
 * 不是因為綠燈比較安全，而是因為**全站對未知判定只能有一種說法**：
 * `adminView.statusLabel` 把未知顯示成「正常」，`adminStore.flaggedFrom` 把未知
 * 當成沒被標記。這裡再發明第四種處置，同一筆壞資料在列表、詳情與報告裡就會有
 * 三種樣子，而那比任何一種單一處置都難查。
 */
function asStatus(value: unknown): AssessmentStatus {
  return VALID_STATUSES.includes(value as AssessmentStatus) ? (value as AssessmentStatus) : 'normal';
}

/** 形狀不對的成績直接丟掉 —— 一筆沒有分數的成績在報告裡畫不出任何東西。 */
function toScore(value: unknown): DimensionScore | null {
  if (!isObject(value)) return null;
  const score = num(value.score);
  const maxScore = num(value.maxScore);
  if (score === null || maxScore === null) return null;
  const dimensionId = str(value.dimensionId);
  if (!dimensionId) return null;

  return {
    dimensionId,
    dimensionName: str(value.dimensionName) || dimensionId,
    tierId: value.tierId === 'T2' || value.tierId === 'T3' ? value.tierId : 'T1',
    score,
    maxScore,
    status: asStatus(value.status),
    completedAt: str(value.completedAt),
    ...(num(value.assessedAgeMonth) !== null ? { assessedAgeMonth: value.assessedAgeMonth as number } : {}),
  };
}

function toMetrics(value: unknown): CriticalMetrics | null {
  if (!isObject(value)) return null;
  const neuralPlasticity = num(value.neuralPlasticity);
  const sensoryIntegration = num(value.sensoryIntegration);
  const familyEnvironmentScore = num(value.familyEnvironmentScore);
  const motorControlIndex = num(value.motorControlIndex);
  if (
    neuralPlasticity === null ||
    sensoryIntegration === null ||
    familyEnvironmentScore === null ||
    motorControlIndex === null
  ) {
    return null;
  }
  return { neuralPlasticity, sensoryIntegration, familyEnvironmentScore, motorControlIndex };
}

/**
 * 一筆原始紀錄收成可以渲染的報告，不是報告就回 `null`。
 *
 * 兩種「不是報告」：沒有 `aiReport`（只是一次篩查紀錄），或它是深度評估
 * （T2/T3）—— 後台目前只放篩查報告，深度評估的版面（`SpecializedReportView`）
 * 不在 ADR-0007 的範圍內。沒標 `type` 的舊紀錄一律當成篩查報告，因為深度評估
 * 是後來才有的。
 */
function toRenderable(value: unknown): RenderableReport | null {
  if (!isObject(value)) return null;
  if (value.type === 'T2_T3_SPECIALIZED') return null;
  if (!isObject(value.aiReport)) return null;

  const ai = value.aiReport;
  const child = isObject(value.child) ? value.child : null;
  // 名字讀不出來時用一個不指名的說法。空字串會讓內文變成「 的整体发展节奏…」，
  // 而編一個名字放進一份健康報告更糟。
  const childName = str(child?.name).trim() || '这个孩子';

  return {
    id: str(value.id),
    createdAt: str(value.createdAt),
    isAiGenerated: typeof value.isAiGenerated === 'boolean' ? value.isAiGenerated : undefined,
    childName,
    scores: Array.isArray(value.scores)
      ? value.scores.map(toScore).filter((s): s is DimensionScore => s !== null)
      : [],
    aiReport: {
      summary: str(ai.summary),
      neuralPathwayAnalysis: str(ai.neuralPathwayAnalysis),
      rehabSuggestions: strings(ai.rehabSuggestions),
      homeGuidance: strings(ai.homeGuidance),
      prognosisPrediction: str(ai.prognosisPrediction),
      criticalMetrics: toMetrics(ai.criticalMetrics),
    },
  };
}

/**
 * 這位家長最近一份篩查報告，形狀已經收乾淨。沒有任何一份時回 `null`。
 *
 * 參數型別是 `unknown`：呼叫端拿到的宣告是 `AssessmentRecord[]`，但那只是宣告 ——
 * 寫成 `unknown` 才擋得住「型別說它一定有，所以不用檢查」這個念頭。
 */
export function latestReportOf(history: unknown): RenderableReport | null {
  if (!Array.isArray(history)) return null;

  let best: RenderableReport | null = null;
  for (const raw of history) {
    const report = toRenderable(raw);
    if (!report) continue;
    // 陣列的順序不保證：家長端是往後 push，但資料庫裡那串 JSON 被改寫過就不一定了。
    if (!best || report.createdAt > best.createdAt) best = report;
  }
  return best;
}

/**
 * 這位家長有幾份**篩查報告**。
 *
 * 不是 `reportHistory.length` —— 那會把深度評估與沒生成過報告的篩查紀錄一起算
 * 進去。刪除確認框正是那個最不該報錯數字的地方：它的工作就是說清楚接下來會
 * 消失什麼。
 */
export function screeningReportCount(history: unknown): number {
  if (!Array.isArray(history)) return 0;
  return history.reduce((count, raw) => (toRenderable(raw) ? count + 1 : count), 0);
}
