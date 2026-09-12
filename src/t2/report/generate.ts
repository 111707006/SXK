/**
 * 「呼叫模型 → 驗證 → 不過就退模板」這一段（規格 v2 §6.4，#59）。
 *
 * 【為什麼不寫在 `server.ts` 裡】
 * 它是一條有三個出口的決策（模型過了／模型寫了但沒過／三段全挂），而三個出口在資料庫裡
 * 長得不一樣（`is_ai_generated`、`ai_engine`）。埋在端點裡的話，「家長為什麼拿到模板報告」
 * 這個問題只能靠讀端點的 60 行程式碼回答，而那 60 行同時還在處理登入、月齡、存表。
 *
 * 【這一層不知道有幾個引擎】
 * `engine` 是傳進來的：正式站傳 `generateReportJSON`（Qwen → Doubao → DashScope 三段備援，
 * `server.ts`），測試傳一個當場回答的函式。備援幾段、逾時多久是呼叫端的事；這裡只認
 * 「它回了一個東西」與「它整個丟出例外」兩種結果。
 *
 * 【為什麼不重試】
 * 驗證不過的時候，退模板而不是換個引擎再寫一次。§6.4 是「任一項不過，整份丟」——
 * 而模型寫錯的時候，錯的通常不只那一處（`prose.ts` 檔頭）。重試會把一次生成變成不確定
 * 要等多久的事，家長在等的那個畫面上；模板是一份確定沒有問題的報告，代價是它比較平。
 * 引擎自己的備援是另一回事：那是「這台機器沒回應」，重試的是同一份提示。
 *
 * 【`aiEngine` 的三種值】
 * - 模型過了：引擎代號原樣（`'qwen-3-5-plus-260215'`）。
 * - 模型寫了、沒過驗證：`'template:<引擎代號>'`。排查時要知道是哪一台寫壞的。
 * - 三段全挂：`'template:all_engines_failed'`。
 * 混成一個 `'fallback_template'` 就查不出是哪一種 —— 前者要修提示，後者要修金鑰或額度。
 */

import { validateProse } from './prose';
import type { T2ReportInput, T2ReportProse } from './prose';
import { buildProsePrompt } from './prompt';
import { templateProse } from './template';

/** 呼叫模型：系統提示、使用者提示 → 剛 `JSON.parse` 出來的東西與引擎代號。整個失敗就丟例外。 */
export type ProseEngine = (system: string, user: string) => Promise<{ report: unknown; aiEngine: string }>;

export interface ProseOutcome {
  prose: T2ReportProse;
  isAiGenerated: boolean;
  aiEngine: string;
  /** 退模板的原因，給日誌與測試看，**不給家長看**，也不存進資料庫。 */
  errors: string[];
}

/** 三段備援全部失敗時的 `ai_engine`。 */
export const ALL_ENGINES_FAILED = 'template:all_engines_failed';

/** 某個引擎寫了、但沒過驗證器時的 `ai_engine`。 */
export function templateEngineLabel(aiEngine: string): string {
  return `template:${aiEngine}`;
}

/**
 * 一份報告的文字（§6.4）。**永遠回得出一份 prose** —— 這一層沒有「產不出來」這個出口，
 * 家長按了「生成」就會拿到一份報告，差別只在它是模型寫的還是模板組的。
 */
export async function generateProse(input: T2ReportInput, engine: ProseEngine): Promise<ProseOutcome> {
  const { system, user } = buildProsePrompt(input);

  let report: unknown;
  let aiEngine: string;
  try {
    ({ report, aiEngine } = await engine(system, user));
  } catch (err: any) {
    return {
      prose: templateProse(input),
      isAiGenerated: false,
      aiEngine: ALL_ENGINES_FAILED,
      errors: [`所有引擎皆失敗：${err?.message ?? err}`],
    };
  }

  const checked = validateProse(report, input);
  if (checked.ok) return { prose: checked.prose, isAiGenerated: true, aiEngine, errors: [] };

  return {
    prose: templateProse(input),
    isAiGenerated: false,
    aiEngine: templateEngineLabel(aiEngine),
    errors: checked.errors,
  };
}
