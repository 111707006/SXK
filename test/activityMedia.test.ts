import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MEDIA_ZIP, selectClips } from '../scripts/t2/activityMedia';
import {
  MEDIA_BEGIN,
  MEDIA_END,
  MEDIA_MIGRATION,
  mediaBlockOf,
  renderActivityMediaSql,
} from '../scripts/t2/activityMediaSql';
import { readZip } from '../scripts/t2/zip';
import { ACTIVITY_MEDIA } from '../src/t2/activityMedia';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { libraryEntries } from '../src/t2/libraryRoutes';
import type { Activity } from '../src/t2/types';
import { isAllowedAssetUrl } from '../src/utils/assetUrl';
import { readActivityPatch } from '../src/utils/activityAdmin';

const ROOT = path.resolve(__dirname, '..');

/**
 * 示範片與封面（Keep 規格 K05、§6）。
 *
 * 【為什麼需要這些】
 * 17 支片子是**腳本**從客戶的 `NEWT2/T2视频_20260923.zip` 挑出來的，不是手抄檔名：
 * 007 的檔名看起來正常，內容卻是 006 的同一支（「红灯停绿灯行」），只看檔名會把錯的片掛到
 * 「走直线」底下 —— 家長照著一支不相干的示範做，而沒有任何東西會報錯。
 * 這裡先把挑片的規則釘住（造出來的小 zip），再驗清單與遷移（CI 跑得了，不需要 zip），
 * 最後有 zip 的機器上整批重挑一次比對 sha256。
 */

const bytes = (s: string) => Buffer.from(s, 'utf8');

