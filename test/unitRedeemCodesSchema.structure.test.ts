import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/** 單位層的兌換碼（#124）：redeem_batches 加 company_id、referrer_id 放寬；遷移只加不刪、可重跑，schema 同一件事。 */
const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const migration = read('deploy/migrations/2026-11-24-unit-redeem-codes.sql');
const schema = read('deploy/schema.sql');
const block = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS `redeem_batches`'), schema.indexOf('ENGINE=InnoDB', schema.indexOf('CREATE TABLE IF NOT EXISTS `redeem_batches`')));

describe('遷移', () => {
  it('只加不刪：沒有 DROP；唯一的 MODIFY 是把 referrer_id 放寬成 NULL', () => {
    expect(migration).not.toMatch(/DROP /);
    expect(migration.match(/MODIFY COLUMN[^;]*;/g)).toEqual(['MODIFY COLUMN `referrer_id` INT UNSIGNED NULL;']);
  });

  it('可重跑：加欄、索引、外鍵之前都先看 information_schema', () => {
    for (const name of ["COLUMN_NAME = 'company_id'", "INDEX_NAME = 'idx_redeem_batches_company'", "CONSTRAINT_NAME = 'fk_redeem_batches_company'"]) {
      expect(migration).toContain(name);
    }
  });
});

describe('schema', () => {
  it('referrer_id 可為 NULL、有 company_id、索引與外鍵（單位刪掉碼一起刪，同推薦人）', () => {
    expect(block).toContain('`referrer_id` INT UNSIGNED NULL,');
    expect(block).toContain('`company_id` INT UNSIGNED NULL,');
    expect(block).toContain('INDEX `idx_redeem_batches_company` (`company_id`)');
    expect(block).toContain('FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE');
  });
});
