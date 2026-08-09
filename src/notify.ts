/**
 * Staff notifications for expert bookings (backend only — imported by server.ts).
 *
 * Two channels on purpose. A booking that nobody sees is worse than no booking
 * feature at all: the parent is told an expert will call, and then waits.
 * So we fan out, and a failure on one channel never fails the request.
 *
 * Neither channel is required for a booking to be saved. The row lands in
 * `expert_bookings` first; notifications are best-effort on top of it.
 */

import axios from 'axios';

export interface BookingNotification {
  bookingId: number | null;
  specialistName: string;
  parentName: string;
  parentPhone: string;
  childAgeMonth: number | null;
  childGender: string | null;
  preferredSlot: string | null;
  /** Which dimensions were flagged — the specialist's prep material. */
  reportSummary: string | null;
  /** 這位家長所屬的合作公司；未歸屬為 `null`。只用於日誌與訊息抬頭。 */
  companyName?: string | null;
  /**
   * 該公司自己的企業微信通知位置。`null` 代表未設定，退回全域
   * `WECOM_WEBHOOK_URL` —— 退路存在，但每一次動用都會在日誌留下一行。
   */
  companyWebhookUrl?: string | null;
}

export interface NotifyResult {
  channel: 'wecom' | 'sms';
  ok: boolean;
  detail: string;
}

/** Human-readable digest shared by both channels. */
function formatBooking(n: BookingNotification): string {
  const lines = [
    '【森心康】新的专家咨询预约',
    // 全域退路可能同時收到多家公司的預約，所以抬頭要說得出這是誰的。
    ...(n.companyName ? [`合作公司：${n.companyName}`] : []),
    `预约编号：${n.bookingId ?? '（未入库，记忆体模式）'}`,
    `家长：${n.parentName}　${n.parentPhone}`,
    `指定专家：${n.specialistName}`,
    `希望时段：${n.preferredSlot || '未指定'}`,
  ];
  if (n.childAgeMonth !== null) {
    const gender = n.childGender === 'boy' ? '男' : n.childGender === 'girl' ? '女' : '未填';
    lines.push(`孩子：${n.childAgeMonth} 个月　${gender}`);
  }
  if (n.reportSummary) lines.push(`筛查摘要：${n.reportSummary}`);
  return lines.join('\n');
}

/**
 * WeCom (企业微信) group robot. A webhook URL is the entire setup — no app
 * registration, no approval, no cost — which is why it is the primary channel.
 *
 * Payload shape is WeCom's group-robot text message contract.
 * NOTE: not yet exercised against a live webhook; if the format is wrong the
 * fix is confined to this function.
 */
async function notifyWeCom(text: string, companyWebhookUrl: string | null): Promise<NotifyResult> {
  // 該公司自己的位置優先。退回全域設定時**大聲說出來** —— 一個安靜的退路會讓
  // 「A 公司的預約全部送到森心康的群」看起來與正常運作一模一樣。
  const globalUrl = process.env.WECOM_WEBHOOK_URL || '';
  const url = companyWebhookUrl || globalUrl;
  // 條件與上一行取值時的判斷**必須一致**（都用真值）。寫成 `=== null` 的話，
  // 一個空字串的 webhook 仍會退回全域，卻不會印出這一行 —— 而「A 公司的預約
  // 全部送到森心康的群，且日誌看起來一切正常」正是這段程式碼要防的事。
  if (!companyWebhookUrl && globalUrl) {
    console.warn(
      '[Notify/WeCom] 该合作公司未设定自己的企业微信通知位置，本则通知退回全域 WECOM_WEBHOOK_URL。'
    );
  }
  if (!url) {
    return { channel: 'wecom', ok: false, detail: 'no company webhook and WECOM_WEBHOOK_URL not set' };
  }
  try {
    const resp = await axios.post(
      url,
      { msgtype: 'text', text: { content: text } },
      { timeout: 8000, validateStatus: () => true }
    );
    // WeCom answers 200 with an errcode in the body, so the status alone is not enough.
    const errcode = resp.data?.errcode;
    if (resp.status === 200 && (errcode === 0 || errcode === undefined)) {
      return { channel: 'wecom', ok: true, detail: 'sent' };
    }
    return {
      channel: 'wecom',
      ok: false,
      detail: `HTTP ${resp.status} errcode=${errcode} ${JSON.stringify(resp.data).slice(0, 200)}`,
    };
  } catch (err: any) {
    return { channel: 'wecom', ok: false, detail: err.message };
  }
}

/**
 * Aliyun SMS — deliberately NOT implemented yet.
 *
 * NOTE: 登入驗證碼那條路已經有可用的阿里雲傳輸層了（`src/sms.ts`，#25）。
 * 這裡沒有直接接過去，是因為兩者送的是不同東西：驗證碼走的是一個只帶
 * `${code}` 的已審核範本，而這裡要送的是一整段自由文字的預約摘要 ——
 * 那需要另一個範本（或改用其他通道）。要補的是那個範本，不是簽名程式碼。
 *
 * Aliyun's Dysmsapi needs a signature over a canonicalised query string plus a
 * pre-approved sign name and template (1–2 business days of review). Writing
 * that signing code without credentials to test against would ship unverifiable
 * crypto that looks finished, which is worse than an obvious gap.
 *
 * Behaviour is therefore explicit rather than silent:
 *   - no credentials  → log the message (dev/demo)
 *   - credentials set → refuse loudly, so nobody believes SMS is going out
 */
async function notifySms(text: string): Promise<NotifyResult> {
  const hasCreds = !!(process.env.ALI_SMS_ACCESS_KEY_ID && process.env.ALI_SMS_ACCESS_KEY_SECRET);
  if (!hasCreds) {
    console.log('[Notify/SMS] (no credentials — logging instead of sending)\n' + text);
    return { channel: 'sms', ok: false, detail: 'no credentials, logged to console' };
  }
  console.error(
    '[Notify/SMS] ALI_SMS_* credentials are set but the Aliyun transport is not implemented yet. ' +
    'No SMS was sent. Implement it in src/notify.ts before relying on this channel.'
  );
  return { channel: 'sms', ok: false, detail: 'aliyun transport not implemented' };
}

/**
 * Fans out to every channel and resolves with one result each.
 * Never rejects — callers treat notification as advisory.
 */
export async function notifyExpertBooking(n: BookingNotification): Promise<NotifyResult[]> {
  const text = formatBooking(n);
  const results = await Promise.all([
    notifyWeCom(text, n.companyWebhookUrl ?? null),
    notifySms(text),
  ]);
  const delivered = results.filter(r => r.ok).map(r => r.channel);
  if (delivered.length === 0) {
    // Loud, because the parent has already been told an expert will be in touch.
    // 公司名一併印出來：沒有它，運維只知道「有一則通知掉了」，不知道該打給誰。
    console.error(
      `[Notify] Expert booking ${n.bookingId ?? '(unsaved)'} ` +
      `(公司: ${n.companyName ?? '未归属'}) reached NOBODY. ` +
      results.map(r => `${r.channel}: ${r.detail}`).join(' | ')
    );
  } else {
    console.log(`[Notify] Expert booking ${n.bookingId ?? '(unsaved)'} sent via ${delivered.join(', ')}`);
  }
  return results;
}
