import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * 交接碼與轉入紀錄的資料層（`src/db/handoffs.ts`）。用假連線池：要驗的是送出去的 SQL 與參數 ——
 * 到期與「已用」由資料庫的時鐘判斷、兌換是一句條件式 UPDATE（兩個請求同時兌換只有一個成功）。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let affectedRows = 1;
let selectRows: unknown[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^UPDATE|^INSERT/i.test(sql.trim())) return [{ affectedRows, insertId: 42 }];
      return [selectRows];
    },
  }),
}));

let store: typeof import('../src/db/handoffs');

beforeAll(async () => {
  store = await import('../src/db/handoffs');
});

beforeEach(() => {
  executed.length = 0;
  affectedRows = 1;
  selectRows = [{ user_id: 7, kind: 'button', consent_version: '2026-09-28' }];
});

describe('handoff_codes', () => {
  it('建碼：到期由資料庫算（DATE_ADD(NOW(), …)），只存雜湊', async () => {
    const id = await store.createHandoffCode({ userId: 7, codeHash: 'h'.repeat(64), kind: 'button', ttlSec: 120, consentVersion: 'v1' });
    expect(id).toBe(42);
    expect(executed[0].sql).toContain('DATE_ADD(NOW(), INTERVAL ? SECOND)');
    expect(executed[0].params).toEqual(['h'.repeat(64), 7, 'button', 'v1', 120]);
  });

  it('兌換：條件式 UPDATE（沒用過、沒過期），改到一列才讀回來', async () => {
    const consumed = await store.consumeHandoffCode('h'.repeat(64));
    expect(consumed).toEqual({ userId: 7, kind: 'button', consentVersion: '2026-09-28' });
    expect(executed[0].sql).toBe(
      'UPDATE handoff_codes SET redeemed_at = NOW() WHERE code_hash = ? AND redeemed_at IS NULL AND expires_at > NOW()',
    );
  });

  it('改不到（用過、過期、不存在）＝ null，不再多查一次', async () => {
    affectedRows = 0;
    expect(await store.consumeHandoffCode('h'.repeat(64))).toBeNull();
    expect(executed).toHaveLength(1);
  });
});

describe('handoff_imports', () => {
  it('記來源公司的快照；未歸屬三欄都是 NULL', async () => {
    await store.recordHandoffImport({
      userId: 3, sourceUserId: 7, source: { companyId: 2, slug: 'fudan', name: '复旦' },
      kind: 'button', consentVersion: 'v1', imported: true,
    });
    await store.recordHandoffImport({ userId: 3, sourceUserId: 8, source: null, kind: 'button', consentVersion: null, imported: false });
    expect(executed[0].params).toEqual([3, 7, 2, 'fudan', '复旦', 'button', 'v1', 1]);
    expect(executed[1].params).toEqual([3, 8, null, null, null, 'button', null, 0]);
  });
});
