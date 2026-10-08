import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { looksLike, mediaUrlOf, readSeconds, saveActivityMedia } from '../src/admin/activityMedia';

/**
 * 後台上傳示範片與封面（使用者 2026-10-08，`src/admin/activityMedia.ts`）。
 *
 * 要抓的錯：合作公司傳得進片子、認不得的編號也寫了檔、不是 mp4 的東西蓋掉了正在播的那一支、
 * 傳上去的片子 `/media` 拿不到、網址不帶版本（換片後家長看到舊的）。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const { ACTIVITY_SEED } = await import('../src/t2/activitySeed');
  type Activity = import('../src/t2/types').Activity;
  type Patch = import('../src/utils/activityAdmin').ActivityPatch;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const seed = (): Activity[] => ACTIVITY_SEED.map(a => ({ ...a, dimensions: [...a.dimensions] }));
  const db = {
    activities: seed(),
    admins: [
      { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
      { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
    ],
  };
  return {
    __db: db,
    __reset() {
      db.activities = seed();
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
    async listActivities() {
      return db.activities;
    },
    async updateActivity(id: string, patch: Patch) {
      const existing = db.activities.find(a => a.id === id);
      if (!existing) return null;
      Object.assign(existing, patch);
      return existing;
    },
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-upload-'));
process.env.MEDIA_DIR = TMP;
process.env.SESSION_SECRET ||= 'test-session-secret-for-upload';

/** 最小的「看起來是 mp4」：第 4–8 位元組是 ftyp。 */
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(200, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);

let client: TestClient;
let store: any;
const h = (token: string) => ({ Authorization: `Bearer ${token}` });
const row = (id: string) => store.__db.activities.find((a: any) => a.id === id);
const fileOf = (name: string) => path.join(TMP, 'activities', name);

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function put(url: string, body: Buffer, type: string, token?: string) {
  return client.request(url, { method: 'PUT', headers: { 'Content-Type': type, ...(token ? h(token) : {}) }, body });
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  store = await import('../src/admin/adminStore');
});

beforeEach(() => {
  store.__reset();
  fs.rmSync(path.join(TMP, 'activities'), { recursive: true, force: true });
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('誰傳得了', () => {
  it('未登入 401、合作公司 403，一個檔都不寫', async () => {
    expect((await put('/api/admin/activities/A017/video', MP4, 'video/mp4')).status).toBe(401);
    const token = await login('a@jia.com', 'pw-jia-123');
    expect((await put('/api/admin/activities/A017/video', MP4, 'video/mp4', token)).status).toBe(403);
    expect(fs.existsSync(fileOf('A017.mp4'))).toBe(false);
    expect(row('A017').videoUrl).toBeNull();
  });
});

describe('全域管理員上傳', () => {
  it('示範片：存成 A017.mp4、網址帶版本、片長寫進去；/media 拿得到同一份', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await put('/api/admin/activities/A017/video?seconds=12', MP4, 'video/mp4', token);
    expect(resp.status).toBe(200);
    const { activity } = await resp.json();
    expect(activity.videoUrl).toMatch(/^\/media\/activities\/A017\.mp4\?v=\d+$/);
    expect(activity.videoSeconds).toBe(12);
    expect(fs.readFileSync(fileOf('A017.mp4')).equals(MP4)).toBe(true);
    const served = await client.get(activity.videoUrl);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(MP4)).toBe(true);
    // 暫存檔不留下
    expect(fs.readdirSync(path.join(TMP, 'activities')).filter(f => f.startsWith('.upload-'))).toEqual([]);
  });

  it('封面：存成 A017.jpg、只改 posterUrl', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await put('/api/admin/activities/A017/poster', JPG, 'image/jpeg', token);
    expect(resp.status).toBe(200);
    expect((await resp.json()).activity.posterUrl).toMatch(/^\/media\/activities\/A017\.jpg\?v=\d+$/);
    expect(row('A017').videoUrl).toBeNull();
    expect(fs.readFileSync(fileOf('A017.jpg')).equals(JPG)).toBe(true);
  });

  it('不是 mp4 的東西不會蓋掉原本那一支', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    await put('/api/admin/activities/A017/video', MP4, 'video/mp4', token);
    const before = row('A017').videoUrl;
    const fake = await put('/api/admin/activities/A017/video', Buffer.from('<html>not a video</html>'), 'video/mp4', token);
    expect(fake.status).toBe(415);
    const wrongType = await put('/api/admin/activities/A017/video', MP4, 'video/quicktime', token);
    expect(wrongType.status).toBe(415);
    expect(fs.readFileSync(fileOf('A017.mp4')).equals(MP4)).toBe(true);
    expect(row('A017').videoUrl).toBe(before);
  });

  it('認不得的編號 404、一個檔都不寫；片長不對 400', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    expect((await put('/api/admin/activities/A999/video', MP4, 'video/mp4', token)).status).toBe(404);
    expect((await put('/api/admin/activities/..%2Fx/video', MP4, 'video/mp4', token)).status).toBe(404);
    expect((await put('/api/admin/activities/A017/video?seconds=0', MP4, 'video/mp4', token)).status).toBe(400);
    expect((await put('/api/admin/activities/A017/video?seconds=abc', MP4, 'video/mp4', token)).status).toBe(400);
    expect(fs.existsSync(path.join(TMP, 'activities')) ? fs.readdirSync(path.join(TMP, 'activities')) : []).toEqual([]);
  });
});

describe('純函式', () => {
  it('認檔頭', () => {
    expect(looksLike('video', MP4)).toBe(true);
    expect(looksLike('video', JPG)).toBe(false);
    expect(looksLike('poster', JPG)).toBe(true);
    expect(looksLike('poster', MP4)).toBe(false);
  });

  it('網址與片長', () => {
    expect(mediaUrlOf('A001', 'video', 5)).toBe('/media/activities/A001.mp4?v=5');
    expect(readSeconds(undefined)).toBeNull();
    expect(readSeconds('30')).toBe(30);
    expect(readSeconds('3601')).toBeUndefined();
    expect(readSeconds('1.5')).toBeUndefined();
  });

  it('超過上限：413、不留下任何檔', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-upload-big-'));
    const big = Readable.from([MP4, Buffer.alloc(5000)]);
    const r = await saveActivityMedia(big, 'video/mp4', dir, 'A001', 'video', 1000);
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect(fs.readdirSync(path.join(dir, 'activities'))).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
