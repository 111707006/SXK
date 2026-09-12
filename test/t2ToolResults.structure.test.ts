import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RATERS } from '../src/t2/types';
import { TOOL_IDS } from '../src/t2/toolkit';

/**
 * `t2_tool_results` 的形狀 —— schema、遷移與型別必須說同一件事（票 #57，規格 §9.1）。
 *
 * 寫法比照 `t2Intake.structure.test.ts`：測試連不到資料庫，證得了的是**三份東西有沒有講同一件事**。
 * 全新的庫從 `schema.sql` 建，既有的庫靠 `migrations/` 追上去；`rater` 的 ENUM 要與 `RATERS`
 * 逐字相同 —— 型別多一個、資料庫少一個，家長選的那一個會在 INSERT 時被 MySQL 截成空字串
 * 而沒有任何錯誤（strict mode 關著的話），或整筆交卷 500（開著的話）。
 */

const ROOT = path.resolve(__dirname, '..');
/** 工作目錄裡 CRLF／LF 混著（autocrlf），比對前折掉 —— 比的是 SQL，不是換行符。 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const migration = read('deploy/migrations/2026-09-12-t2-tool-results.sql');

/** 只取某一張表的 CREATE TABLE 區塊。 */
function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('ENGINE=InnoDB', start);
  return sql.slice(start, end);
}

const RATER_ENUM = `ENUM(${RATERS.map(r => `'${r}'`).join(',')})`;

describe('t2_tool_results', () => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, 't2_tool_results')).toBe(tableBlock(schema, 't2_tool_results'));
  });

  it('rater 的 ENUM 就是 RATERS 的五個值，不可為 NULL', () => {
    const block = tableBlock(schema, 't2_tool_results');
    expect(block).toContain(`\`rater\` ${RATER_ENUM} NOT NULL`);
  });

  it('§9.1 的欄位都在；四個 JSON 欄位都是 JSON 型別', () => {
    const block = tableBlock(schema, 't2_tool_results');
    for (const col of ['id', 'user_id', 'child_snapshot', 'tool_id', 'toolkit_version', 'assessed_age_month', 'rater', 'pre', 'answers', 'result', 'created_at']) {
      expect(block).toContain(`\`${col}\``);
    }
    for (const col of ['child_snapshot', 'pre', 'answers', 'result']) {
      expect(block).toMatch(new RegExp(`\`${col}\` JSON NOT NULL`));
    }
  });

  it('每次交卷一筆：主鍵是自增 id，user_id 上沒有唯一鍵', () => {
    const block = tableBlock(schema, 't2_tool_results');
    expect(block).toContain('`id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY');
    expect(block).not.toMatch(/UNIQUE/);
  });

  it('tool_id 裝得下 22 支工具的代號', () => {
    const block = tableBlock(schema, 't2_tool_results');
    const width = Number(/`tool_id` VARCHAR\((\d+)\)/.exec(block)?.[1]);
    expect(width).toBeGreaterThanOrEqual(Math.max(...TOOL_IDS.map(id => id.length)));
  });

  it('家長被刪時跟著走；讀取按 user_id 有索引', () => {
    const block = tableBlock(schema, 't2_tool_results');
    expect(block).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
    expect(block).toMatch(/INDEX `\w+` \(`user_id`/);
  });

  it('遷移可以重跑、而且有照命名約定寫的驗證句', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS `t2_tool_results`');
    expect(migration).toMatch(/AS t2_tool_results_table_ok/);
    expect(migration).toMatch(/AS t2_tool_results_result_ok/);
    expect(migration).toMatch(/AS t2_tool_results_fk_ok/);
  });
});
