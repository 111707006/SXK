import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 原始碼結構護欄。
 *
 * 這不是接縫測試，但沒有它，前面兩組測試可以完美通過而系統照樣外洩：
 * `resolveCompanyCondition` 可以被釘得毫無破綻，而某一支路由自己下一句
 * 撈 users 的查詢就把別家公司的孩子送出去了。**條件正確**與**條件有被用到**
 * 是兩件事，後者型別檢查擋不住。
 *
 * 寫法參照 `test/dimensionIds.test.ts` —— 它存在的理由同樣是「型別檢查擋不住
 * 散在多處的字串」。
 */

const ROOT = path.resolve(__dirname, '..');
const STORE_PATH = 'src/admin/adminStore.ts';
const ROUTES_PATH = 'src/admin/routes.ts';

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例不該被當成真的程式碼。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** 家長資料所在的表。碰到它們的查詢一定要帶公司條件。 */
const SCOPED_TABLES = ['users', 'user_data', 'expert_bookings', 'specialists'];

/**
 * 不帶公司條件的表，每一張都要寫明為什麼它不是家長資料。
 *
 * 有這份清單，「新開一張表而忘了想公司條件」就會是一個測試失敗，而不是一件
 * 沒有人注意到的事 —— 上面那組 `SCOPED_TABLES` 只擋得住已知的四張表，
 * 第五張表可以完全不帶條件地溜過去。
 */
const GLOBAL_TABLES: Record<string, string> = {
  companies: '合作公司本身的名冊。誰看得到由路由層的 requireGlobal 決定，不是公司條件。',
  admin_users: '後台成員，不是家長。只有全域管理員碰得到。',
  admin_company_switches: '切換紀錄。寫入的是檢視者自己的行為，不是任何一位家長的資料。',
  intervention_materials:
    '干預素材庫（issue #20）。是森心康的干預內容，不屬於任何一家合作公司，' +
    '也不含任何一位家長的資料；路由層限定全域管理員。',
};

/**
 * 唯一允許不帶 `${scope.sql}` 的函式，每一個都要寫明理由。
 *
 * 這份清單本身就是護欄的一部分：想再開一個例外，必須先來改這個檔案，
 * 而那是一個看得見的動作 —— 不像少寫一個 WHERE 那樣沒有痕跡。
 */
const CROSS_SCOPE_ALLOWLIST: Record<string, string> = {
  summaryByCompany:
    '跨公司彙總。合法地跨越公司邊界，但只回統計數字，不回任何個別家長；' +
    '路由層限定全域管理員。',
  createSpecialist:
    'INSERT 的 company_id 直接取自條件本身（函式開頭已把 kind !== "company" 擋掉），' +
    '寫不進別家公司。',
};

/**
 * 把每一句 `p.execute(...)` 的第一個引數，歸到它所在的那個匯出函式。
 *
 * 用括號配對而不是正則抓整段呼叫：SQL 裡有 `(` `)`（子查詢、COUNT），
 * 正則會在第一個右括號就停下來，於是漏掉的條件剛好落在被截掉的那一半。
 */
function extractExecuteCalls(source: string): Array<{ fn: string; sql: string }> {
  const fnStarts: Array<{ name: string; at: number }> = [];
  const fnRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(source)) !== null) fnStarts.push({ name: m[1], at: m.index });

  const enclosing = (offset: number): string => {
    let name = '(top-level)';
    for (const f of fnStarts) {
      if (f.at <= offset) name = f.name;
      else break;
    }
    return name;
  };

  const out: Array<{ fn: string; sql: string }> = [];
  const marker = '.execute(';
  let idx = source.indexOf(marker);
  while (idx !== -1) {
    let i = idx + marker.length;
    let depth = 1;
    let inBacktick = false;
    let inSingle = false;
    const start = i;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      const prev = source[i - 1];
      if (ch === '`' && prev !== '\\') inBacktick = !inBacktick;
      else if (ch === "'" && prev !== '\\' && !inBacktick) inSingle = !inSingle;
      else if (!inBacktick && !inSingle) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      i++;
    }
    out.push({ fn: enclosing(idx), sql: source.slice(start, i - 1) });
    idx = source.indexOf(marker, i);
  }
  return out;
}

const storeSource = stripComments(read(STORE_PATH));
const calls = extractExecuteCalls(storeSource);

