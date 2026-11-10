import axios from 'axios';

/**
 * 出事時通知人（2026-11-10 稽核，`ALERT_WEBHOOK_URL`）：企業微信群機器人。沒設＝不送（照舊只寫日誌）。
 *
 * 送什麼：
 * - 程序要掛了（未攔截的例外、未處理的 Promise 拒絕）—— 送完照舊結束，pm2 會重開。
 * - 付款結算有事（金額對不上、結算失敗）—— 這兩種就是「收了錢沒給東西」或「給錯東西」。
 * - 短時間內一堆 5xx（5 分鐘內 5 次以上）。
 *
 * 不送：家長的手機號、孩子的資料、請求內容。路徑去掉查詢字串、掃碼 token。
 * 同一種事 10 分鐘只送一次、一小時最多 20 則：一個壞掉的迴圈不會把群洗版，也不會用光機器人的額度（每分鐘 20 則）。
 */
export type AlertKind = 'crash' | 'payment' | 'http5xx' | 'other';

export interface AlertSender {
  (text: string): Promise<void>;
}

export function readAlertWebhook(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (!v.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
    throw new Error('ALERT_WEBHOOK_URL must be a WeCom group robot URL (https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…)');
  }
  return v;
}

export function wecomSender(url: string): AlertSender {
  return async text => {
    await axios.post(url, { msgtype: 'text', text: { content: text } }, { timeout: 5000, validateStatus: () => true });
  };
}

export const ALERT_PER_KIND_MS = 10 * 60_000;
export const ALERT_MAX_PER_HOUR = 20;

export class Alerter {
  private lastByKind = new Map<string, number>();
  private sentTimes: number[] = [];
  private errorTimes: number[] = [];

  constructor(
    private readonly send: AlertSender | null,
    private readonly label: string,
    private readonly now: () => number = Date.now,
  ) {}

  get enabled(): boolean {
    return this.send !== null;
  }

  /** 送一則（節流過）。永遠不丟例外：通知失敗不能讓原本的事更糟。 */
  async alert(kind: AlertKind, message: string, key: string = kind): Promise<boolean> {
    if (!this.send) return false;
    const t = this.now();
    const last = this.lastByKind.get(key);
    if (last !== undefined && t - last < ALERT_PER_KIND_MS) return false;
    this.sentTimes = this.sentTimes.filter(x => t - x < 3_600_000);
    if (this.sentTimes.length >= ALERT_MAX_PER_HOUR) return false;
    this.lastByKind.set(key, t);
    this.sentTimes.push(t);
    try {
      await this.send(`【${this.label}】${kind}\n${message.slice(0, 800)}`);
      return true;
    } catch {
      return false;
    }
  }

  /** 一次 5xx 回應。5 分鐘內第 5 次起送一則（之後照節流）。 */
  recordServerError(method: string, path: string, status: number): void {
    const t = this.now();
    this.errorTimes = this.errorTimes.filter(x => t - x < 5 * 60_000);
    this.errorTimes.push(t);
    if (this.errorTimes.length >= 5) {
      void this.alert('http5xx', `5 分钟内 ${this.errorTimes.length} 次 5xx，最近一次：${status} ${method} ${safePath(path)}`);
    }
  }
}

/** 日誌與通知裡的路徑：去掉查詢字串、掃碼 token。 */
export function safePath(path: string): string {
  return path.split(/[?#]/)[0].replace(/^\/(api\/)?r\/[^/]+/, m => m.replace(/[^/]+$/, '…')).slice(0, 120);
}
