import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { ICS_LINK_TTL_MS, createIcsLinkToken } from '../src/t2/icsLink';
import type { PracticePrefs } from '../src/t2/practice';

/**
 * `.ics` 的兩種身分（Keep 規格 §3.8「加到日曆」，票 B7）。
 *
 *   POST /api/t2/practice-prefs/ics-link  （Bearer）→ { url }：短時效、不透明的連結
 *   GET  /api/t2/practice-prefs.ics        Bearer，或 `?t=` 帶那條連結
 *
 * 【這裡在防什麼】
 * 1. 連結就是憑證：過期、竄改都 401；一條連結只換得到簽它的那位家長的日曆，別人的連結拿不到自己的，
 *    也改不成別人的。
 * 2. 連結只開 `.ics` 這一支：帶到別的 `/api/t2/*` 上不算登入。
 * 3. 付費閘門照樣擋：連結對應的家長沒買 → 403 `LOCKED`；沒設提醒 → 404。
 * 4. 網址裡沒有個資（手機號、使用者 id）。
 * 專案 B 沒有這兩支（404）在 `t2PracticeProjectB.http.test.ts`。
 */

const PARENT = 1;
const OTHER = 2;
const LOCKED = 3;

const users: Record<number, { id: number; phone: string }> = {
  [PARENT]: { id: PARENT, phone: '13800000001' },
  [OTHER]: { id: OTHER, phone: '13800000002' },
  [LOCKED]: { id: LOCKED, phone: '13800000003' },
};

let dbConfigured = true;
const prefsTable = new Map<number, PracticePrefs>();

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => dbConfigured,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId !== LOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  saveUserData: async () => {},
  getT2Diagnosis: async () => null,
  saveT2Diagnosis: async () => {},
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2PracticePrefs', () => ({
  findPracticePrefs: async (userId: number) => prefsTable.get(userId) ?? null,
  savePracticePrefs: async (userId: number, prefs: PracticePrefs) => {
    prefsTable.set(userId, prefs);
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  dbConfigured = true;
  prefsTable.clear();
  prefsTable.set(PARENT, { reminderDays: [0, 2, 4], reminderTime: '19:30' });
  prefsTable.set(OTHER, { reminderDays: [5], reminderTime: '08:30' });
  prefsTable.set(LOCKED, { reminderDays: [1], reminderTime: '12:30' });
});

afterEach(() => {
  vi.useRealTimers();
});

async function linkFor(userId: number): Promise<string> {
  const resp = await client.request('/api/t2/practice-prefs/ics-link', { method: 'POST', headers: bearer(userId) });
  expect(resp.status).toBe(200);
  const body = await resp.json();
  return body.url as string;
}

/** 日曆檔裡那一行 RRULE 的星期（認得出是誰的提醒）。 */
function bydayOf(ics: string): string | undefined {
  return /\r\nRRULE:FREQ=WEEKLY;BYDAY=([A-Z,]+)\r\n/.exec(ics)?.[1];
}

describe('POST /api/t2/practice-prefs/ics-link', () => {
  it('回一條站內的 .ics 連結，網址裡沒有使用者 id、沒有手機號', async () => {
    const url = await linkFor(PARENT);
    expect(url).toMatch(/^\/api\/t2\/practice-prefs\.ics\?t=[A-Za-z0-9_-]+$/);
    const token = url.split('?t=')[1];
    expect(token).not.toContain(users[PARENT].phone);
    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toMatch(/"u"|13800000001/);
  });

  it('不讓中間層快取（連結本身就是憑證）', async () => {
    const resp = await client.request('/api/t2/practice-prefs/ics-link', { method: 'POST', headers: bearer(PARENT) });
    expect(resp.headers.get('cache-control')).toBe('no-store');
  });

  it('沒設提醒 → 404 REMINDER_NOT_SET（不發一條開了也是 404 的連結）', async () => {
    prefsTable.delete(PARENT);
    const resp = await client.request('/api/t2/practice-prefs/ics-link', { method: 'POST', headers: bearer(PARENT) });
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('REMINDER_NOT_SET');
  });

  it('未登入 → 401；未付費 → 403 LOCKED', async () => {
    const anon = await client.request('/api/t2/practice-prefs/ics-link', { method: 'POST' });
    expect(anon.status).toBe(401);
    const locked = await client.request('/api/t2/practice-prefs/ics-link', { method: 'POST', headers: bearer(LOCKED) });
    expect(locked.status).toBe(403);
    expect((await locked.json()).code).toBe('LOCKED');
  });
});

