/**
 * 客戶《T2 量表推荐规则规格书 v1.0》附錄 A 的規則設定（JSON）→ `src/t2/recommend/config.ts`（T2 v3 推薦規格 §3）。
 *
 * 【為什麼抽，不手抄】
 * 附錄 A 是客戶寫給 IT「可直接载入」的設定：31 支工具的月齡、填寫人、分鐘、主次維度、組、層，組上限，六種診斷檔案，
 * 診斷適用月齡，22 條關鍵題。手抄一格錯了不會有型別錯誤（月齡 16 抄成 18，M-CHAT 就在 16、17 個月推不出來）。
 * 照題庫的規矩：腳本抽、常數不手改、測試重跑比對（`test/t2RecommendConfig.test.ts`）。
 *
 * 【讀法】
 * 段落「附录 A　规则配置（JSON）」之後，從第一個以「{」開頭的段落起、到最後一個段落，接成一串（docx 會把一行 JSON
 * 斷在空白處，接的時候補一個空格）再 `JSON.parse`。讀不成 JSON、少了任何一個鍵就丟例外。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readDocxBlocks } from './docx';

export const RECOMMEND_DOCX = 'docs/reference/client-mockups/森心康_T2量表推荐规则规格书_v1.0-2026-10-06.docx';
export const RECOMMEND_CONFIG_MODULE = 'src/t2/recommend/config.ts';

const HEADING = '附录 A　规则配置（JSON）';

export function readRecommendConfig(root: string): { config: unknown; sha256: string } {
  const buf = readFileSync(path.join(root, RECOMMEND_DOCX));
  const blocks = readDocxBlocks(buf);
  const start = blocks.findIndex(b => b.kind === 'p' && b.text.trim() === HEADING);
  if (start < 0) throw new Error(`${RECOMMEND_DOCX}：找不到「${HEADING}」`);
  const paras = blocks.slice(start + 1).flatMap(b => (b.kind === 'p' ? [b.text] : []));
  const first = paras.findIndex(t => t.trim().startsWith('{'));
  if (first < 0) throw new Error(`${RECOMMEND_DOCX}：附錄 A 底下沒有 JSON`);
  const text = paras.slice(first).map(t => t.trim()).filter(Boolean).join(' ');
  let config: any;
  try {
    config = JSON.parse(text);
  } catch (err: any) {
    throw new Error(`${RECOMMEND_DOCX}：附錄 A 讀不成 JSON（${err.message}）`);
  }
  for (const key of ['tools', 'groupMax', 'dx', 'dxMinAge', 'keyItems']) {
    if (!(key in config)) throw new Error(`${RECOMMEND_DOCX}：附錄 A 少了「${key}」`);
  }
  return { config, sha256: createHash('sha256').update(buf).digest('hex') };
}

export function emitRecommendConfigModule(config: unknown, sha256: string): string {
  return [
    '/**',
    ' * 客戶《T2 量表推荐规则规格书 v1.0》附錄 A 的規則設定，原樣（T2 v3 推薦規格 §3）。',
    ' *',
    ' * 由 `scripts/t2-extract-recommend-config.ts` 從下面這份 docx 產生，**請勿手改** —— `test/t2RecommendConfig.test.ts`',
    ' * 會重跑比對。客戶改了規格書就換檔重抽。',
    ` *   ${RECOMMEND_DOCX}（sha256 ${sha256.slice(0, 12)}…）`,
    ' */',
    '',
    "import type { RecommendConfig } from './types';",
    '',
    `export const RECOMMEND_CONFIG: RecommendConfig = ${JSON.stringify(config, null, 2)};`,
    '',
  ].join('\n');
}

export function renderRecommendConfigModule(root: string): string {
  const { config, sha256 } = readRecommendConfig(root);
  return emitRecommendConfigModule(config, sha256);
}
