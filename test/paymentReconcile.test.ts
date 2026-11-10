import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readReconcileMinutes, reconcilePendingOnce, type RemoteOrder } from '../src/payments/reconcile';

const remote = (tradeState: string): RemoteOrder => ({ tradeState, transactionId: 'tx', amountFen: 100, appid: 'a', mchid: 'm' });

describe('對帳補結：一輪', () => {
  it('只結付了的；沒付、關單的不動；問不到的記一筆、不影響下一張', async () => {
    const settled: string[] = [];
    const logs: string[] = [];
    const states: Record<string, RemoteOrder | Error> = {
      A: remote('SUCCESS'),
      B: remote('NOTPAY'),
      C: new Error('ORDER_NOT_EXIST'),
      D: remote('CLOSED'),
      E: remote('SUCCESS'),
    };
    const r = await reconcilePendingOnce({
      listPending: async () => ['A', 'B', 'C', 'D', 'E'].map(outTradeNo => ({ outTradeNo })),
      query: async no => {
        const s = states[no];
        if (s instanceof Error) throw s;
        return s;
      },
      settle: async no => { settled.push(no); return 'granted'; },
      log: l => logs.push(l),
    });
    expect(settled).toEqual(['A', 'E']);
    expect(r).toEqual({ checked: 5, settled: 2, failed: 1 });
    expect(logs.some(l => l.includes('C') && l.includes('ORDER_NOT_EXIST'))).toBe(true);
  });

  it('已經結過的（回調先到了）、金額對不上的：不算成補結', async () => {
    const r = await reconcilePendingOnce({
      listPending: async () => [{ outTradeNo: 'A' }, { outTradeNo: 'B' }],
      query: async () => remote('SUCCESS'),
      settle: async no => (no === 'A' ? 'already' : 'mismatch'),
      log: () => {},
    });
    expect(r.settled).toBe(0);
  });

  it('問的範圍：開單 5 分鐘以上、48 小時以內，一次最多 50 張', async () => {
    let args: number[] = [];
    await reconcilePendingOnce({
      listPending: async (a, b, c) => { args = [a, b, c]; return []; },
      query: async () => remote('SUCCESS'),
      settle: async () => 'granted',
      log: () => {},
    });
    expect(args).toEqual([5, 48, 50]);
  });
});

describe('PAY_RECONCILE_MINUTES', () => {
  it('不設、0 是關；5–1440 收；其他起不來', () => {
    expect(readReconcileMinutes(undefined)).toBe(0);
    expect(readReconcileMinutes('0')).toBe(0);
    expect(readReconcileMinutes('10')).toBe(10);
    expect(() => readReconcileMinutes('1')).toThrow(/PAY_RECONCILE_MINUTES/);
    expect(() => readReconcileMinutes('ten')).toThrow(/PAY_RECONCILE_MINUTES/);
    expect(() => readReconcileMinutes('2000')).toThrow(/PAY_RECONCILE_MINUTES/);
  });

  it('補結走同一個 settlePayment（核對金額、擋重複），只在 startServer 裡啟動', () => {
    const src = readFileSync('server.ts', 'utf8').replace(/\r\n/g, '\n');
    expect(src).toContain('settle: (no, remote) => settlePayment(no, remote.transactionId, { appid: remote.appid, mchid: remote.mchid, totalFen: remote.amountFen }),');
    const start = src.indexOf('export async function startServer()');
    expect(src.indexOf('startPaymentReconcile();', start)).toBeGreaterThan(start);
    expect(src.match(/startPaymentReconcile\(\);/g)?.length).toBe(1);
  });
});
