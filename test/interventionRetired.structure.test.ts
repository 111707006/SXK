import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 舊干預包退場的結構護欄（#63，ADR-0005 的後果）。
 *
 * 一格一份的九十格那一線 —— 配對、格子空間、家長端干預包元件與它的 hook、後台
 * 素材庫分頁、`/api/intervention-pack` —— 2026-09 退場，由活動庫的每週配對承接
 * （`src/t2/activityMatch.ts`、`T2WeeklyPlan`）。這一支釘三件事：
 *
 * 1. 退場的四個模組（與素材庫分頁）**檔案不在了**，而且沒有任何模組再 import 它們。
 *    刪檔本身型別檢查擋得住 import 斷掉，但擋不住有人把檔案復活 —— 這裡讓復活變成
 *    一個看得見的動作。
 * 2. `/api/intervention-pack` 不再註冊。付費牆的 `tier2Only` 群組裡沒有它。
 * 3. `intervention_materials` **表與遷移檔仍在**（ADR-0005：空表無害，刪除遷移沒有回頭路），
 *    但程式碼不再查它。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

const RETIRED_FILES = [
  'src/utils/interventionMatch.ts',
  'src/utils/materialCells.ts',
  'src/utils/interventionPack.ts',
  'src/components/InterventionPack.tsx',
  'src/admin/panels/MaterialsPanel.tsx',
];

/** import 字串裡會出現的模組名（不含副檔名）。 */
const RETIRED_MODULES = RETIRED_FILES.map(f => path.basename(f).replace(/\.tsx?$/, ''));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 掃描的範圍：`src/`、`server.ts` 與 `test/`（測試也不該還在 import 退場的東西）。 */
const SOURCES = [
  ...walk(path.join(ROOT, 'src')),
  ...walk(path.join(ROOT, 'test')),
  path.join(ROOT, 'server.ts'),
]
  .map(full => path.relative(ROOT, full).replace(/\\/g, '/'))
  // 這一支自己寫著要找的字串，不算。
  .filter(rel => rel !== 'test/interventionRetired.structure.test.ts');

describe('退場的模組', () => {
  it('檔案不在了', () => {
    for (const rel of RETIRED_FILES) expect(exists(rel), rel).toBe(false);
  });

  it('沒有任何模組再 import 它們', () => {
    const importRe = new RegExp(
      `(?:from\\s*|import\\s*\\(\\s*|import\\s*)['"][^'"]*\\/(?:${RETIRED_MODULES.join('|')})['"]`
    );
    const offenders = SOURCES.filter(rel => importRe.test(read(rel)));
    expect(offenders).toEqual([]);
  });
});

describe('/api/intervention-pack', () => {
  const server = read('server.ts');

  it('不再註冊', () => {
    expect(server).not.toContain("'/api/intervention-pack'");
  });

  it('資料層不再有那一格的查詢', () => {
    expect(read('src/db/mysql.ts')).not.toMatch(/findActiveMaterialByCell|materialFromRow/);
  });
});

describe('intervention_materials 表', () => {
  it('遷移檔與 schema 仍在（ADR-0005：不刪表）', () => {
    expect(exists('deploy/migrations/2026-08-09-intervention-materials.sql')).toBe(true);
    expect(read('deploy/schema.sql')).toContain('CREATE TABLE IF NOT EXISTS `intervention_materials`');
  });

  it('但程式碼不再查它', () => {
    const offenders = SOURCES.filter(rel => /FROM intervention_materials|INTO intervention_materials|UPDATE intervention_materials/.test(read(rel)));
    expect(offenders).toEqual([]);
  });
});

describe('後台', () => {
  it('沒有素材庫分頁', () => {
    expect(read('src/admin/adminView.ts')).not.toMatch(/'materials'/);
    expect(read('src/admin/AdminApp.tsx')).not.toMatch(/MaterialsPanel/);
    expect(read('src/admin/routes.ts')).not.toMatch(/'\/materials/);
  });
});
