import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor } from '../src/t2/kitv3/score';
import { scoreToolV3, type ToolResultV3 } from '../src/t2/kitv3/submit';

/**
 * `t2_tool_results` 完整版那幾列的資料層（`src/db/t2ToolResultsV3.ts`）。寫法同 `t2ToolResultStore.test.ts`：
 * 假的連線池，驗送出去的 SQL 與回來的列怎麼變成紀錄。防的是：寫到別人名下、讀到別人的或舊版的、壞列被當成做完。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];
let insertId = 200;

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

let store: typeof import('../src/db/t2ToolResultsV3');
let oldStore: typeof import('../src/db/t2ToolResults');

beforeAll(async () => {
  store = await import('../src/db/t2ToolResultsV3');
  oldStore = await import('../src/db/t2ToolResults');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

function result(toolId: string, ageM: number): ToolResultV3 {
  const bank = KITV3_BANKS[toolId];
  const form = formFor(bank, ageM);
  const answers: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM })) answers[a.item.key] = bank.options[form.sections.find(s => s.key === a.section)!.options][0].value;
  const r = scoreToolV3({ toolId, assessedAgeMonth: ageM, rater: 'mother', answers }, { inSchool: true }, new Date('2026-10-07T01:00:00Z'));
  if (!r.ok) throw new Error(r.body.code);
  return r.result;
}

const SNAPSHOT = { name: '小明', birthDate: '2023-10-01', gender: 'boy', ageMonth: 36 };
const GM = result('SXK-GM', 36);

describe('insertToolResultV3', () => {
  it('INSERT 帶 user_id；tool_id 是客規代碼、版本是完整版、pre 存作答情境', async () => {
    expect(await store.insertToolResultV3(7, SNAPSHOT, GM)).toBe(200);
    const { sql, params } = executed[0];
    expect(sql).toMatch(/^INSERT INTO t2_tool_results \(user_id, child_snapshot, tool_id, toolkit_version, assessed_age_month, rater, pre, answers, result\) VALUES/);
    expect(params.slice(0, 1)).toEqual([7]);
    expect(params.slice(2, 6)).toEqual(['SXK-GM', 'kit-20260923', 36, 'mother']);
    expect(JSON.parse(params[6] as string)).toEqual({ ageM: 36, inSchool: true });
    expect(JSON.parse(params[8] as string)).toEqual(GM);
  });
});

describe('listToolResultsV3', () => {
  const row = (id: number, r: unknown, over: Record<string, unknown> = {}) => ({
    id,
    child_snapshot: JSON.stringify(SNAPSHOT),
    toolkit_version: 'kit-20260923',
    result: JSON.stringify(r),
    created_at: new Date('2026-10-07T01:00:00Z'),
    ...over,
  });

  it('只讀這位家長、只讀完整版', async () => {
    await store.listToolResultsV3(7);
    expect(executed[0]).toEqual({
      sql: 'SELECT id, child_snapshot, result, created_at FROM t2_tool_results WHERE user_id = ? AND toolkit_version = ? ORDER BY id ASC',
      params: [7, 'kit-20260923'],
    });
  });

  it('讀得回來；壞列（不是 JSON、別的版本、工具不在登錄表、時間壞）丟掉、其餘照讀', async () => {
    rows = [
      row(1, GM),
      { ...row(2, GM), result: '{not json' },
      row(3, { ...GM, toolkitVersion: 'kit-20260908' }),
      row(4, { ...GM, toolId: 'sxk-gm' }),
      row(5, GM, { created_at: 'nope' }),
      row(6, result('SXK-ADL', 36)),
    ];
    const got = await store.listToolResultsV3(7);
    expect(got.map(r => [r.id, r.result.toolId])).toEqual([[1, 'SXK-GM'], [6, 'SXK-ADL']]);
    expect(got[0]).toMatchObject({ createdAt: '2026-10-07T01:00:00.000Z', childSnapshot: SNAPSHOT });
  });

  it('舊的讀法碰到完整版的列：安靜略過，不出警告', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rows = [row(1, GM)];
    expect(await oldStore.listToolResults(7)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
