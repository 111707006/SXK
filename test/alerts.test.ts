import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Alerter, readAlertWebhook, safePath } from '../src/alerts';

describe('ALERT_WEBHOOK_URL', () => {
  it('不設＝不送；只收企業微信群機器人的網址', () => {
    expect(readAlertWebhook(undefined)).toBeNull();
    expect(readAlertWebhook('')).toBeNull();
    expect(readAlertWebhook('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc')).toBe('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc');
    expect(() => readAlertWebhook('https://evil.example/hook')).toThrow(/ALERT_WEBHOOK_URL/);
    expect(() => readAlertWebhook('http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc')).toThrow(/ALERT_WEBHOOK_URL/);
  });
});

describe('節流', () => {
  const make = () => {
    let t = 0;
    const sent: string[] = [];
    const a = new Alerter(async text => { sent.push(text); }, 'A sxkscreen.com', () => t);
    return { a, sent, advance: (ms: number) => { t += ms; } };
  };

  it('同一種事 10 分鐘只送一次；不同的 key 各自算', async () => {
    const { a, sent, advance } = make();
    expect(await a.alert('payment', 'x', 'k1')).toBe(true);
    expect(await a.alert('payment', 'x', 'k1')).toBe(false);
    expect(await a.alert('payment', 'y', 'k2')).toBe(true);
    advance(10 * 60_000);
    expect(await a.alert('payment', 'x', 'k1')).toBe(true);
    expect(sent).toHaveLength(3);
    expect(sent[0].startsWith('【A sxkscreen.com】payment')).toBe(true);
  });

  it('一小時最多 20 則', async () => {
    const { a, sent } = make();
    for (let i = 0; i < 30; i++) await a.alert('other', 'm', `k${i}`);
    expect(sent).toHaveLength(20);
  });

  it('5 分鐘內第 5 次 5xx 才送，路徑不帶查詢字串與掃碼 token', async () => {
    const { a, sent } = make();
    for (let i = 0; i < 4; i++) a.recordServerError('GET', '/api/x?phone=138', 500);
    await new Promise(r => setTimeout(r, 0));
    expect(sent).toHaveLength(0);
    a.recordServerError('GET', '/r/SECRETtoken123?x=1', 502);
    await new Promise(r => setTimeout(r, 0));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('502 GET /r/…');
    expect(sent[0]).not.toContain('SECRET');
    expect(sent[0]).not.toContain('138');
  });

  it('送不出去不丟例外；沒設就是不送', async () => {
    const broken = new Alerter(async () => { throw new Error('net'); }, 'A');
    await expect(broken.alert('crash', 'x')).resolves.toBe(false);
    const off = new Alerter(null, 'A');
    expect(off.enabled).toBe(false);
    await expect(off.alert('crash', 'x')).resolves.toBe(false);
  });

  it('safePath', () => {
    expect(safePath('/api/r/abc/def?x')).toBe('/api/r/…/def');
    expect(safePath('/api/t2/plan?a=1')).toBe('/api/t2/plan');
  });
});

describe('接在哪裡', () => {
  const src = readFileSync('server.ts', 'utf8').replace(/\r\n/g, '\n');

  it('程序要掛的那兩種只在 startServer 裡裝，送完照舊結束（pm2 重開）', () => {
    const start = src.indexOf('export async function startServer()');
    expect(src.indexOf("process.on('uncaughtException'", start)).toBeGreaterThan(start);
    expect(src.indexOf("process.on('uncaughtException'")).toBeGreaterThan(start);
    expect(src).toContain('const done = () => process.exit(1);');
  });

  it('付款對不上、結算失敗都會送', () => {
    expect(src).toContain("void alerter.alert('payment', `订单 ${outTradeNo} 微信说已付款，但与订单对不上");
    expect(src).toContain("void alerter.alert('payment', `订单 ${outTradeNo} 回调结算失败");
  });
});
