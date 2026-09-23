/**
 * 一支活動的**分解步驟**怎麼讀 —— 純函式，不碰 React、不碰資料庫。
 *
 * 原本住在 `materialCells.ts`，素材庫（一格一份的九十格）與活動庫共用；素材庫
 * 2026-09 退場（ADR-0005、#63）後只剩活動庫一個呼叫端，規則原封不動搬過來。
 * 這幾條當初是為了家長端那一頁定的，跟哪個庫在用它無關：
 *
 * - **文字步驟是底，圖選填**（ADR-0008，2026-09-23 取代 ADR-0003／0005 的「每則一張圖配
 *   一句指令，兩者都必填」）：指令必填；圖可以沒有（空字串、只有空白、`null` 都算沒有），
 *   存成 `null`。客戶的手冊「怎么玩」只有文字，照舊規則 300 支沒有一支存得進步驟。
 * - **有圖時照舊驗網址**：只收 `https://` 或站內路徑（見 `assetUrl.ts`）。這個 repo 沒有檔案
 *   上傳能力，圖是外部連結或站內路徑。
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
 * 讀一串分解步驟。**零步是合法的**：活動庫的種子是零步，內容團隊可以先填 `targetMonth`
 * 再慢慢補步驟，零步必須存得下去。
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
    const n = index + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `第 ${n} 步的格式不对。` };
    }
    const { imageUrl: rawImage, instruction: rawInstruction } = item as Record<string, unknown>;
    const instruction = readText(rawInstruction, MAX_INSTRUCTION);
    if (!instruction) {
      return { ok: false, error: `第 ${n} 步要填写指令文字。` };
    }
    // 圖選填（ADR-0008）。不是字串的東西（數字、物件）不當成「沒有圖」放行 ——
    // 那是送錯了東西，不是沒填。
    if (rawImage !== undefined && rawImage !== null && typeof rawImage !== 'string') {
      return { ok: false, error: `第 ${n} 步的分解图网址必须是 https:// 开头，或站内的 / 路径。` };
    }
    const imageUrl = readText(rawImage, MAX_URL);
    if (imageUrl !== null && !isAllowedAssetUrl(imageUrl)) {
      return { ok: false, error: `第 ${n} 步的分解图网址必须是 https:// 开头，或站内的 / 路径。` };
    }
    steps.push({ imageUrl, instruction });
  }
  return { ok: true, steps };
}
