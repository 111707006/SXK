import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { startTestApp, type TestClient } from './helpers/httpApp';

/**
 * 代填之後的登入簡訊（使用者 2026-11-24，`PROXY_SMS`）：第一次代填自動寄、再代填不寄、簡訊失敗不影響代填、
 * 只能重發給自己代填過的家長；沒傳 hook（開關關著）回應一字不變、重發那一支不存在。
 */
process.env.SESSION_SECRET ||= 'test-session-secret-for-proxy-sms';

vi.mock('../src/admin/adminStore', async () => ({
  isAvailable: () => true,
  async findAdminUserById(id: number) {
    return [
      { id: 2, email: 'mgr@a.com', role: 'company_member', companyId: 7, active: true, createdAt: null },
      { id: 3, email: 'zhang@a.com', role: 'referrer', companyId: null, active: true, createdAt: null, referrerId: 70, referrerActive: true },
    ].find(a => a.id === id) ?? null;
  },
  async findCompanyById(id: number) {
    return id === 7 ? { id: 7, name: '甲机构', kind: 'institution', active: true } : null;
  },
  async findReferrer(id: number) {
    return id === 70 ? { id: 70, companyId: 7, active: true, adminUserId: 3 } : null;
  },
  async proxyLookupServed(_party: any, phone: string) {
    return phone === '13800000002' ? { status: 'other' } : { status: 'mine', child: null };
  },
  // 尾數 9＝再代填（不扣碼）。
  async proxyFillServed(_party: any, _admin: number, input: any) {
    return { ok: true, userId: 41, consumedCodeId: input.phone.endsWith('9') ? null : 5, endsOn: null };
  },
  async proxySmsTarget(_party: any, phone: string) {
    return phone === '13800000002' ? null : 41;
  },
}));

const { createAdminRouter } = await import('../src/admin/routes');
const { signAdminToken } = await import('../src/admin/adminAuth');
const { DIMENSION_CODES } = await import('../src/t2/types');

const state = { ready: true, reserved: 11 as number | null, ok: true, throws: false };
const reserve = vi.fn(async (_u: number, _a: number) => {
  if (state.throws) throw new Error('db down');
  return state.reserved;
});
const send = vi.fn(async (_p: string, _c: string) => ({ ok: state.ok, detail: 'x' }));
const finish = vi.fn(async (_id: number, _ok: boolean, _d: string) => {});

function appWith(on: boolean) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter(
    { multiCompany: true, projectA: true, serviceRelations: true },
    { redeemCodes: true, ...(on ? { proxySms: { ready: () => state.ready, reserve, send, finish } } : {}) },
  ));
  return app;
}
const tok = (aid: number, email: string, role: 'company_member' | 'referrer', companyId: number | null) => ({
  Authorization: `Bearer ${signAdminToken({ aid, email, role, companyId, sel: null })}`,
});
const mgr = tok(2, 'mgr@a.com', 'company_member', 7);
const zhang = tok(3, 'zhang@a.com', 'referrer', null);
const fill = (phone = '13800000001') => ({
  phone,
  child: { name: '小安', birthDate: '2023-01-01', gender: 'girl' },
  months: 1,
  colors: Object.fromEntries(DIMENSION_CODES.map(d => [d, 'green'])),
  tags: [],
});

let on: TestClient;
let off: TestClient;
beforeAll(async () => {
  on = await startTestApp(appWith(true));
  off = await startTestApp(appWith(false));
});
afterAll(async () => {
  await on.close();
  await off.close();
});
beforeEach(() => {
  Object.assign(state, { ready: true, reserved: 11, ok: true, throws: false });
  [reserve, send, finish].forEach(f => f.mockClear());
});

const FILL = '/api/admin/referrer/proxy';
const RESEND = '/api/admin/referrer/proxy/sms';

describe('開著', () => {
  it('第一次代填：自動寄到家長手機，短碼是代填的推薦人', async () => {
    expect(await (await on.postJson(FILL, fill(), zhang)).json()).toEqual({ ok: true, consumedCode: true, sms: { status: 'sent', entryPath: '/g/t70' } });
    expect(reserve).toHaveBeenCalledWith(41, 3);
    expect(send).toHaveBeenCalledWith('13800000001', 't70');
    expect(finish).toHaveBeenCalledWith(11, true, 'x');
  });

  it('單位管理者：短碼是單位', async () => {
    expect((await (await on.postJson(FILL, fill(), mgr)).json()).sms.entryPath).toBe('/g/u7');
    expect(send).toHaveBeenCalledWith('13800000001', 'u7');
  });

  it('再代填（沒扣碼）：不自動寄', async () => {
    expect((await (await on.postJson(FILL, fill('13800000009'), zhang)).json()).sms.status).toBe('not_sent');
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['範本沒設：不佔紀錄、不送', { ready: false }, 'not_ready', 0],
    ['冷卻中：不送', { reserved: null }, 'cooldown', 0],
    ['通道失敗：記失敗', { ok: false }, 'failed', 1],
    ['佔紀錄時資料庫壞了', { throws: true }, 'failed', 0],
  ])('%s，代填照樣成功', async (_n, patch, status, sends) => {
    Object.assign(state, patch);
    const res = await on.postJson(FILL, fill(), zhang);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sms: { status } });
    expect(send).toHaveBeenCalledTimes(sends);
    if (status === 'failed' && sends) expect(finish).toHaveBeenCalledWith(11, false, 'x');
  });

  it('重發：自己代填過的可以，別人的 404 不送，手機號不對 400', async () => {
    expect(await (await on.postJson(RESEND, { phone: '13800000001' }, zhang)).json()).toEqual({ sms: { status: 'sent', entryPath: '/g/t70' } });
    send.mockClear();
    expect((await on.postJson(RESEND, { phone: '13800000002' }, zhang)).status).toBe(404);
    expect((await on.postJson(RESEND, { phone: '123' }, zhang)).status).toBe(400);
    expect((await on.postJson(RESEND, { phone: '13800000001' })).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('查找到自己代填過的家長：帶出可以補發的狀態', async () => {
    expect((await (await on.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, zhang)).json()).sms).toEqual({ status: 'not_sent', entryPath: '/g/t70' });
  });
});

describe('關著', () => {
  it('回應不帶 sms、重發 404', async () => {
    expect(await (await off.postJson(FILL, fill(), zhang)).json()).toEqual({ ok: true, consumedCode: true });
    expect(await (await off.postJson('/api/admin/referrer/proxy/lookup', { phone: '13800000001' }, zhang)).json()).toEqual({ status: 'mine', child: null });
    expect((await off.postJson(RESEND, { phone: '13800000001' }, zhang)).status).toBe(404);
  });
});
