/**
 * 抽題：從工具包 zip 把 22 支題庫寫成 `src/t2/toolkit/<id>.ts`。
 *
 *   npx tsx scripts/t2-extract-toolkit.ts           # 寫檔
 *   npx tsx scripts/t2-extract-toolkit.ts --check   # 只比對，不寫；有差異就 exit 1
 *
 * 來源：`NEWT2/森心康评估工具包_20260908.zip`（2026-09-08 森心康評估工具包，22 支 HTML）。
 * 做法：每支 HTML 只取 `<script>` 開頭的純資料宣告在沙箱求值、分段函式用正則讀；
 * **HTML 一行都不執行**（`scripts/t2/literals.ts`、`scripts/t2/kit.ts`）。
 *
 * 產出的檔案**不要手改**。要改題目或分段，改的是工具包（客戶的東西），然後重跑這支。
 * `test/toolkit.structure.test.ts` 會重跑一次比對，改了沒重跑會紅。
 *
 * 紙本版（09-10 zip）是題目文字的權威；跟紙本逐題比對的是另一支：
 * `scripts/t2-diff-paper.ts`。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TOOLKIT_DIR, renderToolkitFiles, sameToolkitContent } from './t2/extract';

const root = process.cwd();
const check = process.argv.includes('--check');

const files = renderToolkitFiles(root);

if (check) {
  const bad: string[] = [];
  for (const [rel, content] of files) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) bad.push(`${rel}：不存在`);
    else if (!sameToolkitContent(readFileSync(abs, 'utf8'), content)) bad.push(`${rel}：與重跑結果不同`);
  }
  if (bad.length) {
    console.error(`✗ ${bad.length} 份與 zip 重跑的結果不一致：`);
    for (const b of bad) console.error(`  - ${b}`);
    console.error('  重跑 `npx tsx scripts/t2-extract-toolkit.ts` 之後再提交。');
    process.exit(1);
  }
  console.log(`✓ ${files.size} 份與 zip 重跑的結果逐位元一致`);
} else {
  mkdirSync(path.join(root, TOOLKIT_DIR), { recursive: true });
  for (const [rel, content] of files) writeFileSync(path.join(root, rel), content, 'utf8');
  console.log(`✓ 寫出 ${files.size} 份到 ${TOOLKIT_DIR}/`);
}
