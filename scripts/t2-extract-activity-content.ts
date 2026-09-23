/**
 * 活動內容（Keep 規格 K03）：從 `NEWT2/` 的兩份 docx 抽出手冊 300 張卡與模組一 20 支腳本，寫成
 *
 * - `src/t2/activityContent.ts`（常數，勿手改），以及
 * - `deploy/migrations/2026-09-23-activity-content.sql` 兩個標記之間的 UPDATE。
 *
 *   npx tsx scripts/t2-extract-activity-content.ts           # 寫檔
 *   npx tsx scripts/t2-extract-activity-content.ts --check   # 只比對，不寫；有差異就 exit 1
 *
 * 兩份 docx 是從客戶的 `NEWT2/T2视频_20260923.zip` 原封不動取出來的（zip 含 mp4，不進 git）。
 * 讀法與規則見 `scripts/t2/activityContent.ts`；`test/activityContent.test.ts` 在每次 `pnpm test`
 * 重跑同一件事。順手把標題與適齡跟 `src/t2/act300.ts` 比一次，不一致的印出來（只列不改）。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACT300 } from '../src/t2/act300';
import {
  ACTIVITY_CONTENT_MODULE,
  contentMismatches,
  emitActivityContentModule,
  readActivityContent,
} from './t2/activityContent';
import { CONTENT_MIGRATION, renderActivityContentSql, replaceContentBlock } from './t2/activityContentSql';
import { sameToolkitContent } from './t2/extract';

const root = process.cwd();
const check = process.argv.includes('--check');

const { cards, scripts, entries, sources } = readActivityContent(root);
const moduleText = emitActivityContentModule(entries, sources);
const moduleAbs = path.join(root, ACTIVITY_CONTENT_MODULE);
const migrationAbs = path.join(root, CONTENT_MIGRATION);
const migration = readFileSync(migrationAbs, 'utf8');
const nextMigration = replaceContentBlock(migration, renderActivityContentSql(entries));

console.log(`手冊 ${cards.length} 張卡、模組一腳本 ${scripts.length} 支`);
for (const s of sources) console.log(`  ${s.file}  sha256 ${s.sha256}`);

const mismatches = contentMismatches(cards, scripts, ACT300);
if (mismatches.length === 0) {
  console.log('✓ 標題與適齡與 src/t2/act300.ts 逐支一致');
} else {
  console.log(`△ 標題或適齡與 src/t2/act300.ts 不一致的有 ${mismatches.length} 處（只列，不改任何一邊）：`);
  for (const m of mismatches) {
    console.log(`  ${m.id} ${m.source === 'handbook' ? '手冊' : '腳本'} ${m.field === 'title' ? '標題' : '適齡'}：act300「${m.act300}」／這份「${m.found}」`);
  }
}

if (check) {
  let ok = true;
  if (!existsSync(moduleAbs) || !sameToolkitContent(readFileSync(moduleAbs, 'utf8'), moduleText)) {
    console.error(`✗ ${ACTIVITY_CONTENT_MODULE} 與重跑結果不同。重跑 \`npx tsx scripts/t2-extract-activity-content.ts\` 之後再提交。`);
    ok = false;
  }
  if (!sameToolkitContent(migration, nextMigration)) {
    console.error(`✗ ${CONTENT_MIGRATION} 的內容區段與重跑結果不同。重跑 \`npx tsx scripts/t2-extract-activity-content.ts\` 之後再提交。`);
    ok = false;
  }
  if (!ok) process.exit(1);
  console.log(`✓ ${ACTIVITY_CONTENT_MODULE} 與 ${CONTENT_MIGRATION} 的內容區段都與重跑結果一致`);
} else {
  writeFileSync(moduleAbs, moduleText, 'utf8');
  writeFileSync(migrationAbs, nextMigration, 'utf8');
  console.log(`✓ 寫出 ${ACTIVITY_CONTENT_MODULE}（${entries.length} 支）與 ${CONTENT_MIGRATION} 的內容區段`);
}