/** 一個只有 stored 項的最小 zip。`flags` 是 general purpose flag（0x0800＝檔名是 UTF-8）。 */
function storedZip(files: Array<{ name: Buffer; data: Buffer; flags: number }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(f.flags, 6);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(f.name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(f.flags, 8);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(f.name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, f.name, f.data);
    centrals.push(central, f.name);
    offset += 30 + f.name.length + f.data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe('zip 讀取器：Mac 壓的 zip', () => {
  // 客戶的 T2视频_20260923.zip 是 Mac 的「壓縮」做的：中文檔名直接寫 UTF-8，卻不設 bit 11。
  const macZip = storedZip([{ name: bytes('T2视频/008-不太好.mp4'), data: bytes('八'), flags: 0x0008 }]);

  it('預設照舊不猜：沒設 UTF-8 旗標又不是純 ASCII 就丟例外（工具包的兩個 zip 走這條）', () => {
    expect(() => readZip(macZip)).toThrow(/UTF-8/);
  });

  it('明說要收的呼叫端：嚴格解得開的 UTF-8 就收', () => {
    const files = readZip(macZip, { unflaggedUtf8Names: true });
    expect([...files.keys()]).toEqual(['T2视频/008-不太好.mp4']);
    expect(files.get('T2视频/008-不太好.mp4')!.equals(bytes('八'))).toBe(true);
  });

  it('明說要收也不猜別的編碼：解不開的 UTF-8（例如 GBK）照樣丟例外', () => {
    const gbk = storedZip([{ name: Buffer.from([0xb2, 0xbb, 0xcc, 0xab, 0xba, 0xc3]), data: bytes('x'), flags: 0 }]);
    expect(() => readZip(gbk, { unflaggedUtf8Names: true })).toThrow(/UTF-8/);
  });
});

describe('從客戶的 zip 挑片', () => {
  it('編號 NNN.mp4 → ANNN；Mac 的附屬檔、暫存檔、不是 mp4 的都不算', () => {
    const { clips, skipped } = selectClips(new Map([
      ['T2视频/002.mp4', bytes('二')],
      ['T2视频/001.mp4', bytes('一')],
      ['__MACOSX/T2视频/._001.mp4', bytes('mac')],
      ['T2视频/.DS_Store', bytes('ds')],
      ['T2视频/.~生成视频.docx', bytes('lock')],
      ['T2视频/生成进度表.xlsx', bytes('xlsx')],
    ]));
    expect(clips.map(c => [c.id, c.file])).toEqual([
      ['A001', 'T2视频/001.mp4'],
      ['A002', 'T2视频/002.mp4'],
    ]);
    expect(clips[0].data.equals(bytes('一'))).toBe(true);
    // `printf '一' | sha256sum`
    expect(clips[0].sha256).toBe('51a75f4634dfa8598a0a1436da0b7764830edd1f3a97661222387da2fe2b38d1');
    expect(skipped).toEqual([]);
  });

  it('跟前面某一支位元組相同就不上（007 與 006）—— 看的是 sha256，不是檔名', () => {
    const { clips, skipped } = selectClips(new Map([
      ['T2视频/006.mp4', bytes('红灯停绿灯行')],
      ['T2视频/007.mp4', bytes('红灯停绿灯行')],
    ]));
    expect(clips.map(c => c.id)).toEqual(['A006']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].file).toBe('T2视频/007.mp4');
    expect(skipped[0].reason).toContain('006.mp4');
    expect(skipped[0].reason).toContain('位元組相同');
  });

  it('檔名在編號後面多了字（客戶的註記「-不太好」）就不上', () => {
    const { clips, skipped } = selectClips(new Map([
      ['T2视频/008-不太好.mp4', bytes('八')],
      ['T2视频/009.mp4', bytes('九')],
    ]));
    expect(clips.map(c => c.id)).toEqual(['A009']);
    expect(skipped).toEqual([{ file: 'T2视频/008-不太好.mp4', reason: expect.stringContaining('-不太好') }]);
  });

  it('跟一支不上的片位元組相同，一樣不上', () => {
    const { clips, skipped } = selectClips(new Map([
      ['T2视频/008-不太好.mp4', bytes('八')],
      ['T2视频/009.mp4', bytes('八')],
      ['T2视频/010.mp4', bytes('十')],
    ]));
    expect(clips.map(c => c.id)).toEqual(['A010']);
    expect(skipped.map(s => s.file)).toEqual(['T2视频/008-不太好.mp4', 'T2视频/009.mp4']);
  });

  it('同一個編號有兩支不同的片：丟例外，不猜哪一支', () => {
    expect(() => selectClips(new Map([
      ['T2视频/001.mp4', bytes('甲')],
      ['T2视频/新的/001.mp4', bytes('乙')],
    ]))).toThrow(/001/);
  });

  it('編號對不到活動庫（A001–A300 以外）：丟例外', () => {
    expect(() => selectClips(new Map([['T2视频/301.mp4', bytes('x')]]))).toThrow(/A301/);
    expect(() => selectClips(new Map([['T2视频/000.mp4', bytes('x')]]))).toThrow(/A000/);
  });

  it('一支都挑不到：丟例外（zip 放錯了）', () => {
    expect(() => selectClips(new Map([['T2视频/生成视频.docx', bytes('x')]]))).toThrow();
  });
});

describe('清單 → 遷移的 UPDATE', () => {
  const a001 = { id: 'A001', videoUrl: '/media/activities/A001.mp4', posterUrl: '/media/activities/A001.jpg', videoSeconds: 10, sha256: 'a'.repeat(64) };
  const a010 = { id: 'A010', videoUrl: '/media/activities/A010.mp4', posterUrl: '/media/activities/A010.jpg', videoSeconds: 5, sha256: 'b'.repeat(64) };

  it('一支一句，三格都只在「還沒填」時才寫；最後一句數還缺幾支', () => {
    expect(renderActivityMediaSql([a001, a010])).toBe([
      'UPDATE `activities` SET',
      "  `video_url` = IF(`video_url` IS NULL OR TRIM(`video_url`) = '', '/media/activities/A001.mp4', `video_url`),",
      "  `poster_url` = IF(`poster_url` IS NULL OR TRIM(`poster_url`) = '', '/media/activities/A001.jpg', `poster_url`),",
      '  `video_seconds` = IF(`video_seconds` IS NULL OR `video_seconds` <= 0, 10, `video_seconds`)',
      "WHERE `id` = 'A001';",
      '',
      'UPDATE `activities` SET',
      "  `video_url` = IF(`video_url` IS NULL OR TRIM(`video_url`) = '', '/media/activities/A010.mp4', `video_url`),",
      "  `poster_url` = IF(`poster_url` IS NULL OR TRIM(`poster_url`) = '', '/media/activities/A010.jpg', `poster_url`),",
      '  `video_seconds` = IF(`video_seconds` IS NULL OR `video_seconds` <= 0, 5, `video_seconds`)',
      "WHERE `id` = 'A010';",
      '',
      '-- 清單上的每一支三格都有值（_gone 必須回 0，migrate.mjs 的命名約定）。',
      'SELECT 2 - COUNT(*) AS activity_media_missing_gone',
      '  FROM `activities`',
      " WHERE `id` IN ('A001', 'A010')",
      "   AND `video_url` IS NOT NULL AND TRIM(`video_url`) <> ''",
      "   AND `poster_url` IS NOT NULL AND TRIM(`poster_url`) <> ''",
      '   AND `video_seconds` > 0;',
      '',
    ].join('\n'));
  });

  it.each([
    ['網址不是站內 / 或 https://', { ...a001, videoUrl: 'http://x/A001.mp4' }],
    ['協定相對網址', { ...a001, posterUrl: '//cdn.example.com/A001.jpg' }],
    ['片長不是正整數', { ...a001, videoSeconds: 0 }],
    ['片長有小數', { ...a001, videoSeconds: 10.08 }],
  ])('清單壞了就丟例外，不印出一句會把壞值寫進正式庫的 SQL：%s', (_, bad) => {
    expect(() => renderActivityMediaSql([bad])).toThrow();
  });

  it('同一支出現兩次：丟例外', () => {
    expect(() => renderActivityMediaSql([a001, a001])).toThrow(/A001/);
  });
});

/** 規格 §6.1：001–006、009–019 上架；007（與 006 相同）、008（客戶標不良）不上；A020 以後沒片。 */
const EXPECTED_IDS = ['A001', 'A002', 'A003', 'A004', 'A005', 'A006',
  'A009', 'A010', 'A011', 'A012', 'A013', 'A014', 'A015', 'A016', 'A017', 'A018', 'A019'];

describe('清單 src/t2/activityMedia.ts（準備腳本產的）', () => {
  it('17 支，就是規格 §6.1 那 17 支；A007、A008、A020 沒有', () => {
    expect(ACTIVITY_MEDIA.map(m => m.id)).toEqual(EXPECTED_IDS);
  });

  it('網址是 /media/activities/<編號>.mp4 與 .jpg；片長 010 是 5 秒、其餘 10 秒（規格 §6.1）', () => {
    for (const m of ACTIVITY_MEDIA) {
      expect(m.videoUrl).toBe(`/media/activities/${m.id}.mp4`);
      expect(m.posterUrl).toBe(`/media/activities/${m.id}.jpg`);
      expect(m.videoSeconds, m.id).toBe(m.id === 'A010' ? 5 : 10);
      expect(m.sha256, m.id).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Set(ACTIVITY_MEDIA.map(m => m.sha256)).size).toBe(ACTIVITY_MEDIA.length);
  });

  // 後台要改得動這幾格：內容團隊把一支換成物件儲存的網址、或改回這裡的網址，都走同一道檢查。
  it('每一支的三格都過得了後台的檢查（assetUrl.ts 的站內 / 路徑、片長正整數），而且過完一個字都沒變', () => {
    for (const m of ACTIVITY_MEDIA) {
      expect(isAllowedAssetUrl(m.videoUrl) && isAllowedAssetUrl(m.posterUrl), m.id).toBe(true);
      const r = readActivityPatch({ videoUrl: m.videoUrl, posterUrl: m.posterUrl, videoSeconds: m.videoSeconds });
      expect(r, m.id).toEqual({ ok: true, patch: { videoUrl: m.videoUrl, posterUrl: m.posterUrl, videoSeconds: m.videoSeconds } });
    }
  });

  it('遷移跑完，片庫（GET /api/t2/library）列的就是這 17 支，帶封面與片長', () => {
    const byId = new Map(ACTIVITY_MEDIA.map(m => [m.id, m]));
    // 遷移只寫三格：其餘照種子（全部啟用）
    const library: Activity[] = ACTIVITY_SEED.map(a => {
      const m = byId.get(a.id);
      return m ? { ...a, videoUrl: m.videoUrl, posterUrl: m.posterUrl, videoSeconds: m.videoSeconds } : a;
    });
    const entries = libraryEntries(library);
    expect(entries.map(e => e.id)).toEqual(EXPECTED_IDS);
    expect(entries.find(e => e.id === 'A010')).toMatchObject({ posterUrl: '/media/activities/A010.jpg', videoSeconds: 5 });
  });
});

/**
 * 與 `deploy/migrate.mjs` 同一個切法：先拿掉 `--` 開頭的整行，再照分號切。
 * （那支腳本一載入就連資料庫，不能 import；與 activityContent.test.ts 同一份照抄。）
 */
function statementsOf(sql: string): string[] {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

describe('地基：遷移檔的 UPDATE 是 ACTIVITY_MEDIA 印出來的（CI 跑得了，不需要 zip）', () => {
  const migration = fs.readFileSync(path.join(ROOT, MEDIA_MIGRATION), 'utf8');
  const block = mediaBlockOf(migration);

  it('兩個標記之間 = renderActivityMediaSql(ACTIVITY_MEDIA)', () => {
    expect(block, `遷移檔缺少 ${MEDIA_BEGIN}／${MEDIA_END}`).not.toBeNull();
    expect(block!.trim()).toBe(renderActivityMediaSql(ACTIVITY_MEDIA).trim());
  });

  it('整份遷移：migrate.mjs 切得出 17 句 UPDATE 加 1 句驗證，驗證照命名約定、放在最後', () => {
    const statements = statementsOf(migration);
    expect(statements).toHaveLength(18);
    statements.slice(0, 17).forEach((s, i) => {
      expect(s).toMatch(/^UPDATE `activities` SET\n/);
      expect(s.endsWith(`WHERE \`id\` = '${EXPECTED_IDS[i]}'`), s.slice(-40)).toBe(true);
      // 沒有哪一格是無條件覆寫的（重跑不蓋掉後台填過的）
      for (const line of s.split('\n').slice(1, -1)) expect(line).toMatch(/^ {2}`\w+` = IF\(/);
    });
    expect(statements[17]).toMatch(/^SELECT 17 - COUNT\(\*\) AS activity_media_missing_gone\b/);
    expect(migration).not.toMatch(/company_id\s*=/i);
  });

  it('跑在加欄位的那一份之後（poster_url、video_seconds 由 2026-09-23-activity-content.sql 加）', () => {
    const files = fs.readdirSync(path.join(ROOT, 'deploy/migrations')).filter(n => n.endsWith('.sql')).sort();
    expect(files.indexOf(path.basename(MEDIA_MIGRATION))).toBeGreaterThan(files.indexOf('2026-09-23-activity-content.sql'));
  });
});

/**
 * 有 zip 的機器上（主目錄的 `NEWT2/`，或用 `SXK_MEDIA_ZIP` 指到它）整批重挑一次：挑到的就是清單上那 17 支、
 * 位元組一模一樣，擋下的是 007 與 008。zip 27 MB、含 mp4，不進 git —— CI 與 worktree 上沒有它，這一段跳過。
 * 片長要 ffprobe，不在這裡驗；`npx tsx scripts/t2-prepare-media.ts --check` 連片長一起比。
 */
const ZIP = process.env.SXK_MEDIA_ZIP || path.join(ROOT, MEDIA_ZIP);
const hasZip = fs.existsSync(ZIP);

describe.skipIf(!hasZip)(`客戶的 zip 整批重挑（${hasZip ? ZIP : `沒有 ${MEDIA_ZIP}，跳過`}）`, () => {
  it('挑到的 id 與 sha256 與清單逐支相同；擋下的是 007（與 006 相同）與 008（客戶標不良）', () => {
    const { clips, skipped } = selectClips(readZip(fs.readFileSync(ZIP), { unflaggedUtf8Names: true }));
    expect(clips.map(c => ({ id: c.id, sha256: c.sha256 }))).toEqual(ACTIVITY_MEDIA.map(m => ({ id: m.id, sha256: m.sha256 })));
    expect(skipped.map(s => s.file)).toEqual(['T2视频/007.mp4', 'T2视频/008-不太好.mp4']);
    expect(skipped[0].reason).toContain('006.mp4');
  });
});
