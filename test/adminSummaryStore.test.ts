import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * 家長彙總的資料層（`adminStore.listSummarySources`，#69 code review 留下的效能項）。
 *
 * 寫法比照 `t2CheckinStore.test.ts`：假的連線池，驗的是「送出去的 SQL 長什麼樣、回來的列怎麼變成資料」。
 *
 * 【這裡在防什麼】
 * 1. 第一句**不讀 `report_history`**（整份報告快照，一位家長幾十 KB）——彙總只拿它補篩查當時的月齡。
 * 2. 只有成績裡找不到 T1 月齡的家長，才用第二句按 id 補讀，而且那一句一樣帶公司條件。
 * 3. 一批最多 500 個 id；全部的人成績都帶月齡時，第二句根本不送。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let userRows: any[] = [];
let historyRows: any[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      const flat = sql.replace(/\s+/g, ' ').trim();
      executed.push({ sql: flat, params });
      if (/FROM handoff_imports/.test(flat)) return [[]];
      if (/report_history/.test(flat)) return [historyRows.filter(r => params.includes(r.user_id))];
      return [userRows];
    },
  }),
}));

let store: typeof import('../src/admin/adminStore');

beforeAll(async () => {
  store = await import('../src/admin/adminStore');
});

const t1 = (extra: object = {}) => ({
  dimensionId: 'language', tierId: 'T1', score: 5, maxScore: 8, status: 'normal', completedAt: '2026-10-10T02:00:00.000Z', ...extra,
});

const user = (id: number, scores: object[]) => ({
  id, phone: null, company_id: 1, company_name: '甲机构', child: JSON.stringify({ name: `孩子${id}` }),
  completed_scores: JSON.stringify(scores), booking_count: 0,
});

beforeEach(() => {
  executed.length = 0;
  userRows = [];
  historyRows = [];
});

describe('listSummarySources', () => {
  it('第一句不讀 report_history；成績都帶月齡時不送第二句', async () => {
    userRows = [user(1, [t1({ assessedAgeMonth: 30 })]), user(2, [t1({ assessedAgeMonth: 40 })])];
    const sources = await store.listSummarySources({ kind: 'company', companyId: 1 });

    expect(executed[0].sql).not.toMatch(/report_history/);
    expect(executed[0].sql).toMatch(/company_id/);
    expect(executed.filter(c => /report_history/.test(c.sql))).toHaveLength(0);
    expect(sources.map(s => s.reportHistory)).toEqual([[], []]);
  });

  it('成績找不到月齡的那幾位才補讀，帶公司條件，讀回來的歷史交給整理那一層', async () => {
    const history = [{ type: 'T1_SCREENING', createdAt: '2026-10-10T02:00:00.000Z', child: { ageMonth: 22 } }];
    userRows = [user(1, [t1({ assessedAgeMonth: 30 })]), user(2, [t1()]), user(3, [])];
    historyRows = [{ user_id: 2, report_history: JSON.stringify(history) }, { user_id: 3, report_history: null }];

    const sources = await store.listSummarySources({ kind: 'company', companyId: 1 });

    const second = executed.filter(c => /report_history/.test(c.sql));
    expect(second).toHaveLength(1);
    expect(second[0].sql).toMatch(/company_id/);
    expect(second[0].sql).toMatch(/IN \(\?, \?\)/);
    expect(second[0].params.slice(-2)).toEqual([2, 3]);
    expect(sources.find(s => s.userId === 2)?.reportHistory).toEqual(history);
    expect(sources.find(s => s.userId === 1)?.reportHistory).toEqual([]);
    expect(sources.find(s => s.userId === 3)?.reportHistory).toEqual([]);
  });

  it('一批最多 500 個 id', async () => {
    userRows = Array.from({ length: 1201 }, (_, i) => user(i + 1, [t1()]));
    await store.listSummarySources({ kind: 'company', companyId: 1 });
    const batches = executed.filter(c => /report_history/.test(c.sql)).map(c => (c.sql.match(/\?/g) ?? []).length);
    expect(batches).toHaveLength(3);
    expect(Math.max(...batches)).toBeLessThanOrEqual(500 + 2);
  });
});
