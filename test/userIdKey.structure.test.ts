import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 資料層的識別鍵護欄（#15）。
 *
 * 這次改動的整個價值就是一句話：**電子郵件下線時，資料層不必跟著動。**
 * 那句話有沒有成立，型別檢查看不出來 —— 明天有人寫一個
 * `getReportHistoryByEmail`，所有測試照樣全綠，而電子郵件下線的那一天它會
 * 安靜地壞掉，症狀是家長做完一次篩查什麼都沒存到。
 *
 * 所以這裡把它變成一個看得見的動作：想讓資料層再收一次電子郵件，得先來改
 * 這個檔案的允許清單。寫法參照 `test/adminScope.structure.test.ts`。
 */

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = 'src/db/mysql.ts';

/**
 * 唯一允許收電子郵件的函式，每一個都要寫明理由。
 *
 * 共同點：它們都是**登入那一刻**把外部憑據換成帳號用的，一次登入只走一次。
 * 手機號登入上線時，要換的是這一族；其餘每一個函式都以使用者 id 為鍵，一個字
 * 都不必動。
 */
const EMAIL_ALLOWLIST: Record<string, string> = {
  findUserByEmail: '電子郵件登入的查帳號那一步。手機號登入上線後由同族的 findUserByPhone 取代。',
  createUser: '建立帳號時電子郵件是被寫入的欄位之一，不是用來找資料的鍵。',
};

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
    // users 表以外的查詢一律不該出現 email 條件；users 表自己的那一句
    // （findUserByEmail）是登入的入口，在允許清單裡。
    const emailConditions = sql.match(/WHERE[^;]*?\bemail\s*=/gi) ?? [];
    expect(emailConditions).toHaveLength(1);
    expect(sql).toContain('SELECT * FROM users WHERE email = ?');
  });
});
