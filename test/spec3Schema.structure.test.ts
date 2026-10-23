import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 規格三的新表（#93 推薦人、#110 兌換碼）：schema 與遷移的 CREATE TABLE 一字不差；遷移只加（admin_users 只加列舉值）。
 */
const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');

function block(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start, table).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
}

describe.each([
  ['deploy/migrations/2026-10-23-referrers.sql', ['referrers', 'referrer_bindings']],
  ['deploy/migrations/2026-10-24-redeem-codes.sql', ['redeem_batches', 'redeem_codes']],
] as const)('%s', (file, tables) => {
  const migration = read(file);

  it.each(tables)('%s 與 schema 一字不差', table => {
    expect(block(migration, table)).toBe(block(schema, table));
  });

  it('只加不刪', () => {
    expect(migration).not.toMatch(/DROP /);
    const alters = migration.match(/ALTER TABLE[^;]*;/g) ?? [];
    for (const a of alters) expect(a).toMatch(/MODIFY COLUMN `role` ENUM\('global_admin','company_member','referrer'\)/);
  });
});

describe('admin_users 的角色', () => {
  it('schema 有 referrer', () => {
    expect(block(schema, 'admin_users')).toContain("`role` ENUM('global_admin','company_member','referrer') NOT NULL");
  });
});

describe('兌換碼', () => {
  it('碼唯一、明碼 CHAR(10)、狀態三種', () => {
    const b = block(schema, 'redeem_codes');
    expect(b).toContain('`code` CHAR(10) NOT NULL');
    expect(b).toContain('UNIQUE KEY `uk_redeem_codes_code` (`code`)');
    expect(b).toContain("`status` ENUM('unused','used','void') NOT NULL DEFAULT 'unused'");
  });
});
