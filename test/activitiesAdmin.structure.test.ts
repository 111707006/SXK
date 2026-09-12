import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 活動庫後台的原始碼護欄（#62）。
 *
 * HTTP 測試（`activitiesAdmin.http.test.ts`）驗的是「公司成員拿到 403」——那是行為。
 * 這裡驗的是**為什麼**拿到 403：每一支 `/activities` 路由的第一句都是 `requireGlobal`。
 * 兩者看似重複，但 HTTP 測試只走訪它知道的路由；日後多加一支 `/activities/:id/steps`
 * 而忘了那一句，HTTP 測試照樣全綠。
 *
 * SQL 那半：`adminScope.structure.test.ts` 已把 `activities` 列在 `GLOBAL_TABLES`
 * （允許不帶公司條件）。這裡反過來擋「帶了」——有人好心把 `${scope.sql}` 加到活動庫的
 * 查詢上，活動就變成分公司的，而 300 支種子沒有 company_id，畫面會是一支都沒有。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('活動庫的路由在 requireGlobal 之下', () => {
  const routes = stripComments(read('src/admin/routes.ts'));
  const handlers = [...routes.matchAll(/router\.(get|post|put|patch|delete)\(\s*'\/activities[^']*'[^\n]*\n([^\n]*)/g)];

  it('確實抓到了路由（護欄本身沒有壞掉）', () => {
    expect(handlers.map(h => h[1])).toEqual(['get', 'patch']);
  });

  it.each(['get', 'patch'])('%s /activities… 的第一句就是 requireGlobal', method => {
    const h = handlers.find(x => x[1] === method)!;
    expect(h[2]).toContain('if (!requireGlobal(req, res)) return;');
  });

  // 只有停用沒有刪除（ADR-0005）；沒有新增 —— 300 支由種子寫入，之後新增走遷移。
  it('沒有 DELETE、沒有 POST', () => {
    expect(routes).not.toMatch(/router\.(delete|post)\(\s*'\/activities/);
  });

  it('活動庫不經過 withScope —— 它不是家長資料', () => {
    const block = routes.slice(routes.indexOf("router.get('/activities'"));
    expect(block).not.toContain('withScope');
  });
});

describe('活動庫的 SQL 不帶公司條件', () => {
  const store = stripComments(read('src/admin/adminStore.ts'));
  const sqls = [...store.matchAll(/(['"`])((?:SELECT|UPDATE)[^'"`]*\bactivities\b[^'"`]*)\1/g)].map(m => m[2]);

  it('確實抓到了查詢', () => {
    expect(sqls.length).toBeGreaterThanOrEqual(3);
  });

  it.each([0, 1, 2])('第 %i 句：沒有 company、沒有 ${scope.sql}', i => {
    expect(sqls[i]).not.toMatch(/company/i);
    expect(sqls[i]).not.toContain('${scope.sql}');
  });

  it('SET 子句的欄位名來自常數表，不來自請求 —— UPDATE 裡不出現 req 或 patch 的字面鍵', () => {
    const fn = store.slice(store.indexOf('export async function updateActivity'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain('ACTIVITY_COLUMNS[k].column');
    expect(body).not.toMatch(/Object\.keys\(req/);
  });
});
