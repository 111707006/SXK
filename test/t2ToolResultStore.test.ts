import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import type { ToolId, ToolResult } from '../src/t2/types';

/**
 * `t2_tool_results` 的資料層（#57）：寫入語句帶 `user_id`，讀取只回該家長的。
 *
 * 寫法比照 `activityStore.test.ts` 後半：假的連線池，驗的是「送出去的 SQL 長什麼樣、回來的列
 * 怎麼變成紀錄」，不是 MySQL。
 *
 * 【這裡在防什麼】
 * 1. 一筆交卷落到別人名下、或讀到別人的：兩支語句都必須帶 `user_id`，而且讀取的 WHERE 只有它。
 * 2. 一列壞掉（`result` 不是 JSON、或形狀不對）不該讓整份清單讀不出來，**也不能**被端出去當一支
 *    做完的工具 —— 壞列丟掉，其餘照讀。
 * 3. `created_at` 回來可能是 Date 也可能是字串（mysql2 的 `dateStrings` 設定），兩種都要讀成 ISO。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];
let insertId = 100;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^INSERT/i.test(sql)) return [{ insertId: insertId++ }];
      return [rows];
    },
  }),
}));

let store: typeof import('../src/db/t2ToolResults');

beforeAll(async () => {
  store = await import('../src/db/t2ToolResults');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

function full(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

function score(toolId: ToolId, ageMonth: number, computedAt: string): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'father', answers: full(toolId, ageMonth, 2), pre: { regression: 'none' }, computedAt });
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.result;
}

const SNAPSHOT = { name: '小明', birthDate: '2022-09-12', gender: 'boy', ageMonth: 48 };
const RESULT = score('sxk-lang', 48, '2026-09-12T01:00:00.000Z');

describe('insertToolResult', () => {
  it('INSERT 帶 user_id，其餘欄位從 ToolResult 取，JSON 欄位序列化後送', async () => {
    const id = await store.insertToolResult(7, SNAPSHOT, RESULT);
    expect(id).toBe(100);
    expect(executed).toHaveLength(1);
    const { sql, params } = executed[0];
    expect(sql).toMatch(/^INSERT INTO t2_tool_results \(user_id, child_snapshot, tool_id, toolkit_version, assessed_age_month, rater, pre, answers, result\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)$/);
    expect(params[0]).toBe(7);
    expect(JSON.parse(params[1] as string)).toEqual(SNAPSHOT);
    expect(params.slice(2, 6)).toEqual(['sxk-lang', RESULT.toolkitVersion, 48, 'father']);
    expect(JSON.parse(params[6] as string)).toEqual({ regression: 'none' });
    expect(JSON.parse(params[7] as string)).toEqual(RESULT.answers);
    expect(JSON.parse(params[8] as string)).toEqual(RESULT);
  });
});

describe('listToolResults', () => {
  const row = (id: number, result: unknown, over: Record<string, unknown> = {}) => ({
    id,
    user_id: 7,
    child_snapshot: JSON.stringify(SNAPSHOT),
    tool_id: 'sxk-lang',
    result,
    created_at: new Date('2026-09-12T01:00:05Z'),
    ...over,
  });

  it('只讀這位家長的：WHERE 只有 user_id，依 id 升冪', async () => {
    rows = [row(1, JSON.stringify(RESULT))];
    const list = await store.listToolResults(7);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toBe('SELECT id, child_snapshot, result, created_at FROM t2_tool_results WHERE user_id = ? ORDER BY id ASC');
    expect(executed[0].params).toEqual([7]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(1);
    expect(list[0].result).toEqual(RESULT);
    expect(list[0].childSnapshot).toEqual(SNAPSHOT);
    expect(list[0].createdAt).toBe('2026-09-12T01:00:05.000Z');
  });

  it('mysql2 已經把 JSON 欄位解析成物件、created_at 是字串時，照樣讀得出來', async () => {
    rows = [row(2, RESULT, { child_snapshot: SNAPSHOT, created_at: '2026-09-12 01:00:05' })];
    const list = await store.listToolResults(7);
    expect(list[0].result).toEqual(RESULT);
    expect(list[0].childSnapshot).toEqual(SNAPSHOT);
    expect(Date.parse(list[0].createdAt)).not.toBeNaN();
  });

  it('壞掉的列丟掉，其餘照讀 —— 不拋例外，也不端出去', async () => {
    rows = [
      row(1, '{不是 JSON'),
      row(2, JSON.stringify({ ...RESULT, toolId: 'sxk-gone' })),   // 題庫裡沒有這支了
      row(3, JSON.stringify({ toolId: 'sxk-lang' })),               // 形狀不全
      row(4, JSON.stringify(RESULT)),
      row(5, null),
      row(6, JSON.stringify(RESULT), { created_at: 'nope' }),          // 時間讀不出來
    ];
    const list = await store.listToolResults(7);
    expect(list.map(r => r.id)).toEqual([4]);
  });

  it('快照壞掉不影響結果本身：childSnapshot 讀成 null，result 照回', async () => {
    rows = [row(1, JSON.stringify(RESULT), { child_snapshot: '{壞' })];
    const list = await store.listToolResults(7);
    expect(list).toHaveLength(1);
    expect(list[0].childSnapshot).toBeNull();
  });

  it('空表回空陣列，不是 null', async () => {
    expect(await store.listToolResults(7)).toEqual([]);
  });
});
