import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';

/**
 * 活動庫標記頁的後台端點（#62）。
 *
 * 與 `materialsAdmin.http.test.ts` 同一個作法：送真的請求、看回應，一次驗到角色、
 * 路由有沒有註冊、輸入檢查有沒有跑三件事。
 *
 * 要抓的錯同樣是兩個方向：活動**不是家長資料**，正確的行為是「不吃公司條件、不必先選定公司」；
 * 它是森心康的內容，正確的行為同時是「合作公司碰不到」。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { ACTIVITY_SEED } = await import('../src/t2/activitySeed');
  type Activity = import('../src/t2/types').Activity;
  type Patch = import('../src/utils/activityAdmin').ActivityPatch;

  const hash = (pw: string) => bcrypt.hashSync(pw, 4);

  /** 種子的形狀：300 支、`targetMonth` 全 null、`targets` 全空、全部啟用。 */
  const seed = (): Activity[] => ACTIVITY_SEED.map(a => ({ ...a, dimensions: [...a.dimensions] }));

  const db = {
    activities: seed(),
    available: true,
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
    ],
  };

  return {
    __db: db,
    __reset() {
      db.activities = seed();
      db.available = true;
    },

    isAvailable: () => db.available,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },

    async listActivities() {
      return db.activities;
    },
    async findActivityById(id: string) {
      return db.activities.find(a => a.id === id) ?? null;
    },
    async updateActivity(id: string, patch: Patch) {
      const existing = db.activities.find(a => a.id === id);
      if (!existing) return null;
      Object.assign(existing, patch);
      return existing;
    },
  };
});

let client: TestClient;
let store: any;

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

const h = (token: string) => ({ Authorization: `Bearer ${token}` });

function patchJson(path: string, body: unknown, token: string) {
  return client.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...h(token) },
    body: JSON.stringify(body),
  });
}

const row = (id: string) => (store as any).__db.activities.find((a: any) => a.id === id);

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  (store as any).__reset();
});

afterAll(async () => {
  await client.close();
});

describe('誰維護得了活動庫', () => {
  it('未登入取不到', async () => {
    expect((await client.get('/api/admin/activities')).status).toBe(401);
    const resp = await client.request('/api/admin/activities/A017', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth: 30 }),
    });
    expect(resp.status).toBe(401);
  });

  // 活動決定了所有孩子每週拿到的訓練。合作公司不維護它，也不該改得動它。
  it('公司成員讀不到也改不了', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const list = await client.get('/api/admin/activities', h(token));
    const update = await patchJson('/api/admin/activities/A017', { targetMonth: 30 }, token);
    for (const resp of [list, update]) {
      expect(resp.status).toBe(403);
      expect((await resp.json()).code).toBe('FORBIDDEN');
    }
    expect(row('A017').targetMonth).toBeNull();
  });

  /**
   * 活動不是家長資料，因此**不需要先選定公司**。錯的方向會很安靜：全域管理員得先
   * 隨便選一家合作公司才維護得了森心康自己的活動，畫面上看起來只是多按一下。
   */
  it('全域管理員未選定公司就讀得到全部 300 支，含種子狀態', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.get('/api/admin/activities', h(token));
    expect(resp.status).toBe(200);
    const { activities } = await resp.json();
    expect(activities).toHaveLength(300);
    expect(activities[16]).toMatchObject({ id: 'A017', moduleNo: 1, targetMonth: null, targets: [], active: true });
  });
});

