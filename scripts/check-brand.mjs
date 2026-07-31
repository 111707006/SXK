/**
 * 建置後檢查：專案 B 的產出物不得帶有專案 A 的品牌設定。
 *
 * 用法（要先建置）：
 *   VITE_APP_MODE=t1only pnpm build && node scripts/check-brand.mjs t1only
 *   VITE_APP_MODE=full   pnpm build && node scripts/check-brand.mjs full
 *
 * 【為什麼需要這個檢查】
 * `productConfig.ts` 同時定義兩個 profile。2026-07-31 一度寫成 `PROFILES[MODE]`
 * 的執行期查表 —— Rollup 無法證明另一個 profile 用不到，於是**兩份都被打包**，
 * 專案 B 的產出物裡就出現了「森心康 - 儿童发育评估系统」這類 A 的品牌字串。
 * 畫面上看不到，但檢視原始碼就看得到，而 B 是交付給合作公司的。
 *
 * 這個檢查釘住的是**那個具體的回歸**：A 的品牌區塊有沒有漏進 B。
 * 它刻意**不是**「B 的產出物不得出現『森心康』」這種一刀切 —— 那條會被
 * `data.ts` 裡 A 專屬的量表名稱與商城文案永遠絆倒，變成沒人看的紅燈。
 * 那一類殘留另外記在 `實作計畫.md`，是已知且已文件化的限制。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2];
if (mode !== 'full' && mode !== 't1only') {
  console.error('用法: node scripts/check-brand.mjs <full|t1only>');
  process.exit(2);
}

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');

/** 只看主 chunk —— A 專屬的 lazy chunk 在 B 下永遠不會被載入。 */
const mainChunk = readdirSync(ASSETS_DIR).find(f => /^index-.*\.js$/.test(f));
if (!mainChunk) {
  console.error(`找不到主 chunk，請先建置。（找過 ${ASSETS_DIR}）`);
  process.exit(2);
}
const js = readFileSync(join(ASSETS_DIR, mainChunk), 'utf8');

/** 專案 A 的品牌設定值，逐字取自 productConfig.ts 的 full profile。 */
const PROJECT_A_BRAND = [
  '森心康 - 儿童发育评估系统',
  '森心康儿童发展评估',
  '森心康 AI 神经网络分层评估报告生成器',
  '森心康（SenXinKang）技术实验室',
  '© 2026 森心康（SenXinKang）神经网络科学技术实验室',
  '森心康儿童康复品牌康复质量管理部负责人，',
];

/** 專案 B 的中性設定值，用來確認 B 真的建到了自己那一份。 */
const PROJECT_B_BRAND = ['儿童发育评估系统', 'AI 神经网络分层评估报告生成器', '本系统运营方'];

const problems = [];

if (mode === 't1only') {
  for (const s of PROJECT_A_BRAND) {
    if (js.includes(s)) problems.push(`B 的主 chunk 含有專案 A 的品牌字串：「${s}」`);
  }
  for (const s of PROJECT_B_BRAND) {
    if (!js.includes(s)) problems.push(`B 的主 chunk 缺少自己的品牌字串：「${s}」`);
  }
} else {
  // 反向確認：別在拿掉 B 的品牌時把 A 的一起弄丟了。
  for (const s of PROJECT_A_BRAND) {
    if (!js.includes(s)) problems.push(`A 的主 chunk 缺少品牌字串：「${s}」`);
  }
}

if (problems.length) {
  console.error(`\n✗ 品牌檢查失敗（模式 ${mode}，${mainChunk}）：`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ 品牌檢查通過（模式 ${mode}，${mainChunk}）`);
