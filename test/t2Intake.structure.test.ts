import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DIAGNOSIS_OPTIONS } from '../src/t2/diagnosisOptions';

/**
 * `t2_intake` 的形狀 —— schema、遷移與型別必須說同一件事（票 #56）。
 *
 * 寫法比照 `unlockScope.structure.test.ts`：測試連不到資料庫，證得了的是**三份東西有沒有
 * 講同一件事**。全新的庫從 `schema.sql` 建，既有的庫靠 `migrations/` 追上去；ENUM 的十個值
 * 則要與 `DiagnosisDirection`（規格 §4.3）逐字相同 —— 型別多一個、資料庫少一個，
 * 家長選的那一個會在 INSERT 時被 MySQL 截成空字串而沒有任何錯誤。
 */

const ROOT = path.resolve(__dirname, '..');
/** 工作目錄裡 CRLF／LF 混著（autocrlf），比對前折掉 —— 比的是 SQL，不是換行符。 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const migration = read('deploy/migrations/2026-09-12-t2-intake.sql');

/** 只取某一張表的 CREATE TABLE 區塊。 */
function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('ENGINE=InnoDB', start);
  return sql.slice(start, end);
}

const ENUM_LITERAL = `ENUM(${DIAGNOSIS_OPTIONS.map(o => `'${o.value}'`).join(',')})`;

describe('t2_intake', () => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, 't2_intake')).toBe(tableBlock(schema, 't2_intake'));
  });

  it('diagnosis_direction 的 ENUM 就是 §4.3 的十個代號，可以是 NULL（未告知）', () => {
    const block = tableBlock(schema, 't2_intake');
    expect(block).toContain(`\`diagnosis_direction\` ${ENUM_LITERAL} DEFAULT NULL`);
  });

  it('一位家長一列（user_id 是主鍵），家長被刪時跟著走', () => {
    const block = tableBlock(schema, 't2_intake');
    expect(block).toContain('`user_id` INT UNSIGNED NOT NULL PRIMARY KEY');
    expect(block).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
  });

  it('遷移可以重跑、而且有照命名約定寫的驗證句', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS `t2_intake`');
    expect(migration).toMatch(/AS t2_intake_table_ok/);
    expect(migration).toMatch(/AS t2_intake_diagnosis_ok/);
  });
});