describe('後台的每一句家長查詢都帶公司條件', () => {
  it('確實抓到了查詢（護欄本身沒有壞掉）', () => {
    // 沒有這一條，把 adminStore 改寫成別的呼叫方式會讓下面每一條測試「零筆全過」。
    expect(calls.length).toBeGreaterThanOrEqual(10);
    expect(calls.every(c => c.fn !== '(top-level)')).toBe(true);
  });

  it.each(SCOPED_TABLES)('凡是碰到 %s 的查詢，都內插了 companyWhereSql 的片段', table => {
    const touches = new RegExp(`\\b(FROM|JOIN|UPDATE|INTO)\\s+\`?${table}\`?\\b`, 'i');
    const offenders = calls.filter(
      c => touches.test(c.sql)
        && !c.sql.includes('${scope.sql}')
        && !(c.fn in CROSS_SCOPE_ALLOWLIST)
    );

    expect(
      offenders.map(o => `${o.fn}: ${o.sql.replace(/\s+/g, ' ').slice(0, 120)}`),
      `以下查詢碰了 ${table} 卻沒有帶公司條件，也不在例外清單裡`
    ).toEqual([]);
  });

  /**
   * 每一張被碰到的表，不是帶公司條件的，就是列在 `GLOBAL_TABLES` 裡有理由的。
   *
   * 這一條擋的是「新開一張表」——上面那組 it.each 只走訪已知的四張表，
   * 一張沒人想過公司條件的新表可以完全不帶條件地溜過去。
   */
  it('沒有第三種表：不是帶公司條件，就是列在全域清單裡', () => {
    const tableRe = /\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([a-z_][a-z0-9_]*)`?/gi;
    const touched = new Set<string>();
    for (const call of calls) {
      for (const m of call.sql.matchAll(tableRe)) touched.add(m[1].toLowerCase());
    }
    // information_schema 之類的系統來源不在此列；目前一句都沒有，出現了就該想一想。
    const unknown = [...touched].filter(t => !SCOPED_TABLES.includes(t) && !(t in GLOBAL_TABLES));
    expect(unknown, '這些表既不在受公司條件保護的清單裡，也沒有被說明為什麼不需要').toEqual([]);
  });

  it('全域清單裡的每一張表都真的被用到，沒有留下過期的豁免', () => {
    const touched = new Set<string>();
    for (const call of calls) {
      for (const m of call.sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([a-z_][a-z0-9_]*)`?/gi)) {
        touched.add(m[1].toLowerCase());
      }
    }
    expect(Object.keys(GLOBAL_TABLES).filter(t => !touched.has(t))).toEqual([]);
  });

  it('例外清單裡的每一個名字都真的存在，沒有留下過期的豁免', () => {
    const present = new Set(calls.map(c => c.fn));
    const stale = Object.keys(CROSS_SCOPE_ALLOWLIST).filter(fn => !present.has(fn));
    expect(stale, '這些函式已不再下查詢，豁免應該一併刪掉').toEqual([]);
  });

  it('跨公司彙總靠 GROUP BY 與寫死的 IS NULL，不是靠漏掉條件', () => {
    const summary = calls.filter(c => c.fn === 'summaryByCompany');
    expect(summary.length).toBe(2);
    expect(summary[0].sql).toContain('GROUP BY');
    expect(summary[1].sql).toContain('u.company_id IS NULL');
  });

  it('新增專家時，company_id 取自條件本身而非請求', () => {
    const insert = calls.find(c => c.fn === 'createSpecialist');
    expect(insert).toBeDefined();
    const fnBody = storeSource.slice(
      storeSource.indexOf('export async function createSpecialist'),
      storeSource.indexOf('export async function updateSpecialist')
    );
    // 開頭這一行是它能被豁免的全部理由 —— 拿掉就等於可以寫進任何一家公司。
    expect(fnBody).toContain("condition.kind !== 'company'");
    expect(fnBody).toContain('condition.companyId');
  });
});

describe('後台路由不得繞過單一入口', () => {
  const routesRaw = read(ROUTES_PATH);
  const routes = stripComments(routesRaw);

  it('routes.ts 不直接匯入資料庫模組', () => {
    // 只要它拿得到 pool，上面那一整組護欄就等於不存在。
    expect(routes).not.toMatch(/from\s+['"][^'"]*db\/mysql['"]/);
    expect(routes).not.toMatch(/from\s+['"]mysql2/);
  });

  it('routes.ts 裡沒有任何 SQL', () => {
    expect(routes).not.toMatch(/\bSELECT\s+/i);
    expect(routes).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(routes).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
  });

  it('公司條件只從 resolveCompanyCondition 取得，不從請求參數拼出來', () => {
    // 條件若讀自 query string，整套隔離就只是一個換數字的遊戲。
    expect(routes).toContain('resolveCompanyCondition');
    expect(routes).not.toMatch(/req\.(query|params)\.companyId\b/);
  });

  it('每一支讀寫家長資料的路由都經過 withScope', () => {
    const scopeUses = routes.match(/withScope\(req, res\)/g) || [];
    expect(scopeUses.length).toBeGreaterThanOrEqual(8);
  });
});
