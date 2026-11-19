import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 的客服二維碼（使用者 2026-11-19：「预约专家」改二維碼要比照 A，各合作公司自己上傳）：
 * 公開端點、後台上傳、`/media/wecom` 都在；B 本來就分合作公司，不看 `A_COMPANIES`。
 * B 其餘的 `/media`（示範片）照舊不掛。
 * ⚠️ 必須在載入 `server.ts` 之前設定模式。
 */
process.env.APP_MODE = 't1only';
process.env.SESSION_SECRET ||= 'test-session-secret-for-wecom-qr-b';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const god = { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-god-123', 4) };
  const company = { id: 7, name: '美兆', slug: 'mz', active: true, logoUrl: null, wecomWebhookUrl: null, createdAt: null };
  return {
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return email === god.email ? god : null;
    },
    async findAdminUserById(id: number) {
      return id === god.id ? god : null;
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
      return slug === 'mz' ? 7 : null;
    },
    async findActiveCompanyIdByUserId() {
      return null;
    },
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-wecom-qr-b-'));
process.env.MEDIA_DIR = TMP;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  delete process.env.MEDIA_DIR;
  process.env.APP_MODE = '';
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('專案 B', () => {
  it('還沒上傳：公開端點回 null（家長端用內建的）', async () => {
    const resp = await client.get('/api/wecom-qr?c=mz');
    expect(resp.status).toBe(200);
    expect((await resp.json()).url).toBeNull();
  });

  it('預設＋公司自己的：進站代號拿到自己的，/media/wecom 拿得到檔', async () => {
    const { token } = await (await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' })).json();
    const auth = { Authorization: `Bearer ${token}` };
    await client.request('/api/admin/wecom-qr/default', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', ...auth }, body: JPG });
    const list = await (await client.request('/api/admin/wecom-qr/7', { method: 'PUT', headers: { 'Content-Type': 'image/png', ...auth }, body: PNG })).json();
    expect(list.companies['7']).toMatch(/^\/media\/wecom\/company-7\.png\?v=\d+$/);

    const own = (await (await client.get('/api/wecom-qr?c=mz')).json()).url;
    expect(own).toBe(list.companies['7']);
    expect((await (await client.get('/api/wecom-qr?c=other')).json()).url).toBe(list.default);
    const served = await client.get(own);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('其餘 /media 照舊不掛', async () => {
    fs.mkdirSync(path.join(TMP, 'activities'), { recursive: true });
    fs.writeFileSync(path.join(TMP, 'activities', 'A001.jpg'), JPG);
    expect((await client.get('/media/activities/A001.jpg')).status).not.toBe(200);
  });
});
