/**
 * 活動種子的原文：從舊原型的 `files/sxk_t2_activities.js` 把 `ACT300` 寫成 `src/t2/act300.ts`。
 *
 *   npx tsx scripts/t2-extract-act300.ts           # 寫檔
 *   npx tsx scripts/t2-extract-act300.ts --check   # 只比對，不寫；有差異就 exit 1
 *
 * 做法與抽題同一套：只收純資料宣告在沙箱求值，**JS 一行都不執行**（`scripts/t2/literals.ts`）。
 * 產出的檔案**不要手改** —— `test/activitySeed.test.ts` 會重跑一次比對。
 * 解析適齡、推模組與維度是 `src/t2/activitySeed.ts` 的事，不在這裡。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACT300_MODULE, renderAct300Module } from './t2/act300';
import { sameToolkitContent } from './t2/extract';

const root = process.cwd();
const check = process.argv.includes('--check');

const content = renderAct300Module(root);
const abs = path.join(root, ACT300_MODULE);

if (check) {
  if (!existsSync(abs)) {
    console.error(`✗ ${ACT300_MODULE} 不存在。先跑 \`npx tsx scripts/t2-extract-act300.ts\`。`);
    process.exit(1);
  }
  if (!sameToolkitContent(readFileSync(abs, 'utf8'), content)) {
    console.error(`✗ ${ACT300_MODULE} 與重跑結果不同。重跑 \`npx tsx scripts/t2-extract-act300.ts\` 之後再提交。`);
    process.exit(1);
  }
  console.log(`✓ ${ACT300_MODULE} 與重跑結果逐位元一致`);
} else {
  writeFileSync(abs, content, 'utf8');
  console.log(`✓ 寫出 ${ACT300_MODULE}`);
}