describe('PATCH 一支：帶了才改', () => {
  let token: string;
  beforeAll(async () => {
    token = await login('god@sxk.com', 'pw-god-123');
  });

  it('targetMonth', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { targetMonth: 30 }, token);
    expect(resp.status).toBe(200);
    // 回整支更新後的活動 —— 畫面拿它直接換掉列表裡那一列，不必重抓 300 支。
    const { activity } = await resp.json();
    expect(activity).toMatchObject({ id: 'A017', targetMonth: 30, title: ACTIVITY_SEED[16].title });
    expect(row('A017').targetMonth).toBe(30);
    // 別的欄位不動
    expect(row('A017').active).toBe(true);
    expect(row('A016').targetMonth).toBeNull();
  });

  it('targets（★ 標籤）', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { targets: ['mot.balance', 'mot.locomotion'] }, token);
    expect(resp.status).toBe(200);
    expect(row('A017').targets).toEqual(['mot.locomotion', 'mot.balance']);
  });

  it('dimensions', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { dimensions: ['MOT', 'SEN'] }, token);
    expect(resp.status).toBe(200);
    expect(row('A017').dimensions).toEqual(['MOT', 'SEN']);
  });

  it('avoidIf', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { avoidIf: ['sen.threshold_low'] }, token);
    expect(resp.status).toBe(200);
    expect(row('A017').avoidIf).toEqual(['sen.threshold_low']);
  });

  // 只有停用沒有刪除（ADR-0005）：沒有 DELETE 路由。
  it('active：停用是把 active 關掉，活動本身還在；沒有刪除這條路', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { active: false }, token);
    expect(resp.status).toBe(200);
    expect(row('A017')).toMatchObject({ active: false, title: ACTIVITY_SEED[16].title });
    const del = await client.request('/api/admin/activities/A017', { method: 'DELETE', headers: h(token) });
    expect(del.status).toBe(404);
    expect(row('A017')).toBeDefined();
  });

  it('targets 給非 ★ 標籤 → 400，一個字都沒存', async () => {
    const resp = await patchJson(
      '/api/admin/activities/A017',
      { targets: ['mot.balance', 'emo.slow_to_warm'], targetMonth: 30 },
      token
    );
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('emo.slow_to_warm');
    expect(row('A017').targets).toEqual([]);
    expect(row('A017').targetMonth).toBeNull();
  });

  it('示範連結：http:// → 400；https:// 與站內 / → 200', async () => {
    const bad = await patchJson('/api/admin/activities/A017', { videoUrl: 'http://v.example.com/a17' }, token);
    expect(bad.status).toBe(400);
    expect(row('A017').videoUrl).toBeNull();

    const https = await patchJson('/api/admin/activities/A017', { videoUrl: 'https://v.example.com/a17' }, token);
    expect(https.status).toBe(200);
    expect(row('A017').videoUrl).toBe('https://v.example.com/a17');

    const local = await patchJson('/api/admin/activities/A017', { videoUrl: '/videos/a17.mp4' }, token);
    expect(local.status).toBe(200);
    expect(row('A017').videoUrl).toBe('/videos/a17.mp4');
  });

  it('圖文步驟沿用素材庫的規則：http:// 的圖 → 400', async () => {
    const resp = await patchJson(
      '/api/admin/activities/A017',
      { steps: [{ imageUrl: 'http://x/1.png', instruction: '不是 https' }] },
      token
    );
    expect(resp.status).toBe(400);
    const ok = await patchJson(
      '/api/admin/activities/A017',
      { steps: [{ imageUrl: '/s/a17-1.png', instruction: '放一首歌。' }] },
      token
    );
    expect(ok.status).toBe(200);
    expect(row('A017').steps).toHaveLength(1);
  });

  it('空的 patch → 400', async () => {
    const resp = await patchJson('/api/admin/activities/A017', {}, token);
    expect(resp.status).toBe(400);
  });

  it('不存在的編號 → 404', async () => {
    expect((await patchJson('/api/admin/activities/A999', { targetMonth: 30 }, token)).status).toBe(404);
    expect((await patchJson('/api/admin/activities/not-an-id!!', { targetMonth: 30 }, token)).status).toBe(404);
  });
});

describe('進度數字從列表算得出來', () => {
  it('種子狀態 300／0／0／300；填一支 targetMonth 後 300／1／0／300', async () => {
    const { activityCoverage } = await import('../src/utils/activityAdmin');
    const token = await login('god@sxk.com', 'pw-god-123');

    const before = (await (await client.get('/api/admin/activities', h(token))).json()).activities;
    expect(activityCoverage(before)).toEqual({ total: 300, targetMonthFilled: 0, targetsFilled: 0, active: 300 });

    await patchJson('/api/admin/activities/A017', { targetMonth: 30 }, token);
    const after = (await (await client.get('/api/admin/activities', h(token))).json()).activities;
    expect(activityCoverage(after)).toEqual({ total: 300, targetMonthFilled: 1, targetsFilled: 0, active: 300 });
  });
});
