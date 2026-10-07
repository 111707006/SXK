/**
 * 完整版題庫（T2 v3 題庫規格 §3.2）：`NEWT2/森心康评估工具包_完整版_20260923.zip` → `src/t2/kitv3/<slug>.ts`。
 *
 *   npx tsx scripts/t2-extract-kitv3.ts           # 寫檔
 *   npx tsx scripts/t2-extract-kitv3.ts --check   # 只比對，不寫；有差異就 exit 1
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderKitV3Files } from './t2/kitv3';
import { V3_RECIPES } from './t2/kitv3-recipes';
import { sameToolkitContent } from './t2/extract';

const root = process.cwd();
const files = renderKitV3Files(root, V3_RECIPES);
const check = process.argv.includes('--check');
let bad = 0;
for (const [rel, text] of files) {
  const abs = path.join(root, rel);
  if (check) {
    if (!existsSync(abs) || !sameToolkitContent(readFileSync(abs, 'utf8'), text)) {
      console.error(`✗ ${rel} 與重跑結果不同`);
      bad++;
    }
  } else {
    writeFileSync(abs, text);
  }
}
if (check && bad > 0) {
  console.error('重跑 `npx tsx scripts/t2-extract-kitv3.ts` 之後再提交。');
  process.exit(1);
}
console.log(`✓ ${check ? '比對' : '寫出'} ${files.size} 支`);
