/**
 * 量表推薦規則設定（T2 v3 推薦規格 §3）：客戶規格書附錄 A → `src/t2/recommend/config.ts`。
 *
 *   npx tsx scripts/t2-extract-recommend-config.ts           # 寫檔
 *   npx tsx scripts/t2-extract-recommend-config.ts --check   # 只比對，不寫；有差異就 exit 1
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RECOMMEND_CONFIG_MODULE, renderRecommendConfigModule } from './t2/recommendConfig';
import { sameToolkitContent } from './t2/extract';

const root = process.cwd();
const abs = path.join(root, RECOMMEND_CONFIG_MODULE);
const text = renderRecommendConfigModule(root);

if (process.argv.includes('--check')) {
  if (!existsSync(abs) || !sameToolkitContent(readFileSync(abs, 'utf8'), text)) {
    console.error(`✗ ${RECOMMEND_CONFIG_MODULE} 與重跑結果不同。重跑 \`npx tsx scripts/t2-extract-recommend-config.ts\` 之後再提交。`);
    process.exit(1);
  }
  console.log(`✓ ${RECOMMEND_CONFIG_MODULE} 與重跑結果一致`);
} else {
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  console.log(`✓ 寫出 ${RECOMMEND_CONFIG_MODULE}`);
}
