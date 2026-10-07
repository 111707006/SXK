import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { planPeriod } from '../src/t2/trainingPush';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';

/**
 * `t2_training_periods`（T2 v3 規格 §6.1）：資料層＋schema／遷移一致。
 *
 * 假的連線池，驗的是送出去的 SQL 與讀回來的形狀。防的是：
 * 1. 每一句都帶 `user_id`（UPDATE 也是：只改自己的那一列）。
 * 2. `plan` 存什麼讀回什麼；形狀壞了回 `plan: null`，不是丟例外（端點會開下一期，不讓家長每次 500）。
 * 3. schema.sql 與遷移的 CREATE TABLE 一字不差；遷移只建表、有照命名約定的驗證句。
 */

const executed: Array<{ sql: string; params: unknown[] }> = [];
let rows: any[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async (sql: string, params: unknown[]) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^INSERT/i.test(sql)) return [{ insertId: 41 }];
      return [rows];
    },
  }),
}));

let store: typeof import('../src/db/t2TrainingPeriods');

beforeAll(async () => {
  store = await import('../src/db/t2TrainingPeriods');
});

beforeEach(() => {
  executed.length = 0;
  rows = [];
});

const PLAN = planPeriod({
  dimensions: DIMENSION_CODES.map(d => ({ dimensionId: d, band: d === 'LANG' ? 'refer' : 'clear', t1Flag: 0 as const })),
  ageMonth: 48,
  library: ACTIVITY_SEED,
});

/** 存進 plan 欄的那一份（`storedPlanOf` 的結果；it.each 的參數在收集測試時就求值，那時 store 還沒載入）。 */
const STORED = { perWeek: PLAN.perWeek, sampleOnly: PLAN.sampleOnly, dimensions: PLAN.dimensions, weeks: PLAN.weeks };

function row(over: Record<string, unknown> = {}) {
  return {
    id: 41,
    findings_id: 77,
    period_no: 1,
    first_week_start: '2026-10-05',
    age_month: 48,
    adjustment: 'none',
    completion: null,
    plan: JSON.stringify(STORED),
    rules_version: 'push-v3-2026-10-07',
    created_at: '2026-10-05 09:00:00',
    ...over,
  };
}

describe('資料層', () => {
  it('storedPlanOf 只留 plan 欄要的四樣', () => {
    expect(store.storedPlanOf(PLAN)).toEqual(STORED);
  });

  it('INSERT 帶 user_id，plan 序列化後送', async () => {
    const id = await store.insertTrainingPeriod(7, {
      findingsId: 77,
      periodNo: 1,
      firstWeekStart: '2026-10-05',
      ageMonth: 48,
      adjustment: 'none',
      completion: null,
      plan: STORED,
      rulesVersion: 'push-v3-2026-10-07',
    });
    expect(id).toBe(41);
    expect(executed[0].sql).toMatch(/^INSERT INTO t2_training_periods \(user_id, findings_id, period_no,/);
    expect(executed[0].params[0]).toBe(7);
    expect(JSON.parse(executed[0].params[7] as string)).toEqual(STORED);
  });

  it('最新一期：帶 user_id 與 findings_id、period_no 由大到小取一筆；讀回來的 plan 與存的一樣', async () => {
    rows = [row()];
    const got = await store.latestTrainingPeriod(7, 77);
    expect(executed[0].sql).toMatch(/WHERE user_id = \? AND findings_id = \? ORDER BY period_no DESC LIMIT 1$/);
    expect(executed[0].params).toEqual([7, 77]);
    expect(got).toMatchObject({ id: 41, findingsId: 77, periodNo: 1, firstWeekStart: '2026-10-05', ageMonth: 48, adjustment: 'none', completion: null });
    expect(got!.plan).toEqual(STORED);
  });

  it('沒有就回 null', async () => {
    expect(await store.latestTrainingPeriod(7, 77)).toBeNull();
  });

  it('UPDATE 只改自己的那一列（帶 user_id）', async () => {
    await store.updateTrainingPeriodPlan(7, 41, STORED);
    expect(executed[0].sql).toBe('UPDATE t2_training_periods SET plan = ? WHERE id = ? AND user_id = ?');
    expect(executed[0].params.slice(1)).toEqual([41, 7]);
  });

  it('DATE 欄位是本地午夜的 Date 也讀成同一天；completion 是字串（DECIMAL）也讀成數字', async () => {
    rows = [row({ first_week_start: new Date(2026, 9, 5), completion: '0.8125' })];
    const got = await store.latestTrainingPeriod(7, 77);
    expect(got!.firstWeekStart).toBe('2026-10-05');
    expect(got!.completion).toBe(0.8125);
  });

  it.each([
    ['不是 JSON', '{'],
    ['少一週', JSON.stringify({ ...STORED, weeks: [] })],
    ['格子的維度不在能力表裡', JSON.stringify({ ...STORED, weeks: PLAN.weeks.map(w => w.map(s => ({ ...s, dimension: 'ADL' }))) })],
    ['做法認不得', JSON.stringify({ ...STORED, weeks: PLAN.weeks.map(w => w.map(s => ({ ...s, variant: 'x' }))) })],
  ])('plan 壞了（%s）→ plan: null，不丟例外', async (_, plan) => {
    rows = [row({ plan })];
    const got = await store.latestTrainingPeriod(7, 77);
    expect(got!.plan).toBeNull();
    expect(got!.id).toBe(41);
  });
});

describe('schema 與遷移', () => {
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const schema = read('deploy/schema.sql');
  const migration = read('deploy/migrations/2026-10-07-t2-training-periods.sql');
  const block = (sql: string) => {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS `t2_training_periods`');
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
  };

  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(block(migration)).toBe(block(schema));
  });

  it('遷移只建表（可以重跑），驗證句照命名約定', () => {
    expect(migration).not.toMatch(/^\s*(ALTER|DROP|DELETE|UPDATE)\b/im);
    for (const alias of [
      't2_training_periods_table_ok',
      't2_training_periods_index_ok',
      't2_training_periods_plan_ok',
      't2_training_periods_fk_user_ok',
      't2_training_periods_fk_findings_ok',
    ]) {
      expect(migration).toMatch(new RegExp(`AS ${alias}\\b`));
    }
  });

  it('(user_id, findings_id, period_no) 唯一；兩支外鍵都是 CASCADE', () => {
    const b = block(schema);
    expect(b).toContain('UNIQUE KEY `uniq_user_findings_period` (`user_id`, `findings_id`, `period_no`)');
    expect(b.match(/ON DELETE CASCADE/g)).toHaveLength(2);
  });
});
