import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 記憶體模式下的同步（#15，於 #27 改寫）。
 *
 * 沒有 `vi.mock` —— 這支測試跑的是**沒有資料庫**的那條路（測試環境一律清空
 * `MYSQL_*`）。改用使用者 id 當識別鍵之後，記憶體那張表也得跟著換鍵；換錯了的
 * 症狀不是報錯，是**兩位家長共用一份孩子檔案**，或是家長重新整理之後自己的資料
 * 不見了。
 *
 * #27 之後**這個模式下沒有任何一條路可以登入**：電子郵件註冊下線，而手機號那條
 * 路沒有記憶體模式（驗證碼寫不進資料庫就明確失敗）。所以測試直接簽出通行證，
 * 模擬的是唯一還會走到這裡的情境：**已登入的家長遇上資料庫暫時不在**。
 * 那不是假設出來的情境 —— `/api/db/save` 在寫入失敗時就是退到這張表上。
 */

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

const auth = (userId: number) => bearer(userId);

describe('記憶體模式仍然可運作（#15）', () => {
  it('保存後讀得回來，全程只憑通行證', async () => {
    const save = await client.postJson(
      '/api/db/save',
      { deviceId: 'dev-mem-1', child: { name: '小明' }, completedScores: [{ dimensionId: 'language' }] },
      auth(1)
    );
    expect(save.status).toBe(200);
    expect((await save.json()).success).toBe(true);

    const body = await (await client.get('/api/db/load', auth(1))).json();
    expect(body.source).toBe('memory');
    expect(body.child).toEqual({ name: '小明' });
    expect(body.completedScores).toEqual([{ dimensionId: 'language' }]);
  });

  it('兩位家長各自一份，看不到對方的孩子', async () => {
    await client.postJson('/api/db/save', { deviceId: 'd-a', child: { name: 'A 的孩子' } }, auth(2));
    await client.postJson('/api/db/save', { deviceId: 'd-b', child: { name: 'B 的孩子' } }, auth(3));

    expect((await (await client.get('/api/db/load', auth(2))).json()).child).toEqual({ name: 'A 的孩子' });
    expect((await (await client.get('/api/db/load', auth(3))).json()).child).toEqual({ name: 'B 的孩子' });
  });

  it('同一位家長換一張新的通行證，讀到的是同一份', async () => {
    // 鍵是通行證裡的**使用者 id**，不是通行證本身 —— token 每次登入都不一樣，
    // 拿它當鍵的話，家長每登入一次就換到一份空的檔案。
    await client.postJson('/api/db/save', { deviceId: 'd-4', child: { name: '小華' } }, auth(4));

    const body = await (await client.get('/api/db/load', auth(4))).json();
    expect(body.child).toEqual({ name: '小華' });
  });

  it('未登入時裝置模式照舊 —— 沒有資料庫就沒有東西可讀', async () => {
    const resp = await client.get('/api/db/load?deviceId=d-anonymous');
    expect(resp.status).toBe(200);
    expect((await resp.json()).source).toBe('unconfigured');
  });

  it('沒有資料庫時登不進來，而且說得出來 —— 不假裝登入成功', async () => {
    // 這是 #27 的直接後果：手機號是唯一入口，而它沒有記憶體模式。
    // 回 503 而不是發一張指向記憶體帳號的通行證 —— 後者會讓家長做完整份篩查，
    // 然後在下一次重啟時發現帳號與結果都不存在。
    const resp = await client.postJson('/api/auth/sms/request', { phone: '13800138000' });
    expect(resp.status).toBe(503);
    const body = await resp.json();
    expect(body.success).not.toBe(true);
    expect(body.error).toBeTruthy();
  });
});
