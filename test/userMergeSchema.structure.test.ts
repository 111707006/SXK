import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { PHONE_UNIQUE_STATEMENTS } from '../deploy/userMerge.mjs';

/**
 * 合併重複帳號（#116）：停用欄位兩個庫都加、手機號唯一只在 A。
 * schema、遷移與程式碼必須說同一件事（前例 test/handoffSchema.structure.test.ts）。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const schema = read('deploy/schema.sql');
const MIGRATION = 'deploy/migrations/2026-11-23-users-merged.sql';
const migration = read(MIGRATION);
/** 只看 SQL，不看註解（與 deploy/migrate.mjs 同一個切法：拿掉 `--` 開頭的整行）。 */
const sqlOnly = (sql: string) => sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

function usersBlock(sql: string): string {
  const start = sql.indexOf('CREATE TABLE IF NOT EXISTS `users`');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
}

describe('users 的停用欄位（A、B 兩個庫）', () => {
  const COLUMNS = ['`disabled_at` DATETIME NULL', '`merged_into` INT UNSIGNED NULL'];

  it.each(COLUMNS)('schema 有 %s，遷移加的是同一個定義', col => {
    expect(usersBlock(schema)).toContain(col);
    expect(migration).toContain(`ADD COLUMN ${col}`);
  });

  it('遷移只加不刪，驗證句照 migrate.mjs 的命名約定', () => {
    expect(sqlOnly(migration)).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b/i);
    expect(migration).toMatch(/AS users_disabled_at_ok/);
    expect(migration).toMatch(/AS users_merged_into_ok/);
  });
});

describe('手機號唯一只在 A', () => {
  it('唯一鍵不在共用的 schema 與 deploy/migrations（migrate.mjs 會在 B 跑那裡的每一份）', () => {
    expect(sqlOnly(usersBlock(schema))).not.toContain('uk_a_active_phone');
    for (const name of fs.readdirSync(path.join(ROOT, 'deploy/migrations'))) {
      if (name.endsWith('.sql')) expect(sqlOnly(read(`deploy/migrations/${name}`))).not.toContain('uk_a_active_phone');
    }
  });

  it('B 的（歸屬，手機號）唯一照舊', () => {
    expect(usersBlock(schema)).toContain('UNIQUE KEY `uk_company_phone` (`company_key`, `phone`)');
  });

  it('A 的唯一鍵建在「停用的帳號是 NULL」的生成欄位上（停用的帳號不佔號）', () => {
    expect(PHONE_UNIQUE_STATEMENTS.join('\n')).toContain('AS (IF(`disabled_at` IS NULL, `phone`, NULL)) VIRTUAL');
    expect(PHONE_UNIQUE_STATEMENTS.join('\n')).toContain('ADD UNIQUE KEY `uk_a_active_phone` (`active_phone`)');
  });

  it('合併腳本不在專案 A 以外的環境跑', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-phones-'));
    const env = { ...process.env, APP_MODE: 't1only', MYSQL_HOST: '', MYSQL_USER: '', MYSQL_PASSWORD: '', MYSQL_DATABASE: '' };
    const r = spawnSync(process.execPath, [path.join(ROOT, 'deploy/merge-duplicate-phones.mjs')], { cwd, env, encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('APP_MODE');
  });
});

describe('被停用的帳號登不進來', () => {
  const mysqlTs = read('src/db/mysql.ts');
  const fn = mysqlTs.slice(mysqlTs.indexOf('export async function findUserByPhone'), mysqlTs.indexOf('export async function createPhoneUser'));

  it('登入查帳號：找到被併掉的帳號就換成它併入的那一個，停用的帳號一律不回', () => {
    expect(fn).toContain('COALESCE(f.merged_into, f.id)');
    expect(fn).toContain('u.disabled_at IS NULL');
  });
});

describe('身分開關的手機號查法也不回停用的帳號（#115 × #116 整合缺口，HANDOFF.md 第 1 點）', () => {
  const mysqlTs = read('src/db/mysql.ts');
  const fn = mysqlTs.slice(mysqlTs.indexOf('export async function listUsersByPhone'), mysqlTs.indexOf('export async function createPhoneUser'));

  it('listUsersByPhone 只回 disabled_at IS NULL 的帳號（被併掉的帳號都停用了，保留者是同一支手機）', () => {
    expect(fn).toContain('u.disabled_at IS NULL');
  });
});
