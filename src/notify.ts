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
async function notifyWeCom(text: string): Promise<NotifyResult> {
  const url = process.env.WECOM_WEBHOOK_URL;
  if (!url) {
    return { channel: 'wecom', ok: false, detail: 'WECOM_WEBHOOK_URL not set' };
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
  const results = await Promise.all([notifyWeCom(text), notifySms(text)]);
  const delivered = results.filter(r => r.ok).map(r => r.channel);
  if (delivered.length === 0) {
    // Loud, because the parent has already been told an expert will be in touch.
    console.error(
      `[Notify] Expert booking ${n.bookingId ?? '(unsaved)'} reached NOBODY. ` +
      results.map(r => `${r.channel}: ${r.detail}`).join(' | ')
    );
  } else {
    console.log(`[Notify] Expert booking ${n.bookingId ?? '(unsaved)'} sent via ${delivered.join(', ')}`);
  }
  return results;
}
