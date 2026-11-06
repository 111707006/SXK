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
  ['deploy/migrations/2026-11-07-t2-coupons.sql', ['coupon_batches', 'coupon_codes']],
  ['deploy/migrations/2026-11-07-revenue-split.sql', ['revenue_split_rates']],
] as const)('%s', (file, tables) => {
  const migration = read(file);

  it.each(tables)('%s 與 schema 一字不差', table => {
    expect(block(migration, table)).toBe(block(schema, table));
  });

  it('只加不刪', () => {
    expect(migration).not.toMatch(/DROP /);
    const alters = migration.match(/ALTER TABLE[^;]*;/g) ?? [];
    for (const a of alters) expect(a).toMatch(/MODIFY COLUMN `role` ENUM\('global_admin','company_member','referrer'\)|ADD COLUMN `(coupon_code_id|list_amount_fen)` INT UNSIGNED NULL|ADD COLUMN `split_snapshot` JSON NULL/);
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

describe('T2 優惠券（客戶 11/03）', () => {
  it('每位家長只能用一張：used_by 是 UNIQUE', () => {
    const b = block(schema, 'coupon_codes');
    expect(b).toContain('UNIQUE KEY `uk_coupon_codes_used_by` (`used_by`)');
    expect(b).toContain('UNIQUE KEY `uk_coupon_codes_code` (`code`)');
  });

  it('預設半價', () => {
    const b = block(schema, 'coupon_batches');
    expect(b).toContain("`discount_kind` ENUM('percent','amount') NOT NULL DEFAULT 'percent'");
    expect(b).toContain('`discount_value` INT UNSIGNED NOT NULL DEFAULT 50');
  });

  it('payments 的兩個新欄在 schema 與遷移裡都有、都可為 NULL', () => {
    const pay = block(schema, 'payments');
    const migration = read('deploy/migrations/2026-11-07-t2-coupons.sql');
    for (const col of ['coupon_code_id', 'list_amount_fen']) {
      expect(pay).toContain(`\`${col}\` INT UNSIGNED NULL,`);
      expect(migration).toContain(`ADD COLUMN \`${col}\` INT UNSIGNED NULL`);
    }
  });
});

describe('清分（客戶 11/03，ADR-0016）', () => {
  it('比例一組（scope, ref_id）一列、可為 NULL（沿用上一層）', () => {
    const b = block(schema, 'revenue_split_rates');
    expect(b).toContain('PRIMARY KEY (`scope`, `ref_id`)');
    expect(b).toContain('`platform_bp` SMALLINT UNSIGNED NULL,');
    expect(b).toContain('`company_bp` SMALLINT UNSIGNED NULL,');
  });

  it('payments.split_snapshot 在 schema 與遷移裡都有、可為 NULL', () => {
    expect(block(schema, 'payments')).toContain('`split_snapshot` JSON NULL,');
    expect(read('deploy/migrations/2026-11-07-revenue-split.sql')).toContain('ADD COLUMN `split_snapshot` JSON NULL');
  });
});
