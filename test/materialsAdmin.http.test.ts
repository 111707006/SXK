import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 素材庫後台端點的 HTTP 測試（issue #20）。
 *
 * 與 `adminIsolation.http.test.ts` 同一個作法：送真的請求、看回應，一次驗到
 * 角色、路由有沒有註冊、輸入檢查有沒有跑三件事。
 *
 * 這裡要抓的錯與公司隔離那組不同 —— 素材**不是家長資料**，因此正確的行為是
 * 「不吃公司條件」；而它是森心康的干預內容，因此正確的行為同時是
 * 「合作公司碰不到」。兩者很容易被實作成其中一個。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  type Input = import('../src/utils/materialCells').MaterialInput;
  type Record_ = import('../src/utils/materialCells').MaterialRecord;

  const hash = (pw: string) => bcrypt.hashSync(pw, 4);

  const seed = (): Record_[] => [
    {
      id: 1,
      dimensionId: 'language',
      ageBandId: 'B',
      severity: 'delay',
      title: '轮流发声',
      steps: [{ imageUrl: '/m/1.png', instruction: '面对面坐下。' }],
      videoUrl: null,
      active: true,
      updatedAt: null,
    },
    {
      id: 2,
      dimensionId: 'language',
      ageBandId: 'C',
      severity: 'borderline',
      title: '已停用的素材',
      steps: [{ imageUrl: '/m/2.png', instruction: '拿出绘本。' }],
      videoUrl: null,
      active: false,
      updatedAt: null,
    },
  ];

  const db = {
    materials: seed(),
    nextId: 3,
    available: true,
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
    ],
  };

  const cellOf = (m: { dimensionId: string; ageBandId: string; severity: string }) =>
    `${m.dimensionId}/${m.ageBandId}/${m.severity}`;

  /** 唯一鍵在正式環境由資料庫執行，替身在這裡照樣拋同一個錯誤碼。 */
  const dup = () => Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

  return {
    __db: db,
    __reset() {
      db.materials = seed();
      db.nextId = 3;
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

    async listMaterials() {
      return db.materials;
    },
    async createMaterial(input: Input) {
      if (db.materials.some(m => cellOf(m) === cellOf(input))) throw dup();
      const row = { ...input, id: db.nextId++, updatedAt: null };
      db.materials.push(row);
      return row;
    },
    async updateMaterial(id: number, input: Input) {
      const existing = db.materials.find(m => m.id === id);
      if (!existing) return 0;
      if (db.materials.some(m => m.id !== id && cellOf(m) === cellOf(input))) throw dup();
      Object.assign(existing, input);
      return 1;
    },
  };
});

let client: TestClient;
let store: any;

const VALID = {
  dimensionId: 'cognitive',
  ageBandId: 'A',
  severity: 'delay',
  title: '找藏起来的玩具',
  steps: [
    { imageUrl: 'https://cdn.example.com/1.png', instruction: '当着孩子的面把玩具盖住。' },
    { imageUrl: 'https://cdn.example.com/2.png', instruction: '鼓励他自己掀开。' },
  ],
  videoUrl: 'https://v.example.com/abc',
};

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

const h = (token: string) => ({ Authorization: `Bearer ${token}` });

function putJson(path: string, body: unknown, token: string) {
  return client.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...h(token) },
    body: JSON.stringify(body),
  });
}

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

describe('誰維護得了素材庫', () => {
  it('未登入取不到素材', async () => {
    const resp = await client.get('/api/admin/materials');
    expect(resp.status).toBe(401);
  });

  // 素材決定了所有孩子拿到的訓練步驟。合作公司不維護它，也不該改得動它。
  it('公司成員讀不到也改不了素材', async () => {
    const token = await login('a@jia.com', 'pw-jia-123');
    const list = await client.get('/api/admin/materials', h(token));
    const create = await client.postJson('/api/admin/materials', VALID, h(token));
    const update = await putJson('/api/admin/materials/1', VALID, token);
    for (const resp of [list, create, update]) {
      expect(resp.status).toBe(403);
      expect((await resp.json()).code).toBe('FORBIDDEN');
    }
    expect((store as any).__db.materials).toHaveLength(2);
  });

  /**
   * 素材不是家長資料，因此**不需要先選定公司**。
   *
   * 這一條與家長端點的 409 恰好相反，而錯的方向會很安靜：全域管理員得先隨便
   * 選一家合作公司才維護得了森心康自己的素材，畫面上看起來只是多按一下。
   */
  it('全域管理員未選定公司就維護得了素材', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const list = await client.get('/api/admin/materials', h(token));
    expect(list.status).toBe(200);
    expect((await list.json()).materials).toHaveLength(2);
  });
});

