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
    /** 這幾支的 updateActivity 丟例外（模擬資料庫在匯入中途出錯）。 */
    failWrites: new Set<string>(),
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
      db.failWrites = new Set();
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
      if (db.failWrites.has(id)) throw new Error('simulated write failure');
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

  // ADR-0008／Keep 規格 K04：客戶的手冊只有文字步驟。
  it('只有文字的步驟存得進去', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { steps: [{ instruction: '放一首歌。' }, { imageUrl: '', instruction: '一起动。' }] }, token);
    expect(resp.status).toBe(200);
    expect(row('A017').steps).toEqual([
      { imageUrl: null, instruction: '放一首歌。' },
      { imageUrl: null, instruction: '一起动。' },
    ]);
  });

  // Keep 規格 K17 的驗收：「改一支的『小提醒』」。家長端讀的是同一張表（t2WeeklyPlan.http 那一條驗「立刻看到」）。
  it('小提醒：帶了才改，別的內容欄位不動', async () => {
    const resp = await patchJson('/api/admin/activities/A017', { tip: '选孩子喜欢的歌。' }, token);
    expect(resp.status).toBe(200);
    expect((await resp.json()).activity).toMatchObject({ id: 'A017', tip: '选孩子喜欢的歌。' });
    expect(row('A017')).toMatchObject({ tip: '选孩子喜欢的歌。', need: '', guide: null });
  });

  it('適齡：改了原文連帶改硬閘；看不懂的 400，一個字都沒存', async () => {
    const ok = await patchJson('/api/admin/activities/A017', { ageLabel: '2–6岁' }, token);
    expect(ok.status).toBe(200);
    expect(row('A017')).toMatchObject({ ageLabel: '2–6岁', ageMonths: { min: 24, max: 72 } });

    const bad = await patchJson('/api/admin/activities/A017', { ageLabel: '两到六岁', tip: '不该存进去' }, token);
    expect(bad.status).toBe(400);
    expect(row('A017')).toMatchObject({ ageLabel: '2–6岁', tip: '' });
  });

  it('腳本不能整份刪掉 → 400', async () => {
    const resp = await patchJson('/api/admin/activities/A001', { guide: null }, token);
    expect(resp.status).toBe(400);
    expect((await resp.json()).error).toContain('脚本');
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

/**
 * 批量匯入（v2.1 S25）。客戶的 E 表還沒來，這裡全是假資料；規格見 v2.1 §7、附錄 C。
 * 列號從 1 起算。
 */
describe('POST /api/admin/activities/import', () => {
  let token: string;
  beforeAll(async () => {
    token = await login('god@sxk.com', 'pw-god-123');
  });

  const importJson = (body: unknown, auth: string | null = token) =>
    client.postJson('/api/admin/activities/import', body, auth ? h(auth) : {});

  it('全對：每一列都寫進去，回 imported 與空的 failed／warnings', async () => {
    const resp = await importJson({
      rows: [
        { id: 'A017', moduleNo: 1, targetMonth: 30, targets: ['mot.balance', 'mot.locomotion'], avoidIf: ['sen.vestibular'] },
        { id: 'A021', moduleNo: 2, targetMonth: 12, durationMin: 10, active: false },
        { id: 'A300', moduleNo: 15, targetMonth: 216 },
      ],
    });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ imported: 3, failed: [], warnings: [] });
    expect(row('A017')).toMatchObject({ targetMonth: 30, targets: ['mot.locomotion', 'mot.balance'], avoidIf: ['sen.vestibular'] });
    expect(row('A021')).toMatchObject({ targetMonth: 12, durationMin: 10, active: false });
    expect(row('A300').targetMonth).toBe(216);
    // 帶了才改：沒帶的欄位不動
    expect(row('A300')).toMatchObject({ active: true, targets: [], title: ACTIVITY_SEED[299].title });
  });

  it('部分壞列：壞的整列不入庫（連同它帶的其他欄位），好的照寫；不認得的欄位進 warnings', async () => {
    const resp = await importJson({
      rows: [
        { id: 'A001', moduleNo: 1, targetMonth: 6, 备注: '先做' },
        { id: 'A002', moduleNo: 1, targetMonth: null, targets: ['mot.balance'] },
        { id: 'A003', moduleNo: 2, targetMonth: 12 },
        { id: 'A999', moduleNo: 50, targetMonth: 12 },
        { id: 'A004', moduleNo: 1, targetMonth: 24, targets: ['mot.balance', 'emo.slow_to_warm'] },
        { id: 'A005', moduleNo: 1, targetMonth: 36 },
      ],
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.imported).toBe(2);
    expect(body.failed.map((f: any) => [f.row, f.id])).toEqual([[2, 'A002'], [3, 'A003'], [4, 'A999'], [5, 'A004']]);
    expect(body.failed[3].error).toContain('emo.slow_to_warm');
    expect(body.warnings).toEqual([{ row: 1, field: '备注' }]);

    expect(row('A001').targetMonth).toBe(6);
    expect(row('A005').targetMonth).toBe(36);
    expect(row('A002')).toMatchObject({ targetMonth: null, targets: [] });
    expect(row('A003').targetMonth).toBeNull();
    expect(row('A004')).toMatchObject({ targetMonth: null, targets: [] });
  });

  it('dryRun：只驗不寫，回同樣的報告', async () => {
    const rows = [
      { id: 'A001', moduleNo: 1, targetMonth: 6 },
      { id: 'A002', moduleNo: 1, targetMonth: 300 },
      { id: 'A003', moduleNo: 1, targetMonth: 12, remark: 'x' },
    ];
    const dry = await importJson({ rows, dryRun: true });
    expect(dry.status).toBe(200);
    const dryBody = await dry.json();
    expect(dryBody).toMatchObject({ imported: 2, warnings: [{ row: 3, field: 'remark' }] });
    expect(dryBody.failed.map((f: any) => f.row)).toEqual([2]);
    expect(store.__db.activities.every((a: any) => a.targetMonth === null)).toBe(true);

    // 同一份正式匯入：報告一模一樣，這次寫進去。
    const real = await importJson({ rows });
    expect(await real.json()).toEqual(dryBody);
    expect(row('A001').targetMonth).toBe(6);
  });

  it('某一列寫入失敗：那一列記進 failed，其他列照寫，不整份 500', async () => {
    store.__db.failWrites = new Set(['A002']);
    const resp = await importJson({
      rows: [
        { id: 'A001', moduleNo: 1, targetMonth: 6 },
        { id: 'A002', moduleNo: 1, targetMonth: 7 },
        { id: 'A003', moduleNo: 1, targetMonth: 8 },
      ],
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.imported).toBe(2);
    expect(body.failed).toEqual([{ row: 2, id: 'A002', error: expect.stringContaining('写入失败') }]);
    expect(row('A001').targetMonth).toBe(6);
    expect(row('A003').targetMonth).toBe(8);
  });

  it('Keep K17 的內容欄位一併收：適齡連帶改硬閘、手冊文字、封面與片長、只有文字的步驟', async () => {
    const resp = await importJson({
      rows: [
        {
          id: 'A017',
          moduleNo: 1,
          targetMonth: 30,
          ageLabel: '2–6岁',
          people: '亲子',
          trains: '练协调',
          need: '一首有节奏的歌',
          easier: '只拍手',
          harder: '音乐停就定住',
          tip: '选孩子喜欢的歌。',
          deeper: '物理治疗册 模组九',
          posterUrl: '/media/activities/A017.jpg',
          videoSeconds: 10,
          steps: [{ instruction: '放一首歌。' }],
        },
      ],
    });
    expect(await resp.json()).toEqual({ imported: 1, failed: [], warnings: [] });
    expect(row('A017')).toMatchObject({
      targetMonth: 30,
      ageLabel: '2–6岁',
      ageMonths: { min: 24, max: 72 },
      people: '亲子',
      trains: '练协调',
      need: '一首有节奏的歌',
      easier: '只拍手',
      harder: '音乐停就定住',
      tip: '选孩子喜欢的歌。',
      deeper: '物理治疗册 模组九',
      posterUrl: '/media/activities/A017.jpg',
      videoSeconds: 10,
      steps: [{ imageUrl: null, instruction: '放一首歌。' }],
    });
  });

  it('未登入 401；公司成員 403 —— 一列都沒寫', async () => {
    const body = { rows: [{ id: 'A017', moduleNo: 1, targetMonth: 30 }] };
    expect((await importJson(body, null)).status).toBe(401);
    const member = await importJson(body, await login('a@jia.com', 'pw-jia-123'));
    expect(member.status).toBe(403);
    expect((await member.json()).code).toBe('FORBIDDEN');
    expect(row('A017').targetMonth).toBeNull();
  });

  it('整份的形狀不對 → 400，一列都沒寫', async () => {
    for (const body of [{}, { rows: 'A017' }, { rows: [] }, { rows: [{ id: 'A017', moduleNo: 1, targetMonth: 30 }], dryRun: 'false' }]) {
      const resp = await importJson(body);
      expect(resp.status, JSON.stringify(body)).toBe(400);
      expect(typeof (await resp.json()).error).toBe('string');
    }
    expect(row('A017').targetMonth).toBeNull();
  });

  it('列數上限：500 列收、501 列整份 400', async () => {
    const one = { id: 'A017', moduleNo: 1, targetMonth: 30 };
    // 500 列全是同一支：形狀收下、逐列以「重複」退回 —— 驗的是上限，不是內容。
    const at = await importJson({ rows: Array.from({ length: 500 }, () => one), dryRun: true });
    expect(at.status).toBe(200);
    expect((await at.json()).failed).toHaveLength(500);
    const over = await importJson({ rows: Array.from({ length: 501 }, () => one) });
    expect(over.status).toBe(400);
    expect((await over.json()).error).toContain('500');
  });

  // 驗收（v2.1 §2 S25）：「300 支一次匯入、targetMonth 无 null」。
  it('300 支一次匯入：全部寫進去，targetMonth 沒有一支是 null', async () => {
    const rows = ACTIVITY_SEED.map((a, i) => ({
      id: a.id,
      moduleNo: a.moduleNo,
      targetMonth: (i * 7) % 217,
      targets: i % 2 ? ['mot.balance'] : [],
    }));
    const resp = await importJson({ rows });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ imported: 300, failed: [], warnings: [] });

    const { activityCoverage } = await import('../src/utils/activityAdmin');
    const list = (await (await client.get('/api/admin/activities', h(token))).json()).activities;
    expect(activityCoverage(list)).toEqual({ total: 300, targetMonthFilled: 300, targetsFilled: 150, active: 300 });
    expect(list.filter((a: any) => a.targetMonth === null)).toEqual([]);
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
