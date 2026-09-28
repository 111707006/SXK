import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * 交接碼與轉入紀錄的資料層（`src/db/handoffs.ts`）。用假連線池：要驗的是送出去的 SQL 與參數 ——
 * 碼不過期（寫入不帶 expires_at）、可以重複兌換（每次記一次使用），時間由資料庫的時鐘給。
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
  it('建碼：只存雜湊，不寫到期（NULL＝不過期）', async () => {
    const id = await store.createHandoffCode({ userId: 7, codeHash: 'h'.repeat(64), kind: 'button', consentVersion: 'v1' });
    expect(id).toBe(42);
    expect(executed[0].sql).toBe('INSERT INTO handoff_codes (code_hash, user_id, kind, consent_version) VALUES (?, ?, ?, ?)');
    expect(executed[0].params).toEqual(['h'.repeat(64), 7, 'button', 'v1']);
  });

  it('兌換：不看用過沒有，記一次使用；到期欄位是 NULL 就不看時間', async () => {
    const redeemed = await store.redeemHandoffCode('h'.repeat(64));
    expect(redeemed).toEqual({ userId: 7, kind: 'button', consentVersion: '2026-09-28' });
    expect(executed[0].sql).toBe(
      'UPDATE handoff_codes SET use_count = use_count + 1, last_used_at = NOW() WHERE code_hash = ? AND (expires_at IS NULL OR expires_at > NOW())',
    );
  });

  it('改不到（不存在）＝ null，不再多查一次', async () => {
    affectedRows = 0;
    expect(await store.redeemHandoffCode('h'.repeat(64))).toBeNull();
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
