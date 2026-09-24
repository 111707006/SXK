/**
 * 示範片與封面（Keep 規格 K05、§6）：從客戶的 `NEWT2/T2视频_20260923.zip` 挑出能上的片，
 * 對到活動 A001–A300。
 *
 * 【挑片的規則】（規格 §6.1）
 * - 只看 zip 裡檔名是「三位數編號＋.mp4」的檔：`001.mp4` → A001。Mac 的附屬檔（`__MACOSX/`、
 *   `._001.mp4`）、Office 的暫存檔、進度表都不算。
 * - **跟前面某一支位元組相同就不上**：客戶的 007 與 006 是同一支片（畫面是「红灯停绿灯行」），
 *   007 的檔名卻看不出來。只看檔名會把錯的片掛到「走直线」底下 —— 家長照著一支不相干的示範做，
 *   而沒有任何東西會報錯。比的是 sha256，依編號由小到大，留先出現的那一支。
 * - **編號後面多了字就不上**：`008-不太好.mp4` 是客戶自己標的不良片。多出來的字一律當註記，
 *   不去猜哪些字是好話 —— 要上就請客戶把檔名改回 `008.mp4`。
 * - 同一個編號有兩支不同的片、編號對不到活動庫、一支都挑不到：丟例外，不猜。
 *
 * 片子**原封不動**上架（不轉檔、不重新封裝）：客戶的 19 支都是 H.264 High＋AAC、720p、
 * moov 在檔頭（可以邊下邊播），iOS 與微信都吃；而原封不動，清單上的 sha256 就是客戶那一支的 sha256。
 */

import { createHash } from 'node:crypto';
import { ACTIVITY_SEED } from '../../src/t2/activitySeed';
import type { ActivityMedia } from '../../src/t2/activityMedia';

/** 客戶的活動內容包（含 19 支 mp4，27 MB，不進 git）。準備腳本可以用 `--zip` 指到別處。 */
export const MEDIA_ZIP = 'NEWT2/T2视频_20260923.zip';
export const ACTIVITY_MEDIA_MODULE = 'src/t2/activityMedia.ts';

/** 片子與封面在媒體目錄底下的子目錄，也是網址的一段：`/media/activities/A001.mp4`。 */
export const MEDIA_SUBDIR = 'activities';
const MEDIA_URL_BASE = `/media/${MEDIA_SUBDIR}`;

/**
 * 封面取第幾秒的畫面（規格 §6.1「每支取第一個清楚的畫面」）。預設 3 秒，逐支覆寫。
 *
 * 這些時間點是 2026-09-24 拿樣品的 17 張封面（`src/prototype/t2-intervention/media/poster-0xx.jpg`）
 * 逐格比對（ffmpeg ssim，每支都在某一整秒或半秒對到 0.98 以上）挑出來的 —— 家長在正式站看到的封面
 * 與使用者看過的樣品是同一格畫面。腳本不讀樣品目錄（它之後會移走），只用這張表。
 */
export const POSTER_AT_DEFAULT_SECONDS = 3;
export const POSTER_AT_SECONDS: Readonly<Record<string, number>> = {
  A002: 5, A003: 2, A005: 2, A006: 6, A010: 4, A011: 4,
  A012: 5, A014: 5, A016: 6, A017: 5, A018: 5.5, A019: 4,
};

export function posterAtOf(id: string): number {
  return POSTER_AT_SECONDS[id] ?? POSTER_AT_DEFAULT_SECONDS;
}

/** 一支片的清單項。片長是 ffprobe 讀到的秒數四捨五入（10.08 → 10、5.088 → 5）。 */
export function mediaEntryOf(clip: Pick<ClipSource, 'id' | 'sha256'>, durationSeconds: number): ActivityMedia {
  const videoSeconds = Math.round(durationSeconds);
  if (!Number.isFinite(durationSeconds) || videoSeconds <= 0) {
    throw new Error(`${clip.id} 的片長讀不出來或是 0（${durationSeconds}）`);
  }
  return {
    id: clip.id,
    videoUrl: `${MEDIA_URL_BASE}/${clip.id}.mp4`,
    posterUrl: `${MEDIA_URL_BASE}/${clip.id}.jpg`,
    videoSeconds,
    sha256: clip.sha256,
  };
}

/** zip 裡的一支能上的片。 */
export interface ClipSource {
  /** 客戶的編號，001 → 1。 */
  no: number;
  /** 活動編號 'A001'。 */
  id: string;
  /** zip 內的路徑。 */
  file: string;
  data: Buffer;
  sha256: string;
}

/** 不上的片與理由（印給人看，也寫進清單的檔頭）。 */
export interface SkippedClip {
  file: string;
  reason: string;
}

