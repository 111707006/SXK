import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 電子郵件登入下線（#27）—— expand–contract 的 contract 那一步。
 *
 * 這支測試釘住的是**沒有了什麼**，而「沒有了什麼」正是型別檢查與其他測試看不見
 * 的那一面：那兩條路由留著照樣全綠，而留著的代價是一個不需要簡訊、不需要冷卻期、
 * 不需要驗證碼上限就能進站的第二個入口。
 *
 * 同時釘住兩條界線：
 *
 * 1. **明文密碼退路一併消失。** 舊的 `verifyPassword` 對非 bcrypt 值會退回
 *    `plain === stored`，而展示用的 `test@test.com` / `123456` 是明文種子 ——
 *    兩者相加等於任何一個對外站台都人人可登入。密碼登入不存在了，這條退路
 *    就沒有任何理由留著。
 * 2. **既有電子郵件家長的資料列不刪除。** 認領路徑不提供是產品端選定的取捨
 *    （見 docs/adr/0002-...），刪資料不是。欄位與資料列都留在原地。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡提到被移除的那些東西不算數 —— 這裡查的是真的程式碼。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** SQL 的註解是 `--`，與 TS 不同。 */
function stripSqlComments(source: string): string {
  return source.replace(/^\s*--.*$/gm, '');
}

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('電子郵件註冊與登入路由已移除', () => {
  it.each([
    ['/api/auth/register', { email: 'p@x.com', password: 'pw-12345' }],
    ['/api/auth/login', { email: 'p@x.com', password: 'pw-12345' }],
  ])('POST %s 回 404，而不是一個還能用的入口', async (route, body) => {
    const resp = await client.postJson(route, body);
    expect(resp.status).toBe(404);
    // 兜底的 404 回的是 JSON。回一頁 HTML 的話，客戶端會把網頁當成回應去解析，
    // 而一條已經下線的路由看起來會像是成功。
    expect((await resp.json()).error).toBeTruthy();
  });

  it('展示帳號連 404 都一樣 —— 不因為是那一組帳密就有第二種待遇', async () => {
    const resp = await client.postJson('/api/auth/login', { email: 'test@test.com', password: '123456' });
    expect(resp.status).toBe(404);
  });

  it('手機號那兩支路由還在（下線的是電子郵件，不是登入本身）', async () => {
    // 這個部署沒有資料庫，所以回的是 503「暫未開放」；重點是**不是 404**。
    for (const route of ['/api/auth/sms/request', '/api/auth/sms/verify']) {
      const resp = await client.postJson(route, { phone: '13800138000', code: '123456' });
      expect(resp.status, `${route} 不見了`).not.toBe(404);
    }
  });
});

describe('登入畫面只剩手機號一個入口', () => {
  const screen = stripComments(read('src/components/AuthScreen.tsx'));

  it('畫面打得到的家長端登入端點只有簡訊那兩支', () => {
    const endpoints = [...new Set(screen.match(/\/api\/auth\/[a-z/]+/g) ?? [])].sort();
    expect(endpoints).toEqual(['/api/auth/sms/request', '/api/auth/sms/verify']);
  });

  it('沒有電子郵件與密碼欄位', () => {
    expect(screen).not.toMatch(/type=["']password["']/);
    expect(screen).not.toMatch(/type=["']email["']/);
  });

  it('沒有一鍵填充的展示帳號', () => {
    expect(screen).not.toContain('test@test.com');
    expect(screen).not.toContain('一键填充');
  });
});

describe('密碼驗證的明文退路已移除', () => {
  const server = stripComments(read('server.ts'));

  it('server.ts 不再有明文比對', () => {
    // 這一行是那個洞本身：儲存值不像 bcrypt 雜湊時，直接拿明文比。
    expect(server).not.toMatch(/\bplain\s*===\s*stored\b/);
    expect(server).not.toMatch(/\blooksHashed\b/);
    expect(server).not.toMatch(/\bverifyPassword\b/);
  });

  it('驗證碼是直接跟儲存的雜湊比對的', () => {
    // 正面那一半：拿掉退路之後，核對這件事只剩下一條路徑。
    expect(server).toMatch(/bcrypt\.compare\(code, row\.code_hash\)/);
  });

  it('程式裡沒有任何預先種好的帳號', () => {
    expect(server).not.toContain('test@test.com');
    expect(server).not.toMatch(/\bcreateOfflineUser\b/);
  });
});

describe('展示帳號的種子不再進新的資料庫', () => {
  const schema = stripSqlComments(read('deploy/schema.sql'));

  it('schema.sql 不再塞入 test@test.com', () => {
    expect(schema).not.toContain('test@test.com');
    expect(schema).not.toMatch(/INSERT[\s\S]*?INTO\s+`?users`?/i);
  });
});

describe('既有電子郵件家長的資料列不刪除', () => {
  it('欄位留在原地 —— 下線的是路徑，不是那些人的資料', () => {
    const schema = read('deploy/schema.sql');
    expect(schema).toMatch(/`email`\s+VARCHAR/);
    expect(schema).toMatch(/`password`\s+VARCHAR/);
  });

  it('deploy 底下沒有任何一句刪掉家長或欄位的語句', () => {
    const files = fs
      .readdirSync(path.join(ROOT, 'deploy/migrations'))
      .map(name => `deploy/migrations/${name}`)
      .concat('deploy/schema.sql');

    for (const file of files) {
      const sql = stripSqlComments(read(file));
      expect(sql, `${file} 刪掉了家長資料`).not.toMatch(/DELETE\s+FROM\s+`?users`?/i);
      expect(sql, `${file} 刪掉了電子郵件欄位`).not.toMatch(/DROP\s+COLUMN\s+`?(email|password)`?/i);
    }
  });
});
