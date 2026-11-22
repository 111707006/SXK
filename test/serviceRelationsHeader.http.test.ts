import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 頁首徽章與客服二維碼跟著服務關係（#121，ADR-0020）：服務關係開著時，已登入的家長看 `service_relations`
 * 那一列的單位，不看帳號上的歸屬；沒有服務關係＝森心康直屬（徽章 null、二維碼預設那張）；改派之後下一次讀就換。
 * 沒登入照舊看 `?c=`。開關關著見 `serviceRelationsHeaderOff.http.test.ts`，專案 B 見 `serviceRelationsHeaderProjectB.http.test.ts`。
 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';
process.env.SERVICE_RELATIONS = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-service-relations-header';

const store = vi.hoisted(() => ({
  companies: new Map<number, { name: string; slug: string; logoUrl: string | null; active: boolean }>(),
  /** users.company_id（帳號歸屬，不可逆）。 */
  accounts: new Map<number, number | null>(),
  /** service_relations：user_id → company_id。 */
  relations: new Map<number, number>(),
}));

vi.mock('../src/db/mysql', async importOriginal => {
  const real = (await importOriginal()) as Record<string, unknown>;
  const active = (id: number | null | undefined) => {
    const c = id == null ? undefined : store.companies.get(id);
    return c && c.active ? { id: id as number, ...c } : null;
  };
  const bySlug = (slug: string) => {
    for (const [id, c] of store.companies) if (c.slug === slug) return active(id);
    return null;
  };
  const badge = (c: { name: string; logoUrl: string | null } | null) => (c ? { name: c.name, logoUrl: c.logoUrl } : null);
  return {
    ...real,
    isConfigured: () => true,
    async findCompanyBadgeByUserId(userId: number) {
      return badge(active(store.accounts.get(userId)));
    },
    async findActiveCompanyIdByUserId(userId: number) {
      return active(store.accounts.get(userId))?.id ?? null;
    },
    async findServiceCompanyBadgeByUserId(userId: number) {
      return badge(active(store.relations.get(userId)));
    },
    async findServiceActiveCompanyIdByUserId(userId: number) {
      return active(store.relations.get(userId))?.id ?? null;
    },
    async findCompanyBadgeBySlug(slug: string) {
      return badge(bySlug(slug));
    },
    async findActiveCompanyIdBySlug(slug: string) {
      return bySlug(slug)?.id ?? null;
    },
  };
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-sr-header-'));
process.env.MEDIA_DIR = TMP;

let client: TestClient;

function putQr(stem: string) {
  fs.mkdirSync(path.join(TMP, 'wecom'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'wecom', `${stem}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
}
const badgeOf = async (query = '', headers: Record<string, string> = {}) => (await (await client.get(`/api/company-badge${query}`, headers)).json()).company;
const qrOf = async (query = '', headers: Record<string, string> = {}) => (await (await client.get(`/api/wecom-qr${query}`, headers)).json()).url as string | null;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  putQr('default');
  putQr('company-7');
  putQr('company-8');
});

beforeEach(() => {
  store.companies.clear();
  store.companies.set(7, { name: '甲医院', slug: 'jia', logoUrl: '/media/logo-jia.png', active: true });
  store.companies.set(8, { name: '乙医院', slug: 'yi', logoUrl: null, active: true });
  store.companies.set(9, { name: '丙医院', slug: 'bing', logoUrl: null, active: false });
  store.accounts.clear();
  store.relations.clear();
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('服務關係開著、已登入', () => {
  it('有服務關係：徽章與二維碼都是那個單位的，不看帳號歸屬', async () => {
    store.accounts.set(5, 7);
    store.relations.set(5, 8);
    expect(await badgeOf('', bearer(5))).toEqual({ name: '乙医院', logoUrl: null });
    expect(await qrOf('', bearer(5))).toMatch(/^\/media\/wecom\/company-8\.png\?v=\d+$/);
  });

  it('沒有服務關係：徽章 null、二維碼預設那張（帳號上有歸屬也一樣）', async () => {
    store.accounts.set(5, 7);
    expect(await badgeOf('', bearer(5))).toBeNull();
    expect(await qrOf('', bearer(5))).toMatch(/^\/media\/wecom\/default\.png\?v=\d+$/);
  });

  it('連結上的 ?c= 不蓋過服務關係', async () => {
    store.relations.set(5, 8);
    expect(await badgeOf('?c=jia', bearer(5))).toEqual({ name: '乙医院', logoUrl: null });
    expect(await qrOf('?c=jia', bearer(5))).toMatch(/company-8\.png/);
  });

  it('服務的單位停用了：當作沒有（徽章 null、二維碼預設）', async () => {
    store.relations.set(5, 9);
    expect(await badgeOf('', bearer(5))).toBeNull();
    expect(await qrOf('', bearer(5))).toMatch(/default\.png/);
  });

  it('改派之後下一次讀就換成新單位', async () => {
    store.relations.set(5, 7);
    expect(await badgeOf('', bearer(5))).toEqual({ name: '甲医院', logoUrl: '/media/logo-jia.png' });
    expect(await qrOf('', bearer(5))).toMatch(/company-7\.png/);
    store.relations.set(5, 8);
    expect(await badgeOf('', bearer(5))).toEqual({ name: '乙医院', logoUrl: null });
    expect(await qrOf('', bearer(5))).toMatch(/company-8\.png/);
    store.relations.delete(5);
    expect(await badgeOf('', bearer(5))).toBeNull();
    expect(await qrOf('', bearer(5))).toMatch(/default\.png/);
  });
});

describe('服務關係開著、沒登入', () => {
  it('照舊看 ?c=', async () => {
    expect(await badgeOf('?c=jia')).toEqual({ name: '甲医院', logoUrl: '/media/logo-jia.png' });
    expect(await qrOf('?c=jia')).toMatch(/company-7\.png/);
    expect(await badgeOf('?c=bing')).toBeNull();
    expect(await qrOf('?c=bing')).toMatch(/default\.png/);
    expect(await badgeOf()).toBeNull();
    expect(await qrOf()).toMatch(/default\.png/);
  });
});
