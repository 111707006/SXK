import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 首頁素材（客戶 10/22，#87／#88，開關 `HOME_MEDIA`）：後台上傳開屏與輪播、公開端點讀啟用中的。
 *
 * 要抓的錯：合作公司傳得進素材、格式不對或太大的檔寫進了媒體目錄、停用的還出現在首頁、連結收了 `javascript:`。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { homeMediaFromRow } = await import('../src/homeMedia/shape');
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const db = {
    rows: [] as Record<string, unknown>[],
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
    ],
  };
  const item = (r: Record<string, unknown>) => homeMediaFromRow(r)!;
  return {
    __db: db,
    __reset() {
      db.rows = [];
    },
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return db.admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return db.admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },
    async listHomeMedia() {
      return db.rows.map(item);
    },
    async findHomeMedia(id: number) {
      const r = db.rows.find(x => x.id === id);
      return r ? item(r) : null;
    },
    async createHomeMedia(input: { slot: string; kind: string; url: string; link: string | null }) {
      const sort = Math.max(0, ...db.rows.filter(r => r.slot === input.slot).map(r => Number(r.sort_order))) + 1;
      const row = { id: db.rows.length + 1, slot: input.slot, kind: input.kind, url: input.url, poster_url: null, link: input.link, sort_order: sort, active: 1, created_at: null };
      db.rows.push(row);
      return item(row);
    },
    async updateHomeMedia(id: number, patch: { link?: string | null; sortOrder?: number; active?: boolean; posterUrl?: string }) {
      const r = db.rows.find(x => x.id === id);
      if (!r) return null;
      if (patch.link !== undefined) r.link = patch.link;
      if (patch.sortOrder !== undefined) r.sort_order = patch.sortOrder;
      if (patch.active !== undefined) r.active = patch.active ? 1 : 0;
      if (patch.posterUrl !== undefined) r.poster_url = patch.posterUrl;
      return item(r);
    },
  };
});