const CLIP_NAME = /^(\d{3})(.*)\.mp4$/i;
const ACTIVITY_IDS = new Set(ACTIVITY_SEED.map(a => a.id));

function sha256Of(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function baseName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

export function selectClips(entries: ReadonlyMap<string, Buffer>): { clips: ClipSource[]; skipped: SkippedClip[] } {
  const candidates = [...entries]
    .filter(([file]) => !file.startsWith('__MACOSX/'))
    .map(([file, data]) => ({ file, data, match: CLIP_NAME.exec(baseName(file)) }))
    .filter((c): c is { file: string; data: Buffer; match: RegExpExecArray } => c.match !== null)
    .map(({ file, data, match }) => ({ file, data, no: Number(match[1]), note: match[2], sha256: sha256Of(data) }))
    .sort((a, b) => a.no - b.no || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  const clips: ClipSource[] = [];
  const skipped: SkippedClip[] = [];
  const seen = new Map<string, string>(); // sha256 → 最先出現的檔

  for (const c of candidates) {
    const id = `A${String(c.no).padStart(3, '0')}`;
    if (!ACTIVITY_IDS.has(id)) throw new Error(`${c.file}：編號對不到活動庫（${id} 不在 A001–A300）`);

    const twin = seen.get(c.sha256);
    if (!seen.has(c.sha256)) seen.set(c.sha256, c.file);
    if (twin !== undefined) {
      skipped.push({ file: c.file, reason: `與 ${baseName(twin)} 位元組相同（sha256 ${c.sha256.slice(0, 12)}…），不上` });
      continue;
    }
    if (c.note !== '') {
      skipped.push({ file: c.file, reason: `檔名在編號後面多了「${c.note}」（客戶的註記），不上` });
      continue;
    }
    const same = clips.find(x => x.no === c.no);
    if (same) throw new Error(`編號 ${String(c.no).padStart(3, '0')} 有兩支不同的片：${same.file}、${c.file}`);
    clips.push({ no: c.no, id, file: c.file, data: c.data, sha256: c.sha256 });
  }

  if (clips.length === 0) throw new Error('zip 裡一支能上的片都沒有（檔名要是 001.mp4 這種三位數編號）');
  return { clips, skipped };
}

export interface MediaZipSource {
  /** 給人看的路徑（repo 內就寫相對路徑）。 */
  file: string;
  sha256: string;
}

export function emitActivityMediaModule(
  entries: ReadonlyArray<ActivityMedia>,
  source: MediaZipSource,
  skipped: ReadonlyArray<SkippedClip>,
): string {
  return [
    '/**',
    ` * 示範片與封面（Keep 規格 K05、§6）：${entries.length} 支，每支一個站內網址、一張封面、片長與 sha256。`,
    ' *',
    ' * 由 `scripts/t2-prepare-media.ts` 從下面這個 zip 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，',
    ' * 而且遷移裡的 UPDATE 是從這一份印的（`test/activityMedia.test.ts` 重印比對）。',
    ` *   ${source.file}（sha256 ${source.sha256.slice(0, 12)}…）`,
    ' *',
    ' * 沒上的（規則見 `scripts/t2/activityMedia.ts`）：',
    ...(skipped.length === 0 ? [' *   （無）'] : skipped.map(s => ` *   ${s.file}：${s.reason}`)),
    ' *',
    ' * 片子本身**不進 git**：同一支腳本把它們寫到 `media/activities/`（gitignored），部署時另外傳到',
    ' * 正式站主機的 `/var/www/sxk/media/activities/`，由 `server.ts` 的 `/media` 服務（規格 §6.2 甲，',
    ' * 使用者 2026-09-24 定）。日後搬到物件儲存，改的是資料庫裡的網址，不是這一份。',
    ' *',
    ' * 家長端與後台讀的是資料庫，不是這一檔：資料庫那一份由同一支腳本印進遷移',
    ' * `deploy/migrations/2026-09-24-activity-media.sql` 的 UPDATE。',
    ' */',
    '',
    'export interface ActivityMedia {',
    "  /** 'A001'。 */",
    '  id: string;',
    '  /** 站內網址 `/media/activities/A001.mp4`。 */',
    '  videoUrl: string;',
    '  /** 封面 `/media/activities/A001.jpg`（960×540）。 */',
    '  posterUrl: string;',
    '  /** 片長（秒）：ffprobe 讀到的四捨五入。 */',
    '  videoSeconds: number;',
    '  /** 片子的 sha256。原封不動上架，所以也是客戶 zip 裡那一支的 sha256。 */',
    '  sha256: string;',
    '}',
    '',
    `export const ACTIVITY_MEDIA: ReadonlyArray<ActivityMedia> = ${JSON.stringify(entries, null, 2)};`,
    '',
  ].join('\n');
}
