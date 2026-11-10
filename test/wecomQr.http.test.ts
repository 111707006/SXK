import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 企業微信客服二維碼（使用者 2026-11-10，後台「合作公司」分頁；`src/wecomQr/store.ts`）。
 *
 * 要抓的錯：合作公司換得了全站的二維碼、格式不對或太大的檔寫進了媒體目錄、換副檔名後舊圖還被讀到、
 * 公司自己的二維碼沒蓋過預設、移除後還讀得到、不存在的公司寫得進檔。
 */

process.env.A_COMPANIES = '1';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
    { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 7, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
  ];
  const company = { id: 7, name: '甲医院', slug: 'jia', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null };
  return {
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [company];
    },
    async findCompanyById(id: number) {
      return id === company.id ? company : null;
    },
  };
});

vi.mock('../src/db/mysql', async importOriginal => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return {
    ...real,
    isConfigured: () => true,
    async findActiveCompanyIdBySlug(slug: string) {
      return slug === 'jia' ? 7 : null;
    },
    async findActiveCompanyIdByUserId() {
      return null;
    },
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-wecom-qr-'));
process.env.MEDIA_DIR = TMP;
process.env.SESSION_SECRET ||= 'test-session-secret-for-wecom-qr';

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);

let client: TestClient;
const h = (token: string) => ({ Authorization: `Bearer ${token}` });
const files = () => (fs.existsSync(path.join(TMP, 'wecom')) ? fs.readdirSync(path.join(TMP, 'wecom')).sort() : []);

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function put(key: string, body: Buffer, type: string, token?: string) {
  return client.request(`/api/admin/wecom-qr/${key}`, { method: 'PUT', headers: { 'Content-Type': type, ...(token ? h(token) : {}) }, body });
}

const publicUrl = async (query = '') => (await (await client.get(`/api/wecom-qr${query}`)).json()).url;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  fs.rmSync(path.join(TMP, 'wecom'), { recursive: true, force: true });
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('誰換得了', () => {
  it('未登入 401、合作公司 403，一個檔都不寫', async () => {
    expect((await put('default', JPG, 'image/jpeg')).status).toBe(401);
    const token = await login('a@jia.com', 'pw-jia-123');
    expect((await put('default', JPG, 'image/jpeg', token)).status).toBe(403);
    expect((await put('7', JPG, 'image/jpeg', token)).status).toBe(403);
    expect((await client.get('/api/admin/wecom-qr', h(token))).status).toBe(403);
    expect(files()).toEqual([]);
  });

  it('不存在的公司、認不得的鍵 404，不寫檔', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await put('99', JPG, 'image/jpeg', token)).status).toBe(404);
    expect((await put('..%2Fx', JPG, 'image/jpeg', token)).status).toBe(404);
    expect(files()).toEqual([]);
  });
});

describe('擋下格式與大小，都不寫檔', () => {
  it('Content-Type 不對、檔頭不對 415', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await put('default', JPG, 'image/gif', token)).status).toBe(415);
    expect((await put('default', JPG, 'image/png', token)).status).toBe(415);
    expect(files().filter(f => !f.startsWith('.'))).toEqual([]);
  });

  it('超過 2 MB 413、暫存檔不留', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const big = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024, 1)]);
    expect((await put('default', big, 'image/jpeg', token)).status).toBe(413);
    expect(files()).toEqual([]);
  });
});

describe('上傳、公開端點、移除', () => {
  it('還沒上傳：公開端點回 null（家長端用內建的）', async () => {
    expect(await publicUrl()).toBeNull();
    expect(await publicUrl('?c=jia')).toBeNull();
  });

  it('預設那張：上傳後公開端點回帶版本的網址，/media 拿得到同一份', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await put('default', JPG, 'image/jpeg', token);
    expect(resp.status).toBe(200);
    const list = await resp.json();
    expect(list.default).toMatch(/^\/media\/wecom\/default\.jpg\?v=\d+$/);
    expect(list.companies).toEqual({});

    const url = await publicUrl();
    expect(url).toBe(list.default);
    const served = await client.get(url);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(JPG)).toBe(true);
  });

  it('換成 png：舊的 jpg 刪掉，只剩一張', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    await put('default', JPG, 'image/jpeg', token);
    const list = await (await put('default', PNG, 'image/png', token)).json();
    expect(files()).toEqual(['default.png']);
    expect(list.default).toMatch(/^\/media\/wecom\/default\.png\?v=\d+$/);
  });

  it('公司自己的蓋過預設；別的進站代號仍是預設', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    await put('default', JPG, 'image/jpeg', token);
    const list = await (await put('7', PNG, 'image/png', token)).json();
    expect(list.companies['7']).toMatch(/^\/media\/wecom\/company-7\.png\?v=\d+$/);
    expect(await publicUrl('?c=jia')).toBe(list.companies['7']);
    expect(await publicUrl('?c=other')).toBe(list.default);
    expect(await publicUrl()).toBe(list.default);
  });

  it('移除公司的 → 退回預設；移除預設 → null', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    await put('default', JPG, 'image/jpeg', token);
    await put('7', PNG, 'image/png', token);
    const afterCompany = await (await client.request('/api/admin/wecom-qr/7', { method: 'DELETE', headers: h(token) })).json();
    expect(afterCompany.companies).toEqual({});
    expect(await publicUrl('?c=jia')).toBe(afterCompany.default);
    const afterDefault = await (await client.request('/api/admin/wecom-qr/default', { method: 'DELETE', headers: h(token) })).json();
    expect(afterDefault.default).toBeNull();
    expect(await publicUrl('?c=jia')).toBeNull();
    expect(files()).toEqual([]);
  });
});
