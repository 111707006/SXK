import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { runProfitSharingOnce, settleLines, type DuePayment, type OpenRecord, type RecordPatch, type RunDeps } from '../src/profitSharing/run';
import { keyOf, type PlanLine, type Receiver, type SharingPlan } from '../src/profitSharing/plan';
import { WechatApiError, buildAddReceiverBody, buildShareBody, buildUnfreezeBody, encryptSensitive, type ProfitSharingApi, type ShareRequest, type SharingOrder } from '../src/profitSharing/wechatApi';
import type { SplitSnapshot } from '../src/revenueSplit/split';

/**
 * 微信分账的執行與送出的 body（ADR-0017）。微信 API 用假的（分账沒有沙箱）。
 *
 * 【這裡在防什麼】
 * 1. 同一筆訂單分兩次：送出前單號先落庫；微信沒回應時下一輪用同一個單號、同一份金額再送。
 * 2. 被微信拒絕的單默默消失：要變成 failed、留下原因。
 * 3. 接收方被關閉（錢退回商戶）卻記成已分：要改成線下結。
 * 4. 商戶全稱明文送出：一定加密，而且用對應的私鑰解得回來。
 */
const snapshot: SplitSnapshot = { v: 1, party: { kind: 'company', companyId: 7, companyName: '甲' }, feeBp: 60, platformBp: 2000, companyBp: null };
const receiver: Receiver = { partyKind: 'company', refId: 7, type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', relationType: 'PARTNER', active: true, registered: true };

interface Row {
  recordId: number; paymentId: number; transactionId: string; amountFen: number; snapshot: unknown;
  state: string; kind?: 'share' | 'unfreeze'; outOrderNo?: string; detail?: PlanLine[]; patch: RecordPatch[];
}

function harness(rows: Row[], api: Partial<ProfitSharingApi>, receivers: Receiver[] = [receiver]) {
  const calls: Array<{ fn: string; arg: any }> = [];
  const alerts: string[] = [];
  const fullApi: ProfitSharingApi = {
    addReceiver: async () => {},
    share: async req => { calls.push({ fn: 'share', arg: req }); return api.share!(req); },
    unfreeze: async (t, o, d) => { calls.push({ fn: 'unfreeze', arg: { t, o, d } }); return api.unfreeze!(t, o, d); },
    query: async (t, o) => { calls.push({ fn: 'query', arg: { t, o } }); return api.query!(t, o); },
  };
  const deps: RunDeps = {
    listDue: async () => rows.filter(r => r.state === 'awaiting') as unknown as DuePayment[],
    listOpen: async () => rows.filter(r => r.state === 'created' || r.state === 'processing') as unknown as OpenRecord[],
    loadReceivers: async () => new Map(receivers.map(r => [keyOf(r.partyKind, r.refId), r])),
    startRecord: async (id, input: { kind: 'share' | 'unfreeze'; attempt: number; outOrderNo: string; plan: SharingPlan }) => {
      const row = rows.find(r => r.recordId === id)!;
      if (row.state !== 'awaiting') return false;
      Object.assign(row, { state: 'created', kind: input.kind, outOrderNo: input.outOrderNo, detail: input.plan.lines });
      return true;
    },
    updateRecord: async (id, patch) => {
      const row = rows.find(r => r.recordId === id)!;
      row.patch.push(patch);
      row.state = patch.state;
      if (patch.detail) row.detail = patch.detail;
    },
    api: fullApi,
    maxBp: 3000,
    delayDays: 7,
    log: () => {},
    alert: text => alerts.push(text),
  };
  return { deps, calls, alerts };
}

const due = (over: Partial<Row> = {}): Row => ({ recordId: 1, paymentId: 12, transactionId: '4200001', amountFen: 1990, snapshot, state: 'awaiting', patch: [], ...over });
const ok = (state: string, receivers: SharingOrder['receivers'] = []): SharingOrder => ({ orderId: 'WX1', state, receivers });

describe('runProfitSharingOnce', () => {
  it('到期的訂單：算好、送出、微信處理中 → 下一輪查到完成', async () => {
    const rows = [due()];
    const { deps, calls } = harness(rows, {
      share: async () => ok('PROCESSING'),
      query: async () => ok('FINISHED', [{ type: 'MERCHANT_ID', account: '1900000109', amountFen: 597, result: 'SUCCESS', failReason: null }]),
    });
    const first = await runProfitSharingOnce(deps);
    expect(first).toMatchObject({ started: 1, requested: 1, finished: 0 });
    const sent = calls[0].arg as ShareRequest;
    expect(sent).toMatchObject({ transactionId: '4200001', outOrderNo: 'PS12A1' });
    expect(sent.receivers).toEqual([{ type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', amountFen: 597, description: '合作分润' }]);
    expect(rows[0].state).toBe('processing');

    const second = await runProfitSharingOnce(deps);
    expect(second).toMatchObject({ started: 0, requested: 0, finished: 1 });
    expect(rows[0].state).toBe('finished');
    expect(rows[0].patch.at(-1)).toMatchObject({ sharedFen: 597, error: null });
  });

  it('微信沒回應（逾時、5xx）：留在 created，下一輪用同一個單號、同一份金額再送', async () => {
    const rows = [due()];
    let n = 0;
    const { deps, calls } = harness(rows, {
      share: async () => {
        n += 1;
        if (n === 1) throw new Error('timeout of 10000ms exceeded');
        if (n === 2) throw new WechatApiError(500, 'SYSTEM_ERROR', '系统错误');
        return ok('FINISHED', [{ type: 'MERCHANT_ID', account: '1900000109', amountFen: 597, result: 'SUCCESS', failReason: null }]);
      },
    });
    expect(await runProfitSharingOnce(deps)).toMatchObject({ retryLater: 1, failed: 0 });
    expect(rows[0].state).toBe('created');
    expect(await runProfitSharingOnce(deps)).toMatchObject({ retryLater: 1, failed: 0 });
    expect(await runProfitSharingOnce(deps)).toMatchObject({ finished: 1 });
    expect(calls.map(c => c.arg.outOrderNo)).toEqual(['PS12A1', 'PS12A1', 'PS12A1']);
    expect(new Set(calls.map(c => JSON.stringify(c.arg.receivers))).size).toBe(1);
  });

  it('微信拒絕（業務錯誤）：failed、留下原因、通知人；之後不再自動送', async () => {
    const rows = [due()];
    const { deps, calls, alerts } = harness(rows, { share: async () => { throw new WechatApiError(400, 'INVALID_REQUEST', '超过分账限制的最大比例'); } });
    expect(await runProfitSharingOnce(deps)).toMatchObject({ failed: 1 });
    expect(rows[0].state).toBe('failed');
    expect(rows[0].patch.at(-1)!.error).toContain('超过分账限制的最大比例');
    expect(alerts).toHaveLength(1);
    await runProfitSharingOnce(deps);
    expect(calls).toHaveLength(1);
  });

  it('接收方被關閉：那一份改成線下結，全部關閉＝failed', async () => {
    const rows = [due()];
    const { deps, alerts } = harness(rows, {
      share: async () => ok('FINISHED', [{ type: 'MERCHANT_ID', account: '1900000109', amountFen: 597, result: 'CLOSED', failReason: 'ACCOUNT_ABNORMAL' }]),
    });
    expect(await runProfitSharingOnce(deps)).toMatchObject({ failed: 1 });
    const last = rows[0].patch.at(-1)!;
    expect(last).toMatchObject({ state: 'failed', sharedFen: 0, wxOrderId: 'WX1' });
    expect(last.offlineFen).toBe(rows[0].detail!.reduce((n, l) => n + l.dueFen, 0));
    expect(last.error).toContain('ACCOUNT_ABNORMAL');
    expect(alerts).toHaveLength(1);
  });

  it('到期時對方已經沒有可用的接收方：只解凍，不送分账', async () => {
    const rows = [due()];
    const { deps, calls } = harness(rows, { unfreeze: async () => ok('FINISHED') }, [{ ...receiver, active: false }]);
    expect(await runProfitSharingOnce(deps)).toMatchObject({ started: 1, finished: 1 });
    expect(calls.map(c => c.fn)).toEqual(['unfreeze']);
    expect(rows[0].state).toBe('finished');
  });

  it('沒有清分快照的訂單：failed，不送', async () => {
    const rows = [due({ snapshot: null })];
    const { deps, calls } = harness(rows, {});
    expect(await runProfitSharingOnce(deps)).toMatchObject({ failed: 1, started: 0 });
    expect(calls).toHaveLength(0);
  });

  it('別人先一步開始了（startRecord 回 false）：不重複算', async () => {
    const rows = [due()];
    const { deps } = harness(rows, {});
    deps.startRecord = async () => false;
    deps.listOpen = async () => [];
    expect(await runProfitSharingOnce(deps)).toMatchObject({ started: 0, requested: 0 });
  });
});

describe('settleLines', () => {
  const lines: PlanLine[] = [
    { partyKind: 'company', refId: 7, dueFen: 300, shareFen: 300, offlineReason: null, receiver: { type: 'MERCHANT_ID', account: 'A', name: '甲' } },
    { partyKind: 'referrer', refId: 3, dueFen: 200, shareFen: 200, offlineReason: null, receiver: { type: 'PERSONAL_OPENID', account: 'B', name: null } },
  ];
  it('一方成功一方關閉：成功的照算，關閉的改線下結', () => {
    const s = settleLines(lines, ok('FINISHED', [
      { type: 'MERCHANT_ID', account: 'A', amountFen: 300, result: 'SUCCESS', failReason: null },
      { type: 'PERSONAL_OPENID', account: 'B', amountFen: 200, result: 'CLOSED', failReason: 'RECEIVER_RECEIPT_LIMIT' },
      { type: 'MERCHANT_ID', account: 'SELF', amountFen: 1490, result: 'SUCCESS', failReason: null },
    ]));
    expect(s).toMatchObject({ sharedFen: 300, offlineFen: 200 });
    expect(s.closed).toEqual(['referrer:3 RECEIVER_RECEIPT_LIMIT']);
  });
  it('回應裡找不到的接收方當成沒分到', () => {
    expect(settleLines(lines, ok('FINISHED', []))).toMatchObject({ sharedFen: 0, offlineFen: 500 });
  });
});

describe('送給微信的 body', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const key = { serial: 'SERIAL1', publicKey };
  const decrypt = (b64: string) =>
    crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(b64, 'base64')).toString('utf8');

  it('敏感欄位加密解得回來，每次密文不同', () => {
    const a = encryptSensitive('森跃诺动健康科技（上海）有限公司', publicKey);
    expect(decrypt(a)).toBe('森跃诺动健康科技（上海）有限公司');
    expect(encryptSensitive('森跃诺动健康科技（上海）有限公司', publicKey)).not.toBe(a);
  });

  it('請求分账：欄位照官方文件，商戶全稱加密，一律解凍剩下的', () => {
    const body = JSON.parse(buildShareBody('wxapp', {
      transactionId: '4200001', outOrderNo: 'PS12A1',
      receivers: [
        { type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', amountFen: 597, description: '合作分润' },
        { type: 'PERSONAL_OPENID', account: 'oUpF8uMuAJO', name: null, amountFen: 100, description: '合作分润' },
      ],
    }, key));
    expect(Object.keys(body)).toEqual(['appid', 'transaction_id', 'out_order_no', 'receivers', 'unfreeze_unsplit']);
    expect(body).toMatchObject({ appid: 'wxapp', transaction_id: '4200001', out_order_no: 'PS12A1', unfreeze_unsplit: true });
    expect(decrypt(body.receivers[0].name)).toBe('甲公司');
    expect(body.receivers[0]).toMatchObject({ type: 'MERCHANT_ID', account: '1900000109', amount: 597, description: '合作分润' });
    expect(body.receivers[1]).toEqual({ type: 'PERSONAL_OPENID', account: 'oUpF8uMuAJO', amount: 100, description: '合作分润' });
  });

  it('有名稱卻拿不到加密用的公鑰：丟錯，不送明文', () => {
    expect(() => buildShareBody('wxapp', { transactionId: 't', outOrderNo: 'o', receivers: [{ type: 'MERCHANT_ID', account: '1', name: '甲', amountFen: 1, description: 'd' }] }, null)).toThrow();
    expect(() => buildAddReceiverBody('wxapp', { type: 'MERCHANT_ID', account: '1', name: '甲', relationType: 'PARTNER' }, null)).toThrow();
  });

  it('添加接收方與解凍', () => {
    const add = JSON.parse(buildAddReceiverBody('wxapp', { type: 'MERCHANT_ID', account: '1900000109', name: '甲公司', relationType: 'PARTNER' }, key));
    expect(add).toMatchObject({ appid: 'wxapp', type: 'MERCHANT_ID', account: '1900000109', relation_type: 'PARTNER' });
    expect(decrypt(add.name)).toBe('甲公司');
    expect(JSON.parse(buildAddReceiverBody('wxapp', { type: 'PERSONAL_OPENID', account: 'o1', name: null, relationType: 'PARTNER' }, null)))
      .toEqual({ appid: 'wxapp', type: 'PERSONAL_OPENID', account: 'o1', relation_type: 'PARTNER' });
    expect(JSON.parse(buildUnfreezeBody('4200001', 'PS12A2', '无需分账，解冻'))).toEqual({ transaction_id: '4200001', out_order_no: 'PS12A2', description: '无需分账，解冻' });
  });
});
