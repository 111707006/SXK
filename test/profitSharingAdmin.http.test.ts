import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { registerProfitSharingRoutes, type AdminSharingRecord, type ProfitSharingAdminDeps } from '../src/profitSharing/adminRoutes';
import { buildOrderBody } from '../src/wechatPay';
import type { SplitSnapshot } from '../src/revenueSplit/split';

/**
 * 微信分账的後台端點（ADR-0017）與開單時的分账標記。
 *
 * 【這裡在防什麼】
 * 1. 不是全域管理員也按得到「执行分账」（那是真的把錢轉出去）。
 * 2. 微信那邊沒加成功的接收方被當成可以分。
 * 3. 微信已經受理過的分账單被重試（資金已解凍，再送只會被拒；或更糟，分兩次）。
 * 4. 沒帶分账標記的訂單，下單 body 多出 settle_info（款項會被冻结）。
 */
const snapshot: SplitSnapshot = { v: 1, party: { kind: 'company', companyId: 7, companyName: '甲' }, feeBp: 60, platformBp: 2000, companyBp: null };

let role: 'global_admin' | 'company_member' = 'global_admin';
let ready = true;
let wechatFails = false;
const log: string[] = [];
let record: AdminSharingRecord;

const deps: ProfitSharingAdminDeps = {
  config: { maxBp: 3000, delayDays: 7, autoMinutes: 0 },
  get ready() { return ready; },
  listReceivers: async () => [],
  loadReceiverMap: async () => new Map([['company:7', { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', relationType: 'PARTNER', active: true, registered: true }]]),
  saveReceiver: async i => void log.push(`save ${i.partyKind}:${i.refId} ${i.account}`),
  addReceiverAtWechat: async r => {
    if (wechatFails) throw new Error('分账接收商户全称不匹配');
    log.push(`wechat ${r.account}`);
  },
  markReceiverRegistered: async (k, id) => void log.push(`registered ${k}:${id}`),
  setReceiverActive: async (_k, id) => id === 7,
  partyExists: async (_k, id) => id === 7,
  listRecords: async () => [record],
  findRecord: async id => (id === record.id ? record : null),
  restartRecord: async (id, input) => {
    log.push(`restart ${id} ${input.kind} ${input.outOrderNo} shared=${input.plan.sharedFen} offline=${input.plan.offlineFen}`);
    return true;
  },
  findOpenidByPhone: async phone => (phone === '13800000001' ? 'oUpF8uMuAJO_M2pxb1Q9zNjWeS6o' : null),
  run: async () => {
    log.push('run');
    return { started: 1, requested: 1, finished: 0, failed: 0, retryLater: 0 };
  },
};

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerProfitSharingRoutes(router, (_req, res) => {
    if (role !== 'global_admin') {
      res.status(403).json({ code: 'FORBIDDEN' });
      return false;
    }
    return true;
  }, deps);
  app.use('/api/admin', router);
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin`;
});
afterAll(() => void server.close());

beforeEach(() => {
  role = 'global_admin';
  ready = true;
  wechatFails = false;
  log.length = 0;
  record = {
    id: 5, paymentId: 12, outTradeNo: 'SXK1', amountFen: 1990, paymentStatus: 'success', paidAt: '2026-11-01T00:00:00.000Z',
    state: 'awaiting', kind: null, attempt: 0, outOrderNo: null, wxOrderId: null, detail: [], sharedFen: 0, offlineFen: 0, error: null,
    snapshot, transactionId: '4200001', updatedAt: null,
  };
});

const call = async (method: string, path: string, body?: unknown) => {
  const resp = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: resp.status, body: await resp.json().catch(() => ({})) as any };
};

describe('只有全域管理員', () => {
  it.each([
    ['GET', '/profit-sharing', undefined],
    ['PUT', '/profit-sharing/receivers', { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司' }],
    ['POST', '/profit-sharing/receivers/active', { partyKind: 'company', refId: 7, active: false }],
    ['GET', '/profit-sharing/openid?phone=13800000001', undefined],
    ['POST', '/profit-sharing/run', {}],
    ['POST', '/profit-sharing/orders/5/retry', { mode: 'share' }],
  ] as const)('%s %s：公司成員 403，什麼都沒做', async (method, path, body) => {
    role = 'company_member';
    expect((await call(method, path, body)).status).toBe(403);
    expect(log).toEqual([]);
  });
});

describe('GET /profit-sharing', () => {
  it('還沒送的訂單附上現在送會怎麼分（上限 30%）；不帶清分快照出去', async () => {
    const r = await call('GET', '/profit-sharing');
    expect(r.status).toBe(200);
    expect(r.body.config).toEqual({ maxBp: 3000, delayDays: 7, autoMinutes: 0 });
    const rec = r.body.records[0];
    expect(rec).toMatchObject({ state: 'awaiting', sharedFen: 597 });
    expect(rec.detail[0]).toMatchObject({ partyKind: 'company', refId: 7, shareFen: 597, offlineReason: 'over_cap' });
    expect(rec).not.toHaveProperty('snapshot');
  });
});

describe('PUT /profit-sharing/receivers', () => {
  const input = { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司' };
  it('存檔 → 向微信添加 → 標成可分', async () => {
    expect((await call('PUT', '/profit-sharing/receivers', input)).body).toEqual({ ok: true, registered: true });
    expect(log).toEqual(['save company:7 1900000109', 'wechat 1900000109', 'registered company:7']);
  });
  it('微信沒加成功：照存，但不標成可分，原因回給畫面', async () => {
    wechatFails = true;
    const r = await call('PUT', '/profit-sharing/receivers', input);
    expect(r.body).toMatchObject({ ok: true, registered: false });
    expect(r.body.wechatError).toContain('全称不匹配');
    expect(log).toEqual(['save company:7 1900000109']);
  });
  it('微信支付沒設好：照存、不打微信', async () => {
    ready = false;
    expect((await call('PUT', '/profit-sharing/receivers', input)).body).toMatchObject({ registered: false });
    expect(log).toEqual(['save company:7 1900000109']);
  });
  it('輸入不對 400、對象不存在 404，都不存', async () => {
    expect((await call('PUT', '/profit-sharing/receivers', { ...input, account: 'abc' })).status).toBe(400);
    expect((await call('PUT', '/profit-sharing/receivers', { ...input, refId: 8 })).status).toBe(404);
    expect(log).toEqual([]);
  });
});

describe('其他', () => {
  it('查 openid：手機號形狀不對 400；查不到回 null', async () => {
    expect((await call('GET', '/profit-sharing/openid?phone=123')).status).toBe(400);
    expect((await call('GET', '/profit-sharing/openid?phone=13800000001')).body.openid).toBe('oUpF8uMuAJO_M2pxb1Q9zNjWeS6o');
    expect((await call('GET', '/profit-sharing/openid?phone=13800000002')).body.openid).toBeNull();
  });
  it('執行：微信支付沒設好 503、不跑', async () => {
    ready = false;
    expect((await call('POST', '/profit-sharing/run', {})).status).toBe(503);
    expect(log).toEqual([]);
  });
  it('執行：回這一輪的數字', async () => {
    expect((await call('POST', '/profit-sharing/run', {})).body).toMatchObject({ started: 1, requested: 1 });
    expect(log).toEqual(['run']);
  });
  it('停用：找不到 404', async () => {
    expect((await call('POST', '/profit-sharing/receivers/active', { partyKind: 'company', refId: 7, active: false })).status).toBe(200);
    expect((await call('POST', '/profit-sharing/receivers/active', { partyKind: 'company', refId: 8, active: false })).status).toBe(404);
  });
});

describe('POST /profit-sharing/orders/:id/retry', () => {
  it('失敗、微信沒受理過：換下一個單號重新排入', async () => {
    record = { ...record, state: 'failed', attempt: 1, outOrderNo: 'PS12A1', error: 'x' };
    expect((await call('POST', '/profit-sharing/orders/5/retry', { mode: 'share' })).body).toEqual({ ok: true, kind: 'share' });
    expect(log[0]).toMatch(/^restart 5 share PS12A2 shared=597 /);
  });
  it('只解凍：一分都不分，該給對方的全部線下結', async () => {
    record = { ...record, state: 'failed', attempt: 1 };
    expect((await call('POST', '/profit-sharing/orders/5/retry', { mode: 'unfreeze' })).body).toEqual({ ok: true, kind: 'unfreeze' });
    expect(log[0]).toMatch(/^restart 5 unfreeze PS12A2 shared=0 offline=1582$/);
  });
  it.each([
    ['微信受理過的', { state: 'failed', wxOrderId: 'WX1' }],
    ['還沒失敗的', { state: 'processing' }],
    ['已完成的', { state: 'finished' }],
  ] as const)('%s不能重試（409）', async (_name, over) => {
    record = { ...record, ...over } as AdminSharingRecord;
    expect((await call('POST', '/profit-sharing/orders/5/retry', { mode: 'share' })).status).toBe(409);
    expect(log).toEqual([]);
  });
  it('參數不對 400、找不到 404', async () => {
    expect((await call('POST', '/profit-sharing/orders/5/retry', { mode: 'again' })).status).toBe(400);
    expect((await call('POST', '/profit-sharing/orders/6/retry', { mode: 'share' })).status).toBe(404);
  });
});

describe('下單 body 的分账標記', () => {
  const config = { appid: 'wxapp', mchid: '1675548366', notifyUrl: 'https://example.com/n' };
  const order = { description: 'd', outTradeNo: 'SXK1', amountFen: 1990, payerClientIp: '1.2.3.4', openid: 'o1' };
  it.each(['h5', 'jsapi'] as const)('%s：帶了才有 settle_info.profit_sharing，沒帶整個欄位不出現', type => {
    expect(JSON.parse(buildOrderBody(config, type, { ...order, profitSharing: true })).settle_info).toEqual({ profit_sharing: true });
    expect(JSON.parse(buildOrderBody(config, type, order))).not.toHaveProperty('settle_info');
    expect(JSON.parse(buildOrderBody(config, type, { ...order, profitSharing: false }))).not.toHaveProperty('settle_info');
  });
});
