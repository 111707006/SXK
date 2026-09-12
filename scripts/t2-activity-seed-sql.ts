/**
 * 把活動種子印進遷移檔：`deploy/migrations/2026-09-11-activities.sql` 兩個標記之間的 INSERT。
 *
 *   npx tsx scripts/t2-activity-seed-sql.ts           # 重寫種子區段
 *   npx tsx scripts/t2-activity-seed-sql.ts --check   # 只比對，不寫；有差異就 exit 1
 *
 * 來源是 `src/t2/activitySeed.ts` 的 `ACTIVITY_SEED`（它又算自 `act300.ts`）。
 * 建表與說明是手寫的，這支只碰標記之間那一段。`test/activitySeed.test.ts` 會重印一次比對。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { ACTIVITIES_MIGRATION, renderActivitySeedSql, replaceSeedBlock } from './t2/activitySql';
import { sameToolkitContent } from './t2/extract';

const root = process.cwd();
const check = process.argv.includes('--check');
const abs = path.join(root, ACTIVITIES_MIGRATION);

const current = readFileSync(abs, 'utf8');
const next = replaceSeedBlock(current, renderActivitySeedSql(ACTIVITY_SEED));

if (check) {
  if (!sameToolkitContent(current, next)) {
    console.error(`✗ ${ACTIVITIES_MIGRATION} 的種子區段與 ACTIVITY_SEED 不同。重跑 \`npx tsx scripts/t2-activity-seed-sql.ts\` 之後再提交。`);
    process.exit(1);
  }
  console.log(`✓ ${ACTIVITIES_MIGRATION} 的種子區段與 ACTIVITY_SEED 一致`);
} else {
  writeFileSync(abs, next, 'utf8');
  console.log(`✓ 寫入 ${ACTIVITIES_MIGRATION} 的種子區段（${ACTIVITY_SEED.length} 支）`);
}