vi.mock('../src/db/homeMedia', async () => {
  const { homeMediaFromRow, publicHomeMedia } = await import('../src/homeMedia/shape');
  const store = (await import('../src/admin/adminStore')) as any;
  return {
    async loadPublicHomeMedia() {
      return publicHomeMedia(store.__db.rows.map((r: Record<string, unknown>) => homeMediaFromRow(r)!));
    },
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-home-media-'));
process.env.MEDIA_DIR = TMP;
process.env.HOME_MEDIA = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-home-media';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(200, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);

let client: TestClient;
let store: any;
const h = (token: string) => ({ Authorization: `Bearer ${token}` });
const homeFiles = () => (fs.existsSync(path.join(TMP, 'home')) ? fs.readdirSync(path.join(TMP, 'home')) : []);

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function upload(query: string, body: Buffer, type: string, token?: string) {
  return client.request(`/api/admin/home-media?${query}`, { method: 'POST', headers: { 'Content-Type': type, ...(token ? h(token) : {}) }, body });
}

function patch(id: number, body: unknown, token: string) {
  return client.request(`/api/admin/home-media/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h(token) }, body: JSON.stringify(body) });
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  store.__reset();
  fs.rmSync(path.join(TMP, 'home'), { recursive: true, force: true });
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('誰傳得了', () => {
  it('未登入 401、合作公司 403，一個檔都不寫', async () => {
    expect((await upload('slot=banner&kind=image', JPG, 'image/jpeg')).status).toBe(401);
    const token = await login('a@jia.com', 'pw-jia-123');
    expect((await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).status).toBe(403);
    expect((await client.get('/api/admin/home-media', h(token))).status).toBe(403);
    expect(homeFiles()).toEqual([]);
    expect(store.__db.rows).toEqual([]);
  });
});

describe('擋下格式與大小，都不寫檔', () => {
  it('Content-Type 不對 415', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await upload('slot=banner&kind=image', JPG, 'image/gif', token)).status).toBe(415);
    expect((await upload('slot=banner&kind=video', JPG, 'image/jpeg', token)).status).toBe(415);
    expect(homeFiles()).toEqual([]);
  });

  it('檔頭不對 415（說是 png，其實不是）', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await upload('slot=banner&kind=image', JPG, 'image/png', token)).status).toBe(415);
    expect(homeFiles().filter(f => !f.startsWith('.'))).toEqual([]);
  });

  it('圖片超過 2 MB 413、暫存檔不留', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const big = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024, 1)]);
    expect((await upload('slot=banner&kind=image', big, 'image/jpeg', token)).status).toBe(413);
    expect(homeFiles()).toEqual([]);
    expect(store.__db.rows).toEqual([]);
  });

  it('沒指定位置或種類 400', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await upload('slot=nope&kind=image', JPG, 'image/jpeg', token)).status).toBe(400);
    expect((await upload('slot=banner', JPG, 'image/jpeg', token)).status).toBe(400);
  });
});

describe('上傳、公開端點、停用', () => {
  it('圖片與短片都存在 home/、網址帶版本、公開端點讀得到、/media 拿得到同一份', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const a = await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json();
    const b = await (await upload('slot=banner&kind=image', PNG, 'image/png', token)).json();
    const s = await (await upload('slot=splash&kind=video', MP4, 'video/mp4', token)).json();
    expect(a.item.url).toMatch(/^\/media\/home\/banner-\d+-[0-9a-f]{8}\.jpg\?v=\d+$/);
    expect(b.item.url).toMatch(/\.png\?v=\d+$/);
    expect(s.item.url).toMatch(/^\/media\/home\/splash-.*\.mp4\?v=\d+$/);

    const pub = await (await client.get('/api/home/media')).json();
    expect(pub.splash.id).toBe(s.item.id);
    expect(pub.banners.map((x: any) => x.id)).toEqual([a.item.id, b.item.id]);

    const served = await client.get(a.item.url);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(JPG)).toBe(true);
  });

  it('停用之後公開端點讀不到；重新啟用又讀得到', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const { item } = await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json();
    expect((await patch(item.id, { active: false }, token)).status).toBe(200);
    expect((await (await client.get('/api/home/media')).json()).banners).toEqual([]);
    await patch(item.id, { active: true }, token);
    expect((await (await client.get('/api/home/media')).json()).banners).toHaveLength(1);
  });

  it('排序：調了之後公開端點照新順序', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const a = (await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json()).item;
    const b = (await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json()).item;
    await patch(a.id, { sortOrder: 10 }, token);
    expect((await (await client.get('/api/home/media')).json()).banners.map((x: any) => x.id)).toEqual([b.id, a.id]);
  });

  it('連結：站內路徑與 https 收、其他 400', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const { item } = await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json();
    expect((await patch(item.id, { link: '/' }, token)).status).toBe(200);
    expect((await patch(item.id, { link: 'https://example.com/event' }, token)).status).toBe(200);
    for (const bad of ['javascript:alert(1)', 'http://example.com', '//evil.com', 'event']) {
      expect((await patch(item.id, { link: bad }, token)).status, bad).toBe(400);
    }
    expect((await patch(item.id, { link: null }, token)).status).toBe(200);
    expect(store.__db.rows[0].link).toBeNull();
  });

  it('短片封面另傳（jpg）；圖片沒有封面這一支', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const v = (await (await upload('slot=banner&kind=video', MP4, 'video/mp4', token)).json()).item;
    const i = (await (await upload('slot=banner&kind=image', JPG, 'image/jpeg', token)).json()).item;
    const put = (id: number) => client.request(`/api/admin/home-media/${id}/poster`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', ...h(token) }, body: JPG });
    const resp = await put(v.id);
    expect(resp.status).toBe(200);
    expect((await resp.json()).item.posterUrl).toMatch(/^\/media\/home\/poster-\d+-[0-9a-f]{8}\.jpg\?v=\d+$/);
    expect((await put(i.id)).status).toBe(404);
  });
});

describe('首頁設定帶開關', () => {
  it('homeMedia: true', async () => {
    expect((await (await client.get('/api/home/config')).json()).homeMedia).toBe(true);
  });
});
