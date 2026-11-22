import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CHANGE_ACTORS, CHANGE_REASONS } from '../src/serviceRelations/rules';

/**
 * 服務關係 `service_relations` 與改派紀錄 `service_relation_changes`（#118，ADR-0020）——
 * schema、遷移與規則模組必須說同一件事；遷移只加不刪。
 */

const ROOT = path.resolve(__dirname, '..');
/** 工作目錄裡 CRLF／LF 混著（autocrlf），比對前折掉。 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const migration = read('deploy/migrations/2026-11-23-service-relations.sql');

function tableBlock(sql: string, table: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS \`${table}\``);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
}

/** 去掉 `--` 註解行，剩下真正會執行的句子。 */
const statements = (sql: string) => sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

describe('遷移只加不刪', () => {
  it('只有兩張 CREATE TABLE IF NOT EXISTS，沒有 ALTER／DROP／UPDATE／DELETE', () => {
    // 外鍵的 ON DELETE／ON UPDATE 不是句子。
    const run = statements(migration).replace(/\bON (DELETE|UPDATE)\b/g, '');
    expect(run).not.toMatch(/\b(ALTER|DROP|UPDATE|DELETE|TRUNCATE|RENAME)\b/i);
    expect(run.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
  });

  it('驗證句兩張表都有', () => {
    expect(migration).toMatch(/TABLE_NAME = 'service_relations'/);
    expect(migration).toMatch(/TABLE_NAME = 'service_relation_changes'/);
  });
});

describe.each(['service_relations', 'service_relation_changes'])('%s', table => {
  it('schema 與遷移的 CREATE TABLE 一字不差', () => {
    expect(tableBlock(migration, table)).toBe(tableBlock(schema, table));
  });

  // ADR-0006：刪家長是硬刪，靠外鍵連帶刪掉家長資料。
  it('家長資料：外鍵 ON DELETE CASCADE', () => {
    expect(tableBlock(schema, table)).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\) ON DELETE CASCADE/);
  });
});

describe('service_relations：一位家長最多一列', () => {
  const block = () => tableBlock(schema, 'service_relations');

  it('家長是主鍵', () => {
    expect(block()).toContain('`user_id` INT UNSIGNED NOT NULL PRIMARY KEY,');
  });

  it('單位必填；推薦人可空（＝單位裡還沒標注）', () => {
    expect(block()).toContain('`company_id` INT UNSIGNED NOT NULL,');
    expect(block()).toContain('`referrer_id` INT UNSIGNED NULL,');
  });

  it('推薦人刪掉＝回到單位裡還沒標注，不是連家長的服務關係一起刪', () => {
    expect(block()).toMatch(/FOREIGN KEY \(`referrer_id`\) REFERENCES `referrers` \(`id`\) ON DELETE SET NULL/);
  });

  it('推薦人看自己的家長、單位管理者看全單位，都有索引', () => {
    expect(block()).toContain('INDEX `idx_service_relations_company` (`company_id`, `referrer_id`)');
    expect(block()).toContain('INDEX `idx_service_relations_referrer` (`referrer_id`)');
  });
});

describe('service_relation_changes：只增不改的紀錄', () => {
  const block = () => tableBlock(schema, 'service_relation_changes');

  it('改之前、改之後的單位與推薦人都可空（沒有關係／拿掉關係／還沒標注）', () => {
    for (const col of ['from_company_id', 'from_referrer_id', 'to_company_id', 'to_referrer_id']) {
      expect(block()).toContain(`\`${col}\` INT UNSIGNED NULL,`);
    }
  });

  it('紀錄不跟著單位或推薦人刪掉：那四欄沒有外鍵', () => {
    expect(block()).not.toMatch(/FOREIGN KEY \(`(from|to)_/);
  });

  it('誰改的、原因：ENUM 就是規則模組的那一組', () => {
    expect(block()).toContain(`\`actor\` ENUM(${CHANGE_ACTORS.map(k => `'${k}'`).join(',')}) NOT NULL,`);
    expect(block()).toContain(`\`reason\` ENUM(${CHANGE_REASONS.map(k => `'${k}'`).join(',')}) NOT NULL,`);
    expect(block()).toContain('`admin_user_id` INT UNSIGNED NULL,');
  });

  it('沒有 updated_at：紀錄寫了就不改', () => {
    expect(block()).not.toContain('updated_at');
  });
});
