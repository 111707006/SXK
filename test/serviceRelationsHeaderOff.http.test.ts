import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 服務關係開關關著（#121）：頁首徽章與客服二維碼照舊看帳號歸屬，`service_relations` 有列也不看。
 */
process.env.A_COMPANIES = '1';
delete process.env.SERVICE_RELATIONS;
process.env.SESSION_SECRET ||= 'test-session-secret-for-service-relations-header-off';

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

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-sr-header-off-'));
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

describe('服務關係開關關著', () => {
  it('已登入：照舊看帳號歸屬，服務關係有列也不看', async () => {
    store.accounts.set(5, 7);
    store.relations.set(5, 8);
    expect(await badgeOf('', bearer(5))).toEqual({ name: '甲医院', logoUrl: '/media/logo-jia.png' });
    expect(await qrOf('', bearer(5))).toMatch(/company-7\.png/);
  });

  it('已登入、帳號沒歸屬：徽章 null、二維碼預設（服務關係有列也一樣）', async () => {
    store.relations.set(5, 8);
    expect(await badgeOf('', bearer(5))).toBeNull();
    expect(await qrOf('', bearer(5))).toMatch(/default\.png/);
  });

  it('沒登入：照舊看 ?c=', async () => {
    expect(await badgeOf('?c=yi')).toEqual({ name: '乙医院', logoUrl: null });
    expect(await qrOf('?c=yi')).toMatch(/company-8\.png/);
  });
});
