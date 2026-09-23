import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CHECKIN_MOODS, REMINDER_TIMES } from '../src/t2/practice';

/**
 * `t2_checkins`、`t2_practice_prefs` 的形狀 —— schema、遷移與型別必須說同一件事（Keep 規格 §4.4）。
 *
 * 寫法比照 `t2ToolResults.structure.test.ts`：測試連不到資料庫，證得了的是**三份東西有沒有講同一件事**。
 * 全新的庫從 `schema.sql` 建，既有的庫靠 `migrations/` 追上去；`mood` 的 ENUM 要與 `CHECKIN_MOODS`
 * 逐字相同 —— 型別多一個、資料庫少一個，家長選的心情會在 UPDATE 時被截成空字串（strict mode 關著）
 * 或整筆 500（開著）。
 */

const ROOT = path.resolve(__dirname, '..');
/** 工作目錄裡 CRLF／LF 混著（autocrlf），比對前折掉 —— 比的是 SQL，不是換行符。 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const migration = read('deploy/migrations/2026-09-24-t2-checkins.sql');

/** 只取某一張表的 CREATE TABLE 區塊。 */
function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('ENGINE=InnoDB', start);
  return sql.slice(start, end);
}

describe('t2_checkins', () => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, 't2_checkins')).toBe(tableBlock(schema, 't2_checkins'));
  });

  it('mood 的 ENUM 就是 CHECKIN_MOODS 的三個值，可以是 NULL（選填）', () => {
    const block = tableBlock(schema, 't2_checkins');
    expect(block).toContain(`\`mood\` ENUM(${CHECKIN_MOODS.map(m => `'${m}'`).join(',')}) NULL`);
  });

  it('§4.4 的欄位都在：日期是 DATE、progress 是 JSON、findings_id 可為 NULL', () => {
    const block = tableBlock(schema, 't2_checkins');
    expect(block).toContain('`id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY');
    expect(block).toContain('`activity_id` VARCHAR(8) NOT NULL');
    expect(block).toContain('`findings_id` BIGINT UNSIGNED NULL');
    expect(block).toContain('`checkin_date` DATE NOT NULL');
    expect(block).toContain('`week_start` DATE NOT NULL');
    expect(block).toContain('`progress` JSON NOT NULL');
  });

  it('做完一次記一筆：沒有唯一鍵（同一支活動一天可以打好幾次）', () => {
    expect(tableBlock(schema, 't2_checkins')).not.toMatch(/UNIQUE/);
  });

  it('家長被刪時跟著走；查一段日期有 (user_id, checkin_date) 的索引', () => {
    const block = tableBlock(schema, 't2_checkins');
    expect(block).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    expect(block).toContain('INDEX `idx_user_date` (`user_id`, `checkin_date`)');
  });
});

describe('t2_practice_prefs', () => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, 't2_practice_prefs')).toBe(tableBlock(schema, 't2_practice_prefs'));
  });

  it('一位家長一列，家長被刪時跟著走', () => {
    const block = tableBlock(schema, 't2_practice_prefs');
    expect(block).toContain('`user_id` INT UNSIGNED NOT NULL PRIMARY KEY');
    expect(block).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
  });

  it('reminder_time 裝得下四個時間（HH:MM），可以是 NULL（還沒設）', () => {
    const block = tableBlock(schema, 't2_practice_prefs');
    const width = Number(/`reminder_time` CHAR\((\d+)\) NULL/.exec(block)?.[1]);
    for (const t of REMINDER_TIMES) expect(t.length).toBeLessThanOrEqual(width);
    expect(block).toContain('`reminder_days` JSON NOT NULL');
  });
});

describe('遷移', () => {
  it('可以重跑，而且有照命名約定寫的驗證句（deploy/migrate.mjs 認 _ok）', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS `t2_checkins`');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS `t2_practice_prefs`');
    expect(migration).not.toMatch(/^\s*(ALTER|DROP|DELETE|UPDATE)\b/im);
    for (const alias of [
      't2_checkins_table_ok',
      't2_checkins_progress_ok',
      't2_checkins_index_ok',
      't2_checkins_fk_ok',
      't2_practice_prefs_table_ok',
      't2_practice_prefs_fk_ok',
    ]) {
      expect(migration).toMatch(new RegExp(`AS ${alias}\\b`));
    }
  });
});
