import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/** 優惠券綁推薦人（2026-11-25）：coupon_batches 加 referrer_id、改派紀錄的原因加 coupon；遷移只加不刪、可重跑，schema 同一件事。 */
const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const migration = read('deploy/migrations/2026-11-25-coupon-referrer.sql');
const schema = read('deploy/schema.sql');
const tableBlock = (name: string) => {
  const start = schema.indexOf(`CREATE TABLE IF NOT EXISTS \`${name}\``);
  return schema.slice(start, schema.indexOf('ENGINE=InnoDB', start));
};

describe('遷移', () => {
  it('只加不刪：沒有 DROP；唯一的 MODIFY 是在 reason 的 ENUM 最後加 coupon', () => {
    expect(migration).not.toMatch(/DROP /);
    expect(migration.match(/MODIFY COLUMN[^;]*;/g)).toEqual([
      "MODIFY COLUMN `reason` ENUM('link','code','admin','migration','coupon') NOT NULL;",
    ]);
  });

  it('可重跑：加欄、索引、外鍵之前都先看 information_schema', () => {
    for (const name of ["COLUMN_NAME = 'referrer_id'", "INDEX_NAME = 'idx_coupon_batches_referrer'", "CONSTRAINT_NAME = 'fk_coupon_batches_referrer'"]) {
      expect(migration).toContain(name);
    }
  });
});

describe('schema', () => {
  it('coupon_batches 有可為 NULL 的 referrer_id、索引、推薦人刪掉留 NULL', () => {
    const block = tableBlock('coupon_batches');
    expect(block).toContain('`referrer_id` INT UNSIGNED NULL,');
    expect(block).toContain('INDEX `idx_coupon_batches_referrer` (`referrer_id`)');
    expect(block).toContain('FOREIGN KEY (`referrer_id`) REFERENCES `referrers` (`id`) ON DELETE SET NULL');
  });

  it('改派紀錄的原因與 CHANGE_REASONS 同一組、同一個順序', async () => {
    const { CHANGE_REASONS } = await import('../src/serviceRelations/rules');
    expect(tableBlock('service_relation_changes')).toContain(`\`reason\` ENUM(${CHANGE_REASONS.map(r => `'${r}'`).join(',')}) NOT NULL,`);
  });
});
