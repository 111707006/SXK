import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 資料層的識別鍵護欄（#15，於 #27 收緊）。
 *
 * #15 的整個價值是一句話：**電子郵件下線時，資料層不必跟著動。**#27 把電子郵件
 * 登入真的下線了，那句話兌現了 —— 這個檔案唯一的改動就是把允許清單清空。
 *
 * 這條護欄留著的理由不變，只是門檻更高了：明天有人寫一個
 * `getReportHistoryByEmail`，型別檢查看不出來，所有測試照樣全綠，而那個函式
 * 是走回一條已經不存在的路。想這麼做，得先來改這個檔案的允許清單，
 * 而現在那份清單是空的。寫法參照 `test/adminScope.structure.test.ts`。
 */

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = 'src/db/mysql.ts';

/**
 * 允許收電子郵件的函式 —— **#27 之後一個都沒有。**
 *
 * 這裡曾經有兩個（`findUserByEmail` / `createUser`），共同點是「登入那一刻把
 * 外部憑據換成帳號」。電子郵件登入下線之後那一步由 `findUserByPhone` /
 * `createPhoneUser` 承接，兩者收的都不是電子郵件。
 *
 * 要往回加，每一個都要在這裡寫明理由 —— 而理由得先解釋這個系統為什麼又收得到
 * 一個沒有任何入口會產生的值。
 */
const EMAIL_ALLOWLIST: Record<string, string> = {};

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例不該被當成真的程式碼。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

interface ExportedFn {
  name: string;
  params: string;
}

function exportedFunctions(source: string): ExportedFn[] {
  const out: ExportedFn[] = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([\s\S]*?)\)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push({ name: m[1], params: m[2] });
  }
  return out;
}

describe('資料層以使用者 id 為鍵（#15）', () => {
  const fns = exportedFunctions(stripComments(read(DB_PATH)));

  it('掃得到函式 —— 掃不到的話下面每一條都是空跑', () => {
    expect(fns.length).toBeGreaterThan(10);
    expect(fns.map(f => f.name)).toContain('saveUserData');
  });

  it('允許清單以外的函式一律不收電子郵件', () => {
    const offenders = fns
      .filter(f => /\bemail\b/i.test(f.params))
      .map(f => f.name)
      .filter(name => !(name in EMAIL_ALLOWLIST));
    expect(offenders).toEqual([]);
  });

  it('孩子檔案與分數的讀寫都以使用者 id 為第一個參數', () => {
    for (const name of ['getUserDataByUserId', 'saveUserData']) {
      const fn = fns.find(f => f.name === name);
      expect(fn, `${name} 不存在`).toBeTruthy();
      expect(fn!.params.trim().startsWith('userId')).toBe(true);
    }
  });

  it('沒有任何一支查詢拿電子郵件去撈家長資料', () => {
    const sql = stripComments(read(DB_PATH));
    // #27 之前這裡容許一句（`findUserByEmail`，登入的入口）。那個入口不在了，
    // 於是這個數字是零 —— 資料層完全不認得電子郵件這個鍵。
    expect(sql.match(/WHERE[^;]*?\bemail\s*=/gi) ?? []).toEqual([]);
  });

  it('也不再寫入電子郵件與密碼 —— 欄位留著，但沒有程式碼碰它們', () => {
    // 欄位本身留在 `deploy/schema.sql` 裡（既有家長的資料不刪），
    // 但建帳號那一句只寫得進手機號與歸屬。
    const sql = stripComments(read(DB_PATH));
    expect(sql).not.toMatch(/INSERT\s+INTO\s+users\s*\([^)]*\bemail\b/i);
    expect(sql).not.toMatch(/UPDATE\s+users\s+SET\s+password/i);
  });
});
