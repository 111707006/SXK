import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * #118：服務關係開關開著，家長從單位／推薦人個人連結登入（`companySlug`＝`?c=`、`referrerCode`＝`&t=`），
 * 還沒有服務關係就直接掛上，寫一列紀錄（原因＝連結、家長自己）。已經有了先不動（問家長是 #120）。
 * 推薦人代號不屬於該單位或推薦人停用：當作只帶單位。個人治療師單位的連結（只有 `?c=`）就指向那位推薦人。
 * ⚠️ 開關必須在載入 `server.ts` 之前設定。
 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';
process.env.SERVICE_RELATIONS = '1';

const PHONE = '13800138000';
// jia（7）：機構，推薦人 zhang（70）、停用的 old（72）；yi（8）：機構，推薦人 wang（80）；solo（9）：個人治療師，推薦人 90。
const COMPANIES: Record<string, { id: number; kind: string }> = { jia: { id: 7, kind: 'institution' }, yi: { id: 8, kind: 'institution' }, solo: { id: 9, kind: 'therapist' } };
const REFERRERS = [
  { id: 70, companyId: 7, code: 'zhang', active: true },
  { id: 72, companyId: 7, code: 'old', active: false },
  { id: 80, companyId: 8, code: 'wang', active: true },
  { id: 90, companyId: 9, code: null, active: true },
];

interface Row { id: number; phone: string; company_id: number | null }
let users: Row[] = [];
let relations: Record<number, { companyId: number; referrerId: number | null }> = {};
let changes: any[] = [];
let nextUserId = 1;
let codeHash = '';

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async () => null,
  listUsersByPhone: async (phone: string) => users.filter(u => u.phone === phone).map(u => ({ ...u, has_reports: 0, has_orders: 0 })),
  createPhoneUser: async (phone: string, companyId: number | null) => {
    const row = { id: nextUserId++, phone, company_id: companyId };
    users.push(row);
    return row.id;
  },
  findLatestSmsCode: async (phone: string) => ({ id: 1, phone, code_hash: codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999 }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async (slug: string) =>
    COMPANIES[slug] ? { id: COMPANIES[slug].id, name: slug, slug, wecomWebhookUrl: null, active: true } : null,
  findCompanyByUserId: async () => null,
  // 照 SQL 的意思：有代號＝這個單位裡這個代號的那一位（不管停用沒）；沒代號＝個人治療師單位裡啟用的那一位。
  findLinkReferrer: async (companyId: number, code: string | null) => {
    if (code !== null) {
      const r = REFERRERS.find(x => x.companyId === companyId && x.code === code);
      return r ? { id: r.id, companyId: r.companyId, active: r.active } : null;
    }
    const unit = Object.values(COMPANIES).find(c => c.id === companyId);
    const r = unit?.kind === 'therapist' ? REFERRERS.find(x => x.companyId === companyId && x.active) : undefined;
    return r ? { id: r.id, companyId: r.companyId, active: r.active } : null;
  },
  getServiceRelationByUserId: async (userId: number) => relations[userId] ?? null,
  attachServiceRelation: async (userId: number, to: { companyId: number; referrerId: number | null }, reason: string) => {
    if (relations[userId]) return false;
    relations[userId] = { ...to };
    changes.push({ userId, from: null, to: { ...to }, actor: 'parent', reason });
    return true;
  },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  listUnlockedDimensions: async () => [],
}));

let client: TestClient;

beforeAll(async () => {
  const bcrypt = (await import('bcryptjs')).default;
  codeHash = bcrypt.hashSync('123456', 4);
  client = await startTestApp(await loadApp());
});
afterAll(async () => {
  await client.close();
  for (const k of ['A_COMPANIES', 'A_PHONE_IDENTITY', 'SERVICE_RELATIONS']) delete process.env[k];
});
beforeEach(() => {
  users = [];
  relations = {};
  changes = [];
  nextUserId = 1;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

async function login(companySlug?: string, referrerCode?: string): Promise<number> {
  const res = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456', companySlug, referrerCode });
  expect(res.status).toBe(200);
  return Number(JSON.parse(Buffer.from((await res.json()).token.split('.')[0], 'base64url').toString()).uid);
}

describe('還沒有服務關係：直接掛上', () => {
  it('?c=jia&t=zhang 進來的新家長：掛到 jia／zhang，紀錄原因＝連結、家長自己', async () => {
    const id = await login('jia', 'zhang');
    expect(relations[id]).toEqual({ companyId: 7, referrerId: 70 });
    expect(changes).toEqual([{ userId: id, from: null, to: { companyId: 7, referrerId: 70 }, actor: 'parent', reason: 'link' }]);
  });

  it('只帶單位：掛到單位、還沒標注', async () => {
    const id = await login('jia');
    expect(relations[id]).toEqual({ companyId: 7, referrerId: null });
  });

  it.each([
    ['推薦人代號是別的單位的', 'wang'],
    ['推薦人停用', 'old'],
    ['代號查無此人', 'nobody'],
    ['代號格式不對', '../x'],
  ])('%s：當作只帶單位', async (_n, code) => {
    const id = await login('jia', code);
    expect(relations[id]).toEqual({ companyId: 7, referrerId: null });
  });

  it('個人治療師單位的連結（只有 ?c=）：指向那位推薦人', async () => {
    const id = await login('solo');
    expect(relations[id]).toEqual({ companyId: 9, referrerId: 90 });
  });

  it('已經有帳號、還沒有服務關係的家長從連結登入：也掛上', async () => {
    users = [{ id: 40, phone: PHONE, company_id: null }];
    expect(await login('jia', 'zhang')).toBe(40);
    expect(relations[40]).toEqual({ companyId: 7, referrerId: 70 });
  });
});

describe('不掛', () => {
  it('沒有代號、代號認不得：不寫', async () => {
    await login();
    await login('nope', 'zhang');
    expect(changes).toEqual([]);
  });

  it('已經有服務關係、點了別人的連結：先不動（換人提示是 #120）', async () => {
    users = [{ id: 40, phone: PHONE, company_id: 8 }];
    relations[40] = { companyId: 8, referrerId: 80 };
    await login('jia', 'zhang');
    expect(relations[40]).toEqual({ companyId: 8, referrerId: 80 });
    expect(changes).toEqual([]);
  });
});
