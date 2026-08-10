import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

/**
 * 一次「什麼都沒改」的儲存不是「找不到」（issue #20 的回歸）。
 *
 * MySQL 的 `affectedRows` 算的是**真的變動過**的列，不是對得上的列。存下一份
 * 與現況一模一樣的內容 —— 沒改任何欄位就按儲存，或儲存鍵被按了兩下 ——
 * 拿到的是 0，而那與「這個 id 不存在」是同一個數字。路由層拿它當「找不到」，
 * 於是維護素材的人被告知他正看著的那一筆素材不存在。
 *
 * 這件事在 HTTP 測試裡看不見：那裡的資料層是替身，而替身不會複製
 * 「matched 但 changed 為 0」這個行為。所以這一支直接把假的連線池餵進
 * `adminStore`，讓 UPDATE **就是**回 0，看它怎麼回答。
 */

/** 資料庫收到的每一句。用來確認真的走了 UPDATE，而不是被前面的檢查短路掉。 */
const executed: string[] = [];

/** 資料庫裡有沒有這一筆。null 代表這個 id 不存在。 */
let storedRow: any = null;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string) => {
      executed.push(sql.trim().split(/\s+/)[0].toUpperCase());
      if (/^\s*SELECT/i.test(sql)) return [storedRow ? [storedRow] : []];
      // ── bug 的形狀就在這一行 ──
      // 內容一模一樣時，真正的 MySQL 回的就是 affectedRows: 0。
      return [{ affectedRows: 0 }];
    },
  }),
}));

const VALID_INPUT = {
  dimensionId: 'cognitive',
  ageBandId: 'A',
  severity: 'delay' as const,
  title: '认知 A 段 需关注',
  steps: [{ imageUrl: '/steps/a1.png', instruction: '把三块积木排成一列。' }],
  videoUrl: null,
  active: true,
};

const ROW = {
  id: 1,
  dimension_id: VALID_INPUT.dimensionId,
  age_band_id: VALID_INPUT.ageBandId,
  severity: VALID_INPUT.severity,
  title: VALID_INPUT.title,
  steps: JSON.stringify(VALID_INPUT.steps),
  video_url: null,
  active: 1,
  updated_at: null,
};

let store: typeof import('../src/admin/adminStore');

beforeAll(async () => {
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  executed.length = 0;
  storedRow = { ...ROW };
});

describe('覆寫一格素材', () => {
  // ── 這一條就是那個 bug 的形狀 ──
  it('內容與現況一模一樣時仍然算成功，不是「找不到该素材」', async () => {
    expect(await store.updateMaterial(1, VALID_INPUT)).toBe(true);
    // 確認它真的下了 UPDATE —— 否則這一條會因為別的理由變綠。
    expect(executed).toContain('UPDATE');
  });

  it('id 不存在才算找不到', async () => {
    storedRow = null;
    expect(await store.updateMaterial(999, VALID_INPUT)).toBe(false);
    // 不存在就不該再去改任何一列。
    expect(executed).not.toContain('UPDATE');
  });
});
