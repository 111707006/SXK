import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { startTestApp, type TestClient } from './helpers/httpApp';
import { signAdminToken } from '../src/admin/adminAuth';
import { hashHandoffCode, isHandoffCodeShape } from '../src/handoff/core';
import { inviteBatches, inviteStatus, INVITE_BATCH_MAX } from '../src/handoff/invite';

/**
 * 後台的 B→A 邀請簡訊（ADR-0009；使用者 2026-09-28：「後台也做，一次發送簡訊邀請做 T2」）。
 *
 * 要釘住的：
 * 1. 只有全域管理員、只有專案 B、交接開著才發得了；範本沒設好一則都不發。
 * 2. 只發給**當下視野**裡的家長（store 收到的是工作階段的條件），視野外與不存在回同一個原因。
 * 3. 誰能收照 `inviteStatus` 再判一次：沒手機、沒做篩查、已經到過 A、7 天內收過的跳過。
 * 4. 每位收件人一組新的交接碼（只存雜湊、kind=sms、記同意版本），簡訊裡帶的就是那組碼；
 *    送出與失敗都記一筆，失敗的原因回給後台。
 */

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();

interface Target { id: number; phone: string | null; hasScreening: boolean; lastInvitedAt: string | null; handoffUsedAt: string | null }
const IN_SCOPE: Target[] = [
  { id: 1, phone: '13800000001', hasScreening: true, lastInvitedAt: null, handoffUsedAt: null },
  { id: 2, phone: null, hasScreening: true, lastInvitedAt: null, handoffUsedAt: null },
  { id: 3, phone: '13800000003', hasScreening: false, lastInvitedAt: null, handoffUsedAt: null },
  { id: 4, phone: '13800000004', hasScreening: true, lastInvitedAt: null, handoffUsedAt: daysAgo(1) },
  { id: 5, phone: '13800000005', hasScreening: true, lastInvitedAt: daysAgo(6), handoffUsedAt: null },
  { id: 6, phone: '13800000006', hasScreening: true, lastInvitedAt: daysAgo(8), handoffUsedAt: null },
  { id: 7, phone: '13800000007', hasScreening: true, lastInvitedAt: null, handoffUsedAt: null },
];
/** 別家公司的家長：id 對，但不在視野裡。 */
const OTHER_COMPANY_ID = 99;

const calls = {
  targets: [] as Array<{ condition: unknown; ids: number[] }>,
  codes: [] as Array<{ condition: unknown; userId: number; codeHash: string; consentVersion: string | null }>,
  invites: [] as Array<{ condition: unknown; userId: number; codeId: number | null; adminUserId: number; status: string; detail: string | null }>,
};

vi.mock('../src/admin/adminStore', () => ({
  isAvailable: () => true,
  findAdminUserById: async (id: number) =>
    id === 30
      ? { id: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, active: true }
      : id === 10
        ? { id: 10, email: 'a@jia.com', role: 'company_member', companyId: 1, active: true }
        : null,
  listInviteTargets: async (condition: unknown, ids: number[]) => {
    calls.targets.push({ condition, ids });
    return IN_SCOPE.filter(t => ids.includes(t.id));
  },
  createInviteCode: async (condition: unknown, input: any) => {
    calls.codes.push({ condition, ...input });
    return 500 + calls.codes.length;
  },
  recordInvite: async (condition: unknown, input: any) => {
    calls.invites.push({ condition, ...input });
  },
}));

const { createAdminRouter } = await import('../src/admin/routes');

/** 簡訊通道替身：記下每一則，7 號故意送失敗。 */
const sms: Array<{ phone: string; code: string }> = [];
let channelReady = true;
const handoffInvite = {
  consentVersion: 'invite-v1',
  channel: () => (channelReady ? { ready: true, missing: [] } : { ready: false, missing: ['ALI_SMS_INVITE_TEMPLATE_CODE'] }),
  send: async (phone: string, code: string) => {
    sms.push({ phone, code });
    return phone.endsWith('07') ? { ok: false, detail: 'Code=isv.BUSINESS_LIMIT_CONTROL' } : { ok: true, detail: 'sent' };
  },
};

function appWith(multiCompany: boolean, withInvite = true) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ multiCompany }, withInvite ? { handoffInvite } : {}));
  return app;
}

const globalOn = (companyId: number | null) =>
  signAdminToken({ aid: 30, email: 'god@sxk.com', role: 'global_admin', companyId: null, sel: companyId === null ? null : { kind: 'company', companyId } });
const member = () => signAdminToken({ aid: 10, email: 'a@jia.com', role: 'company_member', companyId: 1, sel: null });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let b: TestClient;
let bOff: TestClient;
let a: TestClient;

beforeAll(async () => {
  b = await startTestApp(appWith(true));
  bOff = await startTestApp(appWith(true, false));
  a = await startTestApp(appWith(false));
});

afterAll(async () => {
  await Promise.all([b.close(), bOff.close(), a.close()]);
});

beforeEach(() => {
  calls.targets.length = 0;
  calls.codes.length = 0;
  calls.invites.length = 0;
  sms.length = 0;
  channelReady = true;
});

const send = (client: TestClient, token: string, userIds: unknown) =>
  client.postJson('/api/admin/handoff-invites', { userIds }, auth(token));