describe('GET /api/t2/practice-prefs.ics 的兩種身分', () => {
  it('Bearer 照舊可以', async () => {
    const resp = await client.get('/api/t2/practice-prefs.ics', bearer(PARENT));
    expect(resp.status).toBe(200);
    expect(bydayOf(await resp.text())).toBe('MO,WE,FR');
  });

  it('連結可以：不帶任何標頭，回 text/calendar 與下載檔名，不讓中間層快取', async () => {
    const resp = await client.get(await linkFor(PARENT));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(resp.headers.get('content-disposition')).toMatch(/^attachment; filename="[\w.-]+\.ics"$/);
    expect(resp.headers.get('cache-control')).toBe('no-store');
    expect(bydayOf(await resp.text())).toBe('MO,WE,FR');
  });

  it('過了 10 分鐘 → 401', async () => {
    const url = await linkFor(PARENT);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + ICS_LINK_TTL_MS + 1000);
    const resp = await client.get(url);
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  it('改過的連結 → 401；空的 t= → 401', async () => {
    const url = await linkFor(PARENT);
    const i = url.length - 10;
    const tampered = url.slice(0, i) + (url[i] === 'A' ? 'B' : 'A') + url.slice(i + 1);
    expect((await client.get(tampered)).status).toBe(401);
    expect((await client.get('/api/t2/practice-prefs.ics?t=')).status).toBe(401);
  });

  it('連結帶了卻是壞的，就算另外帶著有效的 Bearer 也 401（連結說了算，不退回標頭）', async () => {
    const resp = await client.get('/api/t2/practice-prefs.ics?t=broken', bearer(PARENT));
    expect(resp.status).toBe(401);
  });

  it('一條連結只換得到簽它的那位家長：別人的連結拿不到自己的，帶著自己的 Bearer 也一樣', async () => {
    const mine = await (await client.get(await linkFor(PARENT))).text();
    const theirs = await (await client.get(await linkFor(OTHER))).text();
    expect(bydayOf(mine)).toBe('MO,WE,FR');
    expect(bydayOf(theirs)).toBe('SA');
    // OTHER 拿著 PARENT 的連結、帶著自己的 Bearer：拿到的是連結那位的，不是自己的
    const crossed = await (await client.get(await linkFor(PARENT), bearer(OTHER))).text();
    expect(bydayOf(crossed)).toBe('MO,WE,FR');
    const uidOf = (ics: string) => /\r\nUID:([^\r]+)\r\n/.exec(ics)?.[1];
    expect(uidOf(mine)).not.toBe(uidOf(theirs));
  });

  it('連結只開 .ics 這一支：帶到別的 /api/t2/* 上不算登入', async () => {
    const token = (await linkFor(PARENT)).split('?t=')[1];
    expect((await client.get(`/api/t2/practice-prefs?t=${token}`)).status).toBe(401);
    expect((await client.get(`/api/t2/checkins?from=2026-09-01&to=2026-09-30&t=${token}`)).status).toBe(401);
    expect((await client.request(`/api/t2/practice-prefs/ics-link?t=${token}`, { method: 'POST' })).status).toBe(401);
  });

  it('連結對應的家長沒買 T2 → 403 LOCKED（閘門照連結上的人檢查，不是放行）', async () => {
    // 未付費的家長自己換不到連結（上面驗過 403）；這裡驗的是「連結有效、人沒付費」這一格：
    // 例如拿到連結之後權益被收回。直接用伺服器同一把秘密簽一條給他。
    const lockedToken = createIcsLinkToken(String(LOCKED), process.env.SESSION_SECRET!);
    const resp = await client.get(`/api/t2/practice-prefs.ics?t=${lockedToken}`);
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  it('Express 也認的寫法（大小寫不同、結尾斜線）：閘門與路由認的是同一個人', async () => {
    // Express 的路由不分大小寫、容許結尾斜線，這幾種寫法都會進 .ics 那一支。閘門若只比對一模一樣的
    // 路徑，會改看 Bearer：付費的 OTHER 帶著自己的 Bearer 就能替沒付費的 LOCKED 拿到他的日曆檔。
    const lockedToken = createIcsLinkToken(String(LOCKED), process.env.SESSION_SECRET!);
    for (const path of ['/api/t2/PRACTICE-PREFS.ics', '/api/t2/practice-prefs.ics/', '/api/t2/Practice-Prefs.ICS/']) {
      const withPaidBearer = await client.get(`${path}?t=${lockedToken}`, bearer(OTHER));
      expect(withPaidBearer.status, path).toBe(403);
      // 付費家長自己的連結在這幾種寫法上照樣能用
      const mine = await client.get(`${path}?t=${(await linkFor(PARENT)).split('?t=')[1]}`);
      expect(mine.status, path).toBe(200);
      expect(bydayOf(await mine.text()), path).toBe('MO,WE,FR');
    }
  });

  it('連結對應的帳號已經刪了 → 401', async () => {
    const ghost = createIcsLinkToken('999', process.env.SESSION_SECRET!);
    expect((await client.get(`/api/t2/practice-prefs.ics?t=${ghost}`)).status).toBe(401);
  });

  it('連結有效但後來清掉了提醒 → 404 REMINDER_NOT_SET', async () => {
    const url = await linkFor(PARENT);
    prefsTable.delete(PARENT);
    const resp = await client.get(url);
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('REMINDER_NOT_SET');
  });
});

describe('記憶體模式（沒有資料庫）', () => {
  beforeEach(() => {
    dbConfigured = false;
  });

  it('提醒存在記憶體裡：換得到連結、開得出日曆檔；替身的表沒被碰到', async () => {
    const put = await client.request('/api/t2/practice-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...bearer(PARENT) },
      body: JSON.stringify({ reminderDays: [6], reminderTime: '20:30' }),
    });
    expect(put.status).toBe(200);
    const before = new Map(prefsTable);
    const resp = await client.get(await linkFor(PARENT));
    expect(resp.status).toBe(200);
    expect(bydayOf(await resp.text())).toBe('SU');
    expect(prefsTable).toEqual(before);
  });

  it('過期、竄改照樣 401（閘門在記憶體模式放行，路由自己還要驗）', async () => {
    await client.request('/api/t2/practice-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...bearer(PARENT) },
      body: JSON.stringify({ reminderDays: [6], reminderTime: '20:30' }),
    });
    expect((await client.get('/api/t2/practice-prefs.ics?t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).status).toBe(401);
  });
});
