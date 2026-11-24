import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadApp, startTestApp, type TestClient } from './helpers/httpApp';
import { parseEntryCode, resolveProxySms } from '../src/serviceRelations/proxySms';

/** 代填簡訊的短連結 `/g/:code`（`PROXY_SMS`）、開關與資料表。 */
Object.assign(process.env, { APP_MODE: 'full', A_COMPANIES: '1', A_PHONE_IDENTITY: '1', SERVICE_RELATIONS: '1', TRAINING_PLAN: '1', TRAINING_PUSH_V3: '1', PROXY_SMS: '1' });

vi.mock('../src/admin/adminStore', async importOriginal => ({
  ...(await importOriginal<object>()),
  async findReferrer(id: number) {
    if (id === 99) throw new Error('db down');
    return (
      {
        70: { id: 70, active: true, companyId: 7, companySlug: 'jia', companyKind: 'institution', code: 'zhang' },
        71: { id: 71, active: true, companyId: 8, companySlug: 'li', companyKind: 'therapist', code: null },
        72: { id: 72, active: false, companyId: 7, companySlug: 'jia', companyKind: 'institution', code: 'old' },
        73: { id: 73, active: true, companyId: 7, companySlug: 'jia', companyKind: 'institution', code: null },
      } as any
    )[id] ?? null;
  },
  async findCompanyById(id: number) {
    return ({ 7: { id: 7, slug: 'jia', active: true }, 8: { id: 8, slug: 'li', active: true }, 9: { id: 9, slug: 'off', active: false } } as any)[id] ?? null;
  },
}));

let client: TestClient;
beforeAll(async () => {
  client = await startTestApp(await loadApp());
});
afterAll(() => client.close());

it.each([
  ['t70', '/?c=jia&t=zhang'],
  ['t71', '/?c=li'],
  ['t73', '/?c=jia'],
  ['u7', '/?c=jia'],
  ['t72', '/'],
  ['u9', '/'],
  ['t12345', '/'],
  ['t99', '/'],
  ['x1', '/'],
])('/g/%s → %s', async (code, target) => {
  const res = await client.request(`/g/${code}`, { redirect: 'manual' });
  expect(res.status).toBe(302);
  expect(res.headers.get('location')).toBe(target);
  expect(res.headers.get('cache-control')).toBe('no-store');
});

describe('規則', () => {
  it('短碼只認 t／u 加正整數', () => {
    expect(parseEntryCode('t70')).toEqual({ kind: 'referrer', id: 70 });
    for (const bad of ['t0', 't', 'T1', 't1a', '../x', '', null]) expect(parseEntryCode(bad)).toBeNull();
  });
  it('開關：B 不生效、A 少了服務關係或訓練計劃起不來', () => {
    const all = { projectA: true, serviceRelations: true, trainingPlan: true };
    expect(resolveProxySms(true, all)).toBe(true);
    expect(resolveProxySms(false, all)).toBe(false);
    expect(resolveProxySms(true, { ...all, projectA: false })).toBe(false);
    expect(() => resolveProxySms(true, { ...all, serviceRelations: false })).toThrow();
    expect(() => resolveProxySms(true, { ...all, trainingPlan: false })).toThrow();
  });
  it('schema 與遷移的 CREATE TABLE 一字不差，遷移只建表', () => {
    const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    const block = (s: string) => {
      const at = s.indexOf('CREATE TABLE IF NOT EXISTS `proxy_sms`');
      return s.slice(at, s.indexOf('ENGINE=', at));
    };
    const migration = read('deploy/migrations/2026-11-26-proxy-sms.sql');
    expect(block(migration)).toContain('ON DELETE CASCADE');
    expect(block(read('deploy/schema.sql'))).toBe(block(migration));
    expect(migration.replace(/^--.*$/gm, '')).not.toMatch(/\b(ALTER|DROP|UPDATE|TRUNCATE)\b/);
  });
});
