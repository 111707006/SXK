/**
 * 一支活動的**分解步驟**怎麼讀 —— 純函式，不碰 React、不碰資料庫。
 *
 * 原本住在 `materialCells.ts`，素材庫（一格一份的九十格）與活動庫共用；素材庫
 * 2026-09 退場（ADR-0005、#63）後只剩活動庫一個呼叫端，規則原封不動搬過來。
 * 這幾條當初是為了家長端那一頁定的，跟哪個庫在用它無關：
 *
 * - **圖文為主、影片為輔**：每一則步驟一張圖配一句指令，兩者都是必填。這個 repo
 *   沒有檔案上傳能力，圖是外部連結或站內路徑（見 `assetUrl.ts`）。
 * - **順序就是家長照著做的順序**，陣列順序是資料的一部分，不重新排。
 * - **超過上限整筆拒收**，不默默截斷。
 */
import type { ActivityStep } from '../t2/types';
import { isAllowedAssetUrl } from './assetUrl';

const MAX_INSTRUCTION = 500;
const MAX_URL = 512;

/**
 * 一支活動最多幾則步驟。**匯出給編輯畫面用**，兩邊才會說同一件事 ——
 * 前端不知道上限的話，使用者加到第 21 步才被整筆退回，而前 20 步是他剛剛
 * 一句一句打出來的。
 */
export const MAX_STEPS = 20;

export type StepsResult = { ok: true; steps: ActivityStep[] } | { ok: false; error: string };

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * 讀一串分解步驟。**零步是合法的**：活動庫的 300 支種子全部是零步，內容團隊是
 * 先填 `targetMonth` 再慢慢補圖文的，零步必須存得下去。
 */
export function readSteps(raw: unknown): StepsResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: '分解步骤必须是一个阵列。' };
  }
  // 超過上限**整筆拒收**，不默默截斷。截斷的話，使用者按下儲存後畫面上還有
  // 第 21 步，而資料庫裡沒有 —— 而步驟是一句一句寫出來的，被吃掉的那幾句
  // 要等到家長照著做、發現最後幾步不見了才會有人知道。
  if (raw.length > MAX_STEPS) {
    return { ok: false, error: `一支活动最多 ${MAX_STEPS} 则步骤，目前有 ${raw.length} 则。` };
  }
  const steps: ActivityStep[] = [];
  for (const [index, item] of raw.entries()) {
    const imageUrl = readText((item as any)?.imageUrl, MAX_URL);
    const instruction = readText((item as any)?.instruction, MAX_INSTRUCTION);
    if (!imageUrl || !instruction) {
      return { ok: false, error: `第 ${index + 1} 步要同时填写分解图与指令文字。` };
    }
    if (!isAllowedAssetUrl(imageUrl)) {
      return { ok: false, error: `第 ${index + 1} 步的分解图网址必须是 https:// 开头，或站内的 / 路径。` };
    }
    steps.push({ imageUrl, instruction });
  }
  return { ok: true, steps };
}
