/**
 * 示範片與封面（Keep 規格 K05、§6）：從客戶的 zip 挑出能上的片，寫出
 *
 * - `media/activities/A0xx.mp4`（原封不動）與 `A0xx.jpg`（封面，960×540）—— **不進 git**，
 *   部署時傳到正式站主機的 `/var/www/sxk/media/activities/`；
 * - `src/t2/activityMedia.ts`（清單常數，勿手改），以及
 * - `deploy/migrations/2026-09-24-activity-media.sql` 兩個標記之間的 UPDATE。
 *
 *   npx tsx scripts/t2-prepare-media.ts                              # 寫檔
 *   npx tsx scripts/t2-prepare-media.ts --check                      # 只比對，不寫；有差異就 exit 1
 *   npx tsx scripts/t2-prepare-media.ts --zip <zip> --out <媒體目錄>  # 兩個路徑都可以換
 *
 * `--zip` 預設 `NEWT2/T2视频_20260923.zip`（27 MB，不進 git，只在有它的機器上跑得了）；
 * `--out` 預設 `media/`，片子寫到它底下的 `activities/`（與 `server.ts` 的 `MEDIA_DIR` 同一層）。
 * 要有 ffmpeg 與 ffprobe 在 PATH 上：片長由 ffprobe 讀、封面由 ffmpeg 在固定時間點抽一格。
 *
 * `--check` 重挑一次、重讀片長，比對清單與遷移；`media/activities/` 在的話，順便逐支驗 sha256、
 * 封面在不在、有沒有多出清單以外的檔 —— 傳上主機之前跑一次，傳的就是清單上那幾支。
 * 挑片的規則（007 用 sha256 擋、008 看檔名註記）見 `scripts/t2/activityMedia.ts`。
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ACTIVITY_MEDIA_MODULE,
  MEDIA_SUBDIR,
  MEDIA_ZIP,
  emitActivityMediaModule,
  mediaEntryOf,
  posterAtOf,
  selectClips,
} from './t2/activityMedia';
import { MEDIA_MIGRATION, renderActivityMediaSql, replaceMediaBlock } from './t2/activityMediaSql';
import { sameToolkitContent } from './t2/extract';
import { readZip } from './t2/zip';

const root = process.cwd();
const args = process.argv.slice(2);
const check = args.includes('--check');

function option(name: string, fallback: string): string {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`✗ ${name} 後面要接一個路徑`);
    process.exit(2);
  }
  return value;
}

const zipPath = path.resolve(root, option('--zip', MEDIA_ZIP));
const outDir = path.resolve(root, option('--out', 'media'));
const clipDir = path.join(outDir, MEDIA_SUBDIR);

function run(cmd: string, cmdArgs: string[]): string {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  if (r.error) {
    const missing = (r.error as NodeJS.ErrnoException).code === 'ENOENT';
    throw new Error(missing ? `找不到 ${cmd}：要裝 ffmpeg，並讓 ${cmd} 在 PATH 上` : `${cmd} 起不來：${r.error.message}`);
  }
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} 失敗：${r.stderr.trim()}`);
  return r.stdout;
}

function durationOf(file: string): number {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim());
}

/**
 * 在 `at` 秒抽一格存成 JPG。`-ss` 放在 `-i` 前面（ffmpeg 2.1 起轉檔時是精確到格的），
 * bitexact 拿掉 JPG 裡的編碼器版本字串，同一版 ffmpeg 重跑位元組相同。
 */
