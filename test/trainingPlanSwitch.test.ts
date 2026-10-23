import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * `TRAINING_PLAN`（#91）：要同時開 `TRAINING_PUSH_V3`，否則程序起不來；認不得的值起不來。
 * 遷移只加表，schema 與遷移的 CREATE TABLE 一字不差。
 */

afterAll(() => {
  process.env.TRAINING_PLAN = '';
  process.env.TRAINING_PUSH_V3 = '';
});

describe('TRAINING_PLAN 的值', () => {
  it('沒開 TRAINING_PUSH_V3：server.ts 載入失敗', async () => {
    process.env.TRAINING_PLAN = '1';
    process.env.TRAINING_PUSH_V3 = '';
    await expect(import('../server')).rejects.toThrow(/TRAINING_PLAN=1 需要同時設 TRAINING_PUSH_V3=1/);
  }, 60_000);
});

describe('training_passes 的 schema 與遷移', () => {
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const block = (sql: string) => {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS `training_passes`');
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
  };

  it('一字不差、遷移只加表、家長硬刪連帶刪', () => {
    const migration = read('deploy/migrations/2026-10-23-training-passes.sql');
    expect(block(migration)).toBe(block(read('deploy/schema.sql')));
    expect(migration).not.toMatch(/ALTER TABLE|DROP /);
    expect(block(migration)).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    expect(block(migration)).toContain("`source` ENUM('payment','code','proxy','t2_bonus') NOT NULL");
  });
});
