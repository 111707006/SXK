import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 後台家長彙總（#69）—— 專案 A。A 只有一個視野（未歸屬），全域管理員不必選公司就看得到。
 *
 * 篩查渠道（CONTEXT.md）在 A 是三種之一，看 `handoff_imports` **最早**那一筆：
 *   - 從 B 轉入、在 B 屬於某家合作公司 → 那家公司當時的名字
 *   - 從 B 轉入、在 B 未歸屬 → 「筛查系统（森心康）」
 *   - 沒轉入過 → 「森心康直属」
 * 轉入兩次取最早：先從甲機構轉入、後來又從乙機構轉入的，寫甲機構。
 */

process.env.APP_MODE = 'full';

const nine = () =>
  ['gross_motor', 'sensory_processing', 'emotion_behavior', 'language', 'social_emotional', 'cognitive', 'attention', 'self_care', 'learning_ability']
    .map(d => ({ dimensionId: d, dimensionName: d, tierId: 'T1', score: 6, maxScore: 8, status: 'normal', completedAt: '2026-10-10T02:00:00.000Z' }));

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { matchesCompanyCondition } = await import('../src/admin/companyScope');
  type Cond = import('../src/admin/companyScope').CompanyCondition;
  const admin = { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-god-123', 4) };
  const base = { phone: null, companyId: null, companyName: null, reportHistory: [], bookingCount: 0 };

  const db = {
    sources: [
      { ...base, userId: 1, child: { name: '直属' }, handoffImports: [] },
      { ...base, userId: 2, child: { name: '从未归属转入' }, handoffImports: [{ id: 5, at: '2026-10-01T00:00:00.000Z', companyName: null }] },
      {
        ...base, userId: 3, child: { name: '转入两次' },
        // 晚的那一筆先列：挑最早要看時間，不是看順序。
        handoffImports: [
          { id: 9, at: '2026-10-05T00:00:00.000Z', companyName: '乙机构' },
          { id: 7, at: '2026-09-20T00:00:00.000Z', companyName: '甲机构' },
        ],
      },
    ] as any[],
    exports: [] as any[],
  };

  return {
    __db: db,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return email === admin.email ? admin : null;
    },
    async findAdminUserById(id: number) {
      return id === admin.id ? admin : null;
    },
    async listSummarySources(condition: Cond) {
      return db.sources.filter(s => matchesCompanyCondition(condition, s));
    },
    async recordExport(entry: any) {
      db.exports.push(entry);
    },
  };
});

let client: TestClient;
let db: any;
let token: string;
const h = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  db = (await import('../src/admin/adminStore') as any).__db;
  for (const s of db.sources) s.scores = nine();
  const resp = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
  token = (await resp.json()).token;
});

afterAll(async () => {
  await client.close();
});

describe('專案 A 的彙總', () => {
  it('不必選公司就看得到；篩查渠道三種都對、轉入兩次取最早', async () => {
    const resp = await client.get('/api/admin/parent-summary', h());
    expect(resp.status).toBe(200);
    const channels = Object.fromEntries((await resp.json()).rows.map((r: any) => [r.childName, r.channel]));
    expect(channels).toEqual({
      直属: '森心康直属',
      从未归属转入: '筛查系统（森心康）',
      转入两次: '甲机构',
    });
  });

  it('導出：檔案裡的篩查渠道與檢視一致，並記一筆「未歸屬」範圍的紀錄', async () => {
    const resp = await client.postJson('/api/admin/parent-summary/export', {}, h());
    expect(resp.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await resp.arrayBuffer());
    const channels: string[] = [];
    wb.worksheets[0].eachRow((row, i) => {
      if (i > 1) channels.push(String(row.getCell(4).value));
    });
    expect(channels.sort()).toEqual(['森心康直属', '甲机构', '筛查系统（森心康）'].sort());
    // 前一個測試看過畫面上的彙總，也記了一筆（parent_summary_view）；這裡只看導出那一筆。
    expect(db.exports.filter((e: any) => e.kind === 'parent_summary')).toEqual([
      expect.objectContaining({ adminUserId: 30, condition: { kind: 'unassigned' }, kind: 'parent_summary', rowCount: 3 }),
    ]);
  });
});