function writePoster(mp4: string, jpg: string, at: number): void {
  run('ffmpeg', [
    '-v', 'error', '-y', '-ss', String(at), '-i', mp4,
    '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4',
    '-map_metadata', '-1', '-flags', '+bitexact', '-fflags', '+bitexact',
    jpg,
  ]);
  if (!existsSync(jpg) || statSync(jpg).size === 0) throw new Error(`${jpg} 沒有寫出來（${at} 秒超過片長？）`);
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

if (!existsSync(zipPath)) {
  console.error(`✗ 找不到 ${zipPath}`);
  console.error('  這個 zip（27 MB、含 mp4）不進 git，只在有它的機器上跑得了。用 --zip 指到它。');
  process.exit(2);
}

const zipBytes = readFileSync(zipPath);
const { clips, skipped } = selectClips(readZip(zipBytes, { unflaggedUtf8Names: true }));
// 檔頭只寫 NEWT2/檔名：清單不該因為 zip 放在哪台機器的哪個目錄而不同。
const source = { file: `NEWT2/${path.basename(zipPath)}`, sha256: sha256(zipBytes) };

console.log(`${source.file}（sha256 ${source.sha256.slice(0, 12)}…）：能上 ${clips.length} 支`);
for (const s of skipped) console.log(`  △ ${s.file}：${s.reason}`);

// 讀片長要一個真的檔（ffprobe 從管線讀 mp4 不保證能 seek）。--check 寫到暫存目錄，看完就刪。
const workDir = check ? mkdtempSync(path.join(os.tmpdir(), 'sxk-media-check-')) : clipDir;
mkdirSync(workDir, { recursive: true });

try {
  const entries = clips.map(clip => {
    const mp4 = path.join(workDir, `${clip.id}.mp4`);
    writeFileSync(mp4, clip.data);
    const duration = durationOf(mp4);
    const at = posterAtOf(clip.id);
    if (at >= duration) throw new Error(`${clip.id} 的封面時間點 ${at} 秒不在片長 ${duration} 秒之內`);
    if (!check) writePoster(mp4, path.join(workDir, `${clip.id}.jpg`), at);
    return mediaEntryOf(clip, duration);
  });

  const moduleText = emitActivityMediaModule(entries, source, skipped);
  const moduleAbs = path.join(root, ACTIVITY_MEDIA_MODULE);
  const migrationAbs = path.join(root, MEDIA_MIGRATION);
  const migration = readFileSync(migrationAbs, 'utf8');
  const nextMigration = replaceMediaBlock(migration, renderActivityMediaSql(entries));

  for (const e of entries) console.log(`  ${e.id}  ${e.videoSeconds} 秒  封面 ${posterAtOf(e.id)} 秒  sha256 ${e.sha256.slice(0, 12)}…`);

  if (check) {
    let ok = true;
    if (!existsSync(moduleAbs) || !sameToolkitContent(readFileSync(moduleAbs, 'utf8'), moduleText)) {
      console.error(`✗ ${ACTIVITY_MEDIA_MODULE} 與重跑結果不同。重跑 \`npx tsx scripts/t2-prepare-media.ts\` 之後再提交。`);
      ok = false;
    }
    if (!sameToolkitContent(migration, nextMigration)) {
      console.error(`✗ ${MEDIA_MIGRATION} 的示範片區段與重跑結果不同。重跑 \`npx tsx scripts/t2-prepare-media.ts\` 之後再提交。`);
      ok = false;
    }

    if (!existsSync(clipDir)) {
      console.log(`· ${path.relative(root, clipDir) || clipDir} 不在，略過檔案比對（要傳上主機之前先不帶 --check 跑一次）`);
    } else {
      const expected = new Set(entries.flatMap(e => [`${e.id}.mp4`, `${e.id}.jpg`]));
      let total = 0;
      for (const e of entries) {
        const mp4 = path.join(clipDir, `${e.id}.mp4`);
        const jpg = path.join(clipDir, `${e.id}.jpg`);
        if (!existsSync(mp4) || sha256(readFileSync(mp4)) !== e.sha256) {
          console.error(`✗ ${mp4} 不在或 sha256 與清單不同`);
          ok = false;
        }
        if (!existsSync(jpg) || statSync(jpg).size === 0) {
          console.error(`✗ ${jpg} 不在`);
          ok = false;
        }
      }
      for (const name of readdirSync(clipDir)) {
        total += statSync(path.join(clipDir, name)).size;
        if (!expected.has(name)) {
          console.error(`✗ ${path.join(clipDir, name)} 不在清單上（整個資料夾會被傳上主機）`);
          ok = false;
        }
      }
      if (ok) console.log(`✓ ${clipDir}：${expected.size} 個檔、共 ${mb(total)}，與清單一致`);
    }

    // 不在這裡 process.exit：那會跳過 finally，暫存目錄就留在那裡了。
    if (ok) console.log(`✓ ${ACTIVITY_MEDIA_MODULE} 與 ${MEDIA_MIGRATION} 的示範片區段都與重跑結果一致`);
    else process.exitCode = 1;
  } else {
    writeFileSync(moduleAbs, moduleText, 'utf8');
    writeFileSync(migrationAbs, nextMigration, 'utf8');
    const total = readdirSync(clipDir).reduce((sum, name) => sum + statSync(path.join(clipDir, name)).size, 0);
    console.log(`✓ 寫出 ${clipDir}（${entries.length} 支片＋${entries.length} 張封面，資料夾共 ${mb(total)}）`);
    console.log(`✓ 寫出 ${ACTIVITY_MEDIA_MODULE}（${entries.length} 支）與 ${MEDIA_MIGRATION} 的示範片區段`);
  }
} finally {
  if (check) rmSync(workDir, { recursive: true, force: true });
}