describe('誰按得了', () => {
  it('合作公司帳號：403（看不到這個功能）', async () => {
    expect((await send(b, member(), [1])).status).toBe(403);
    expect((await b.get('/api/admin/handoff-invites/config', auth(member()))).status).toBe(403);
    expect(sms).toHaveLength(0);
  });

  it('全域管理員還沒選視野：409，一則都不發', async () => {
    const res = await send(b, globalOn(null), [1]);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('NO_COMPANY_SELECTED');
    expect(sms).toHaveLength(0);
  });

  it('專案 A：路徑不存在', async () => {
    expect((await send(a, globalOn(null), [1])).status).toBe(404);
    expect((await a.get('/api/admin/handoff-invites/config', auth(globalOn(null)))).status).toBe(404);
  });

  it('交接沒開：config 說 enabled:false、發送 404', async () => {
    expect(await (await bOff.get('/api/admin/handoff-invites/config', auth(globalOn(1)))).json()).toEqual({ enabled: false });
    const res = await send(bOff, globalOn(1), [1]);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('HANDOFF_DISABLED');
  });

  it('範本還沒設好：config 列出缺什麼、發送 503，碼一組都不建', async () => {
    channelReady = false;
    expect(await (await b.get('/api/admin/handoff-invites/config', auth(globalOn(1)))).json()).toEqual({
      enabled: true, ready: false, missing: ['ALI_SMS_INVITE_TEMPLATE_CODE'],
    });
    const res = await send(b, globalOn(1), [1]);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('INVITE_CHANNEL_NOT_READY');
    expect(calls.codes).toHaveLength(0);
    expect(sms).toHaveLength(0);
  });

  it.each([
    ['空的', []],
    ['不是陣列', 1],
    ['有非整數', [1, 'x']],
    ['有負數', [-1]],
    [`超過 ${INVITE_BATCH_MAX} 位`, Array.from({ length: INVITE_BATCH_MAX + 1 }, (_, i) => i + 1)],
  ])('userIds %s：400', async (_label, userIds) => {
    expect((await send(b, globalOn(1), userIds)).status).toBe(400);
  });
});

describe('發給誰、發了什麼', () => {
  it('只發給能收的；每位一組新碼、簡訊帶的就是那組碼；跳過的說原因；失敗的記下來', async () => {
    const res = await send(b, globalOn(1), [1, 2, 3, 4, 5, 6, 7, OTHER_COMPANY_ID, 1]);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.sent).toEqual([1, 6]);
    expect(report.skipped).toEqual([
      { userId: 2, reason: 'no_phone' },
      { userId: 3, reason: 'no_screening' },
      { userId: 4, reason: 'already_in_a' },
      { userId: 5, reason: 'recently_invited' },
      { userId: OTHER_COMPANY_ID, reason: 'not_found' },
    ]);
    expect(report.failed).toEqual([{ userId: 7, detail: 'Code=isv.BUSINESS_LIMIT_CONTROL' }]);

    // 簡訊：三則（1、6、7），各帶一組 32 字的碼，存下來的是那組碼的雜湊
    expect(sms.map(m => m.phone)).toEqual(['13800000001', '13800000006', '13800000007']);
    expect(sms.every(m => isHandoffCodeShape(m.code))).toBe(true);
    expect(new Set(sms.map(m => m.code)).size).toBe(3);
    expect(calls.codes.map(c => [c.userId, c.codeHash, c.consentVersion])).toEqual(
      sms.map((m, i) => [[1, 6, 7][i], hashHandoffCode(m.code), 'invite-v1']),
    );

    // 送出與失敗都記一筆，記的是按的人
    expect(calls.invites.map(i => [i.userId, i.status, i.adminUserId, i.detail])).toEqual([
      [1, 'sent', 30, null],
      [6, 'sent', 30, null],
      [7, 'failed', 30, 'Code=isv.BUSINESS_LIMIT_CONTROL'],
    ]);
  });

  it('查詢與寫入拿到的都是工作階段的視野（選定的那家公司）', async () => {
    await send(b, globalOn(1), [1]);
    const scope = { kind: 'company', companyId: 1 };
    expect(calls.targets[0].condition).toEqual(scope);
    expect(calls.codes[0].condition).toEqual(scope);
    expect(calls.invites[0].condition).toEqual(scope);
    expect(calls.targets[0].ids).toEqual([1]);
  });
});

describe('規則（src/handoff/invite.ts）', () => {
  const now = new Date(NOW);
  const base = { phone: '13800000001', hasScreening: true, lastInvitedAt: null, handoffUsedAt: null };

  it('7 天整條線：6 天內跳過、8 天可以', () => {
    expect(inviteStatus({ ...base, lastInvitedAt: daysAgo(6.9) }, now)).toBe('recently_invited');
    expect(inviteStatus({ ...base, lastInvitedAt: daysAgo(7) }, now)).toBe('eligible');
  });

  it('手機號要是 11 碼、1 開頭', () => {
    expect(inviteStatus({ ...base, phone: '12345' }, now)).toBe('no_phone');
  });

  it('切批：每批最多 INVITE_BATCH_MAX 位', () => {
    const ids = Array.from({ length: INVITE_BATCH_MAX * 2 + 1 }, (_, i) => i);
    expect(inviteBatches(ids).map(b => b.length)).toEqual([INVITE_BATCH_MAX, INVITE_BATCH_MAX, 1]);
  });
});

describe('server.ts 怎麼接', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf8');

  it('只有交接開著（B 的 HANDOFF_SOURCE_CONFIG）才給後台邀請功能；簡訊帶的連結指向 A 的 #invite=', () => {
    expect(server).toMatch(/handoffInvite: HANDOFF_SOURCE_CONFIG\s*\?/);
    expect(server).toContain('sendHandoffInvite(phone, code, handoffInviteUrl(HANDOFF_SOURCE_CONFIG.targetOrigin, code))');
    // HANDOFF_SOURCE_CONFIG 只在 B 算：A 上它是 null，邀請功能就不存在
    expect(server).toContain("const HANDOFF_SOURCE_CONFIG = APP_MODE === 't1only' ? resolveHandoffSourceConfig(process.env) : null;");
  });
});
