import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { HANDOFF_KINDS } from '../src/handoff/core';

/**
 * `handoff_codes`、`handoff_imports` 的形狀（ADR-0009、docs/specs/b-to-a-handoff.md §3）——
 * schema、遷移與程式碼必須說同一件事。
 */

const ROOT = path.resolve(__dirname, '..');
/** 工作目錄裡 CRLF／LF 混著（autocrlf），比對前折掉 —— 比的是 SQL，不是換行符。 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const migration = read('deploy/migrations/2026-09-28-handoffs.sql');

function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('ENGINE=InnoDB', start);
  return sql.slice(start, end);
}

describe.each(['handoff_codes', 'handoff_imports'])('%s', table => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, table)).toBe(tableBlock(schema, table));
  });

  it('kind 的 ENUM 就是 HANDOFF_KINDS', () => {
    expect(tableBlock(schema, table)).toContain(`\`kind\` ENUM(${HANDOFF_KINDS.map(k => `'${k}'`).join(',')}) NOT NULL`);
  });

  // ADR-0006：刪家長是硬刪，靠外鍵連帶刪掉這兩張表的列。
  it('家長資料：外鍵 ON DELETE CASCADE', () => {
    expect(tableBlock(schema, table)).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
  });
});

describe('handoff_codes', () => {
  it('只存雜湊（CHAR(64)、唯一），沒有放明碼的欄位', () => {
    const block = tableBlock(schema, 'handoff_codes');
    expect(block).toContain('`code_hash` CHAR(64) NOT NULL');
    expect(block).toContain('UNIQUE KEY `uk_handoff_code_hash` (`code_hash`)');
    expect(block).not.toMatch(/`code` /);
  });
});
