import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 記憶體模式下的同步（#15）。
 *
 * 沒有 `vi.mock` —— 這支測試跑的是**沒有資料庫**的那條路（測試環境一律清空
 * `MYSQL_*`），也就是展示站與本機開發實際在跑的模式。改用使用者 id 當識別鍵
 * 之後，記憶體那兩張表也得跟著換鍵；換錯了的症狀不是報錯，是**兩位家長共用
 * 一份孩子檔案**，或是家長重新整理之後自己的資料不見了。
 *
 * 註冊 → 保存 → 讀回，全程只帶 token，一個電子郵件欄位都不送。
 */

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

async function register(email: string): Promise<string> {
  const resp = await client.postJson('/api/auth/register', { email, password: 'pw-12345' });
  expect(resp.status).toBe(200);
  const body = await resp.json();
  expect(body.success).toBe(true);
  // 註冊的對外回應不變：電子郵件與通行證，兩個欄位都還在。
  expect(body.email).toBe(email);
  expect(typeof body.token).toBe('string');
  return body.token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('記憶體模式仍然可運作（#15）', () => {
  it('保存後讀得回來，全程不送電子郵件', async () => {
    const token = await register('mem1@x.com');

    const save = await client.postJson(
      '/api/db/save',
      { deviceId: 'dev-mem-1', child: { name: '小明' }, completedScores: [{ dimensionId: 'language' }] },
      auth(token)
    );
    expect(save.status).toBe(200);
    expect((await save.json()).success).toBe(true);

    const body = await (await client.get('/api/db/load', auth(token))).json();
    expect(body.source).toBe('memory');
    expect(body.child).toEqual({ name: '小明' });
    expect(body.completedScores).toEqual([{ dimensionId: 'language' }]);
  });

  it('兩位家長各自一份，看不到對方的孩子', async () => {
    const a = await register('mem2@x.com');
    const b = await register('mem3@x.com');

    await client.postJson('/api/db/save', { deviceId: 'd-a', child: { name: 'A 的孩子' } }, auth(a));
    await client.postJson('/api/db/save', { deviceId: 'd-b', child: { name: 'B 的孩子' } }, auth(b));

    expect((await (await client.get('/api/db/load', auth(a))).json()).child).toEqual({ name: 'A 的孩子' });
    expect((await (await client.get('/api/db/load', auth(b))).json()).child).toEqual({ name: 'B 的孩子' });
  });

  it('重新登入拿到的是同一位家長的資料', async () => {
    await register('mem4@x.com');
    const first = await client.postJson('/api/auth/login', { email: 'mem4@x.com', password: 'pw-12345' });
    const token = (await first.json()).token;
    await client.postJson('/api/db/save', { deviceId: 'd-4', child: { name: '小華' } }, auth(token));

    const again = await client.postJson('/api/auth/login', { email: 'mem4@x.com', password: 'pw-12345' });
    const body = await again.json();
    // 登入的對外行為不變：回應裡照樣帶著孩子檔案。
    expect(body.child).toEqual({ name: '小華' });
    expect(body.email).toBe('mem4@x.com');

    // 新發的通行證讀到的是同一份。
    expect((await (await client.get('/api/db/load', auth(body.token))).json()).child)
      .toEqual({ name: '小華' });
  });

  it('未登入時裝置模式照舊 —— 沒有資料庫就沒有東西可讀', async () => {
    const resp = await client.get('/api/db/load?deviceId=d-anonymous');
    expect(resp.status).toBe(200);
    expect((await resp.json()).source).toBe('unconfigured');
  });
});