describe('新增素材', () => {
  it('建得起一格素材，內容原樣存下來', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson('/api/admin/materials', VALID, h(token));
    expect(resp.status).toBe(200);
    const { material } = await resp.json();
    expect(material).toMatchObject({
      dimensionId: 'cognitive',
      ageBandId: 'A',
      severity: 'delay',
      videoUrl: 'https://v.example.com/abc',
      active: true,
    });
    expect(material.steps.map((s: any) => s.instruction)).toEqual([
      '当着孩子的面把玩具盖住。',
      '鼓励他自己掀开。',
    ]);
  });

  it('影片連結是選填', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const { videoUrl, ...noVideo } = VALID;
    const resp = await client.postJson('/api/admin/materials', noVideo, h(token));
    expect(resp.status).toBe(200);
    expect((await resp.json()).material.videoUrl).toBeNull();
  });

  it('同一格建第二次被擋下，而且說得出原因', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await client.postJson(
      '/api/admin/materials',
      { ...VALID, dimensionId: 'language', ageBandId: 'B', severity: 'delay' },
      h(token)
    );
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('已经建立过');
    expect((store as any).__db.materials).toHaveLength(2);
  });

  it('不在 90 格之內的組合整筆拒收', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    for (const bad of [
      { dimensionId: 'fine_motor' },
      { ageBandId: 'Z' },
      { severity: 'normal' },
    ]) {
      const resp = await client.postJson('/api/admin/materials', { ...VALID, ...bad }, h(token));
      expect(resp.status, JSON.stringify(bad)).toBe(400);
    }
    expect((store as any).__db.materials).toHaveLength(2);
  });

  it('沒有步驟、或步驟缺圖缺字，都存不進去', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const bad = [
      { ...VALID, steps: [] },
      { ...VALID, steps: [{ imageUrl: 'https://cdn.example.com/1.png' }] },
      { ...VALID, steps: [{ instruction: '只有字' }] },
      { ...VALID, steps: [{ imageUrl: 'http://cdn.example.com/1.png', instruction: '不是 https' }] },
      { ...VALID, title: '' },
    ];
    for (const body of bad) {
      const resp = await client.postJson('/api/admin/materials', body, h(token));
      expect(resp.status).toBe(400);
      expect((await resp.json()).error.length).toBeGreaterThan(0);
    }
    expect((store as any).__db.materials).toHaveLength(2);
  });
});

describe('編輯與停用', () => {
  it('改得動既有的一格', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await putJson(
      '/api/admin/materials/1',
      { ...VALID, dimensionId: 'language', ageBandId: 'B', severity: 'delay', title: '改过的标题' },
      token
    );
    expect(resp.status).toBe(200);
    expect((store as any).__db.materials.find((m: any) => m.id === 1).title).toBe('改过的标题');
  });

  // 停用而非刪除：家長端不再取到它，但內容還在，可以再打開。
  it('停用是把 active 關掉，素材本身還在', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await putJson(
      '/api/admin/materials/1',
      { ...VALID, dimensionId: 'language', ageBandId: 'B', severity: 'delay', active: false },
      token
    );
    expect(resp.status).toBe(200);
    const row = (store as any).__db.materials.find((m: any) => m.id === 1);
    expect(row.active).toBe(false);
    expect(row.steps.length).toBeGreaterThan(0);
  });

  // 已停用的素材仍然屬於它那一格，列表上看得到 —— 否則「已停用」會被當成
  // 「還沒建立」，90 格的進度就永遠對不起來。
  it('列表含已停用的素材', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const { materials } = await (await client.get('/api/admin/materials', h(token))).json();
    expect(materials.find((m: any) => m.id === 2)).toMatchObject({ active: false, ageBandId: 'C' });
  });

  it('改到不存在的素材回 404', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await putJson('/api/admin/materials/999999', VALID, token);
    expect(resp.status).toBe(404);
  });

  it('把一格搬到已經有素材的格子會被擋下', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await putJson(
      '/api/admin/materials/2',
      { ...VALID, dimensionId: 'language', ageBandId: 'B', severity: 'delay' },
      token
    );
    expect(resp.status).toBe(409);
    expect((store as any).__db.materials.find((m: any) => m.id === 1).title).toBe('轮流发声');
  });
});
