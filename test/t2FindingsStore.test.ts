import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { buildT2Findings } from '../src/t2/findings';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag, T2Findings } from '../src/t2/types';

/**
 * `t2_findings` 的資料層（#59）：寫入語句帶 `user_id`，讀取只回該家長最新的一筆。
 *
 * 寫法比照 `t2ToolResultStore.test.ts`：假的連線池，驗的是「送出去的 SQL 長什麼樣、回來的列
 * 怎麼變成紀錄」，不是 MySQL。
 *
 * 【這裡在防什麼】
 * 1. 一份報告落到別人名下、或讀到別人的：兩支語句都必須帶 `user_id`。
 * 2. **`findings` 壞掉的那一列當成沒有報告**，不是端出半份。這裡比交卷那一層嚴一格：
 *    清單少一支還是一份清單，報告只有一列，端出半份比說「還沒有」糟得多。
 *    尤其是「維度不是九個」—— 配對層對它會直接丟例外，在那裡炸掉只看得到一句沒有上下文的話。
 * 3. **`prose` 壞掉不連坐**：判定是規則引擎算的，文字只是包裝，包裝破了不該把判定也丟掉。
 * 4. `created_at` 回來可能是 Date 也可能是字串（mysql2 的 `dateStrings`），兩種都要讀成 ISO。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];
let insertId = 500;

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

let store: typeof import('../src/db/t2Findings');

beforeAll(async () => {
  store = await import('../src/db/t2Findings');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

const FLAGS = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, T1Flag>;

const FINDINGS: T2Findings = buildT2Findings({
  results: [],
  t1Flags: FLAGS,
  assessedAgeMonth: 48,
  computedAt: '2026-09-12T01:00:00.000Z',
});

const PROSE = {
  overview: '总览',
  perDimension: [],
  weeklyPlanIntro: '这周的安排',
  closing: '若有疑虑请咨询专业人员',
} as any;

function row(over: Record<string, unknown> = {}) {
  return {
    id: 9,
    findings: JSON.stringify(FINDINGS),
    prose: JSON.stringify(PROSE),
    is_ai_generated: 1,
    ai_engine: 'qwen-3-5-plus-260215',
    created_at: '2026-09-12 09:00:05',
    ...over,
  };
}

describe('insertFindings', () => {
  it('INSERT 帶 user_id，版本兩件從 findings 取，JSON 欄位序列化後送', async () => {
    const id = await store.insertFindings(7, {
      findings: FINDINGS,
      prose: PROSE,
      isAiGenerated: true,
      aiEngine: 'qwen-3-5-plus-260215',
    });
    expect(id).toBe(500);
    expect(executed).toHaveLength(1);
    const { sql, params } = executed[0];
    expect(sql).toMatch(/^INSERT INTO t2_findings \(user_id, rules_version, toolkit_version, findings, prose, is_ai_generated, ai_engine\) VALUES \(\?, \?, \?, \?, \?, \?, \?\)$/);
    expect(params[0]).toBe(7);
    expect(params[1]).toBe(FINDINGS.rulesVersion);
    expect(params[2]).toBe(FINDINGS.toolkitVersion);
    expect(JSON.parse(params[3] as string)).toEqual(FINDINGS);
    expect(JSON.parse(params[4] as string)).toEqual(PROSE);
    expect(params[5]).toBe(1);
    expect(params[6]).toBe('qwen-3-5-plus-260215');
  });

  it('模板退路：is_ai_generated 存 0，ai_engine 記退路的來源', async () => {
    await store.insertFindings(7, {
      findings: FINDINGS,
      prose: PROSE,
      isAiGenerated: false,
      aiEngine: 'template:all_engines_failed',
    });
    expect(executed[0].params[5]).toBe(0);
    expect(executed[0].params[6]).toBe('template:all_engines_failed');
  });

  it('prose 為 null 時送 null，不是字串 "null"', async () => {
    await store.insertFindings(7, { findings: FINDINGS, prose: null, isAiGenerated: false, aiEngine: null });
    expect(executed[0].params[4]).toBeNull();
    expect(executed[0].params[6]).toBeNull();
  });
});

describe('latestFindings', () => {
  it('SELECT 只認 user_id，依 id 倒序取一筆', async () => {
    rows = [row()];
    const record = await store.latestFindings(7);
    expect(executed[0].sql).toMatch(/WHERE user_id = \? ORDER BY id DESC LIMIT 1$/);
    expect(executed[0].params).toEqual([7]);
    expect(record).toEqual({
      id: 9,
      createdAt: new Date('2026-09-12 09:00:05').toISOString(),
      findings: FINDINGS,
      prose: PROSE,
      isAiGenerated: true,
      aiEngine: 'qwen-3-5-plus-260215',
    });
  });

  it('一筆都沒有 → null', async () => {
    rows = [];
    expect(await store.latestFindings(7)).toBeNull();
  });

  it('mysql2 已經解析成物件時照收（不是只認字串）', async () => {
    rows = [row({ findings: FINDINGS, prose: PROSE })];
    expect((await store.latestFindings(7))!.findings).toEqual(FINDINGS);
  });

  it('created_at 是 Date 也讀得出來', async () => {
    rows = [row({ created_at: new Date('2026-09-12T09:00:05.000Z') })];
    expect((await store.latestFindings(7))!.createdAt).toBe('2026-09-12T09:00:05.000Z');
  });

  it.each([
    ['findings 不是 JSON', { findings: '{not json' }],
    ['findings 是別的東西', { findings: JSON.stringify({ hello: 'world' }) }],
    ['維度少了一個', { findings: JSON.stringify({ ...FINDINGS, dimensions: FINDINGS.dimensions.slice(1) }) }],
    ['同一個維度出現兩次（數量對、集合不對）', {
      findings: JSON.stringify({
        ...FINDINGS,
        dimensions: [FINDINGS.dimensions[0], ...FINDINGS.dimensions.slice(2), FINDINGS.dimensions[0]],
      }),
    }],
    ['computedAt 不是時間', { findings: JSON.stringify({ ...FINDINGS, computedAt: '不是時間' }) }],
    ['created_at 讀不成時間', { created_at: '不是時間' }],
  ])('%s → 當成沒有報告（null）', async (_label, over) => {
    rows = [row(over)];
    expect(await store.latestFindings(7)).toBeNull();
  });

  it('prose 壞掉只讓那一格變 null，findings 照回', async () => {
    rows = [row({ prose: '{not json' })];
    const record = await store.latestFindings(7);
    expect(record!.prose).toBeNull();
    expect(record!.findings).toEqual(FINDINGS);
  });

  it('ai_engine 是空字串時讀成 null（畫面上「未記錄」那一態）', async () => {
    rows = [row({ ai_engine: '' })];
    expect((await store.latestFindings(7))!.aiEngine).toBeNull();
  });
});
