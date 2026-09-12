import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * `unlocks` 與 `payments` 的形狀 —— schema 與遷移必須說同一件事（票 #45）。
 *
 * 【為什麼是結構測試】
 * 這個專案的測試連不到資料庫（`vitest` 跑在記憶體模式），所以「欄位真的加上去了」
 * 沒有任何測試證明得了。證得了的是**兩份 SQL 有沒有講同一件事**：
 * 全新的庫從 `schema.sql` 建，既有的庫靠 `migrations/` 追上去，兩者一旦分岔，
 * 正式站與開發機會長成兩種資料庫，而那種差異只會在上線當天才被發現。
 *
 * 遷移本身的正確性由它結尾的驗證 SELECT 顧（`migrate.mjs` 會跑）。
 */

const ROOT = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(ROOT, 'deploy/schema.sql'), 'utf8');
const migration = fs.readFileSync(
  path.join(ROOT, 'deploy/migrations/2026-09-11-unlock-scope.sql'),
  'utf8'
);

/** 只取某一張表的 CREATE TABLE 區塊，避免在別張表上誤判。 */
function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('ENGINE=InnoDB', start);
  return sql.slice(start, end);
}

describe('schema.sql：權益分 t2／t3', () => {
  const unlocks = tableBlock(schema, 'unlocks');

  it('unlocks 有 scope，兩個值', () => {
    expect(unlocks).toMatch(/`scope` ENUM\('t2','t3'\) NOT NULL/);
  });

  it('unlocks.dimension_id 可以是 NULL —— t2 的列沒有維度', () => {
    expect(unlocks).toMatch(/`dimension_id` VARCHAR\(64\) DEFAULT NULL/);
  });

  /**
   * 這一條擋的是很具體的一種壞法：`dimension_id` 一改成可 NULL，
   * 原本的 `UNIQUE (user_id, dimension_id)` 對 t2 就完全失效 ——
   * MySQL 的唯一鍵不管 NULL，同一位家長可以有無限多列 t2 權益。
   * 而那個唯一鍵正是微信回調重送時「不再發第二份」的那道保證。
   */
  it('唯一鍵認得 scope，也認得 NULL', () => {
    expect(unlocks).toMatch(
      /`entitlement_key` VARCHAR\(64\) AS \(IFNULL\(`dimension_id`, '\*'\)\) STORED/
    );
    expect(unlocks).toContain(
      "UNIQUE KEY `uk_user_scope_entitlement` (`user_id`, `scope`, `entitlement_key`)"
    );
  });

  it('舊的那一把唯一鍵不在了', () => {
    expect(unlocks).not.toContain('uk_user_dimension');
  });
});

describe('schema.sql：付款也要記得買的是什麼', () => {
  const payments = tableBlock(schema, 'payments');

  /**
   * 結算時唯一知道「這筆買的是什麼」的地方就是付款那一列（`settlePayment`
   * 只拿得到訂單號）。少了它，T2 的付款只能結算成一筆 t3 權益 ——
   * 家長付了錢卻打不開 T2。
   */
  it('payments 有 scope，dimension_id 可以是 NULL', () => {
    expect(payments).toMatch(/`scope` ENUM\('t2','t3'\) NOT NULL/);
    expect(payments).toMatch(/`dimension_id` VARCHAR\(64\) DEFAULT NULL/);
  });
});

describe('遷移與 schema 講的是同一件事', () => {
  it.each([
    '`unlocks`',
    '`payments`',
    '`scope`',
    '`entitlement_key`',
    '`uk_user_scope_entitlement`',
  ])('遷移裡提到 %s', identifier => {
    expect(migration).toContain(identifier);
  });

  it('遷移把既有列標成 t3 —— 它們是按維度買的', () => {
    expect(migration).toMatch(/UPDATE `unlocks` SET `scope` = 't3'/);
  });

  it('遷移把舊的唯一鍵拿掉', () => {
    expect(migration).toContain('DROP INDEX `uk_user_dimension`');
  });
});
