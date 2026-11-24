import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 專案 B 沒有停用／刪除單位、刪帳號與推薦人那幾支（使用者 2026-11-23：「B 一行不動」）：全部 404，資料層一句都沒叫到；
 * 停用的公司（資料庫裡就有 active = 0 的）它的成員照舊登得進來。
 */
process.env.APP_MODE = 't1only';
process.env.SESSION_SECRET ||= 'test-session-secret-for-unit-deletion-b';

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const calls: string[] = [];
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-god-123', 4) },
    { id: 10, email: 'm@jia.com', role: 'company_member', companyId: 7, active: true, createdAt: null, passwordHash: bcrypt.hashSync('pw-jia-123', 4), companyActive: false },
  ];
  const spy = (name: string) => async () => { calls.push(name); return null; };
  return {
    __calls: calls,
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) { return admins.find(a => a.email === email) ?? null; },
    async findAdminUserById(id: number) { return admins.find(a => a.id === id) ?? null; },
    async listCompanies() { return []; },
    setCompanyActive: spy('setCompanyActive'),
    companyDeletePreview: spy('companyDeletePreview'),
    deleteCompany: spy('deleteCompany'),
    deleteAdminUser: spy('deleteAdminUser'),
    deleteReferrer: spy('deleteReferrer'),
  };
});

let client: TestClient;
beforeAll(async () => { client = await startTestApp(await loadApp()); });
afterAll(async () => { await client.close(); });

describe('專案 B', () => {
  it('那幾支都是 404、資料層一句都沒叫到；停用公司的成員照舊登得進來', async () => {
    const login = await client.postJson('/api/admin/login', { email: 'god@sxk.com', password: 'pw-god-123' });
    const h = { Authorization: `Bearer ${(await login.json()).token}` };
    const del = (path: string) => client.request(`/api/admin${path}`, { method: 'DELETE', headers: h });
    expect((await client.postJson('/api/admin/companies/7/active', { active: false }, h)).status).toBe(404);
    expect((await client.get('/api/admin/companies/7/delete-preview', h)).status).toBe(404);
    expect((await del('/companies/7')).status).toBe(404);
    expect((await del('/admin-users/10')).status).toBe(404);
    expect((await del('/referrers/1')).status).toBe(404);
    const store = (await import('../src/admin/adminStore')) as any;
    expect(store.__calls).toEqual([]);
    expect((await client.postJson('/api/admin/login', { email: 'm@jia.com', password: 'pw-jia-123' })).status).toBe(200);
  });
});
