/**
 * 簡訊通道（backend only — imported by server.ts）。
 *
 * 驗證碼是手機號登入的**唯一**憑據，所以這一層只有一條紀律：
 * **送不出去的時候不可以回報送出去了。** 假裝成功的代價不是一則掉了的通知，
 * 而是一位家長對著輸入框等一則永遠不會到的簡訊，而日誌上一片祥和。
 *
 * 供應商是可抽換的一層。換掉阿里雲時動的是這個檔案裡的一個函式，
 * `server.ts` 只認得 `sendVerificationCode` 這個介面。
 *
 * ⚠️ 阿里雲那一層的簽名**尚未對真實端點驗證過**（測試環境沒有可用的
 * AccessKey，且簽名與範本都需要審核才發得出第一則）。規範化字串的規則由
 * `test/smsSender.test.ts` 逐條釘住 —— 那是這段程式碼最容易錯的地方，
 * 而阿里雲對簽名錯誤只會回一個 `SignatureDoesNotMatch`，看不出錯在哪一步。
 */

import crypto from 'crypto';
import axios from 'axios';

export type SmsProvider = 'aliyun' | 'console';

export type SmsResult =
  | { ok: true; provider: SmsProvider; detail: string }
  | { ok: false; provider: SmsProvider | 'unknown'; reason: 'not_configured' | 'send_failed'; detail: string };

/**
 * 哪一家供應商。未設定即阿里雲。
 *
 * 認不得的值**丟例外**而不是退回預設 —— 一個把 `SMS_PROVIDER=twillio`（少一個
 * l）悄悄當成阿里雲的系統，會在運維以為自己已經切換之後照舊從舊帳號扣費。
 * 呼叫端接住它並讓通道保持關閉（見 `sendVerificationCode`），因為送不出簡訊
 * 不該讓整台伺服器起不來：其他家長端功能與已登入的人都還在用。
 */
export function resolveSmsProvider(raw: string | undefined = process.env.SMS_PROVIDER): SmsProvider {
  if (raw === undefined || raw === '') return 'aliyun';
  if (raw === 'aliyun' || raw === 'console') return raw;
  throw new Error(
    `SMS_PROVIDER is not recognised: ${JSON.stringify(raw)}. Only 'aliyun' (default) or 'console' (local development) are accepted.`
  );
}

// ── 阿里雲 Dysmsapi ──

const ALIYUN_ENDPOINT = 'https://dysmsapi.aliyuncs.com/';
const ALIYUN_API_VERSION = '2017-05-25';
const ALIYUN_REGION = 'cn-hangzhou';

/**
 * RFC3986 的 percent-encode。
 *
 * `encodeURIComponent` 差三個字元：它把空白編成 `+`（在 query 裡才對，在簽名
 * 裡不對）、放過 `*`、又把 `~` 編掉。阿里雲的簽名對這三個字元的處置是規範的
 * 一部分，差一個就整串對不上。
 */
function percentEncode(raw: string): string {
  return encodeURIComponent(raw)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

export interface AliyunSmsRequestInput {
  phone: string;
  code: string;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  /** 可注入，讓測試釘得住規範化字串。正式呼叫由 `sendViaAliyun` 產生。 */
  nonce?: string;
  timestamp?: string;
}

/**
 * 組出一次 SendSms 的已簽名表單。
 *
 * 回傳的 `stringToSign` 只給測試與診斷用，**刻意不在 `form` 裡** ——
 * 表單裡多一個欄位就是簽名之外的參數，阿里雲會直接判定簽名不符。
 */
export function buildAliyunSmsRequest(input: AliyunSmsRequestInput): {
  url: string;
  form: URLSearchParams;
  stringToSign: string;
} {
  const params: Record<string, string> = {
    AccessKeyId: input.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: input.phone,
    RegionId: ALIYUN_REGION,
    SignName: input.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: input.nonce ?? crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: input.templateCode,
    TemplateParam: JSON.stringify({ code: input.code }),
    Timestamp: input.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: ALIYUN_API_VERSION,
  };

  const canonical = Object.keys(params)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  // 路徑固定是 `/`，所以中段永遠是 `%2F`。整串規範化查詢字串再編碼一次。
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac('sha1', `${input.accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');

  const form = new URLSearchParams({ ...params, Signature: signature });
  return { url: ALIYUN_ENDPOINT, form, stringToSign };
}

/** 缺哪幾項設定。回空陣列代表通道可用。 */
function missingAliyunConfig(): string[] {
  return [
    'ALI_SMS_ACCESS_KEY_ID',
    'ALI_SMS_ACCESS_KEY_SECRET',
    'ALI_SMS_SIGN_NAME',
    'ALI_SMS_TEMPLATE_CODE',
  ].filter(key => !process.env[key]);
}

async function sendViaAliyun(phone: string, code: string): Promise<SmsResult> {
  const missing = missingAliyunConfig();
  if (missing.length > 0) {
    return {
      ok: false,
      provider: 'aliyun',
      reason: 'not_configured',
      detail: `阿里云短信通道未开放，缺少：${missing.join(', ')}`,
    };
  }

  const { url, form } = buildAliyunSmsRequest({
    phone,
    code,
    accessKeyId: process.env.ALI_SMS_ACCESS_KEY_ID as string,
    accessKeySecret: process.env.ALI_SMS_ACCESS_KEY_SECRET as string,
    signName: process.env.ALI_SMS_SIGN_NAME as string,
    templateCode: process.env.ALI_SMS_TEMPLATE_CODE as string,
  });

  try {
    const resp = await axios.post(url, form.toString(), {
      timeout: 8000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    });
    // 阿里雲用 HTTP 200 配上 body 裡的 Code 回報業務錯誤，狀態碼本身不夠。
    const apiCode = resp.data?.Code;
    if (resp.status === 200 && apiCode === 'OK') {
      return { ok: true, provider: 'aliyun', detail: `sent (BizId ${resp.data?.BizId ?? '-'})` };
    }
    return {
      ok: false,
      provider: 'aliyun',
      reason: 'send_failed',
      detail: `HTTP ${resp.status} Code=${apiCode} ${String(resp.data?.Message ?? '').slice(0, 120)}`,
    };
  } catch (err: any) {
    return { ok: false, provider: 'aliyun', reason: 'send_failed', detail: err.message };
  }
}

/**
 * 本機開發用：把驗證碼印在終端機上。
 *
 * 只有 `SMS_PROVIDER=console` 明講了才會走到這裡 —— 它**不是**任何一種退路。
 * 一個「金鑰沒設就印在日誌上並回報成功」的預設值，會讓正式站在金鑰過期的那
 * 一天照樣回報登入簡訊已送出。
 */
async function sendViaConsole(phone: string, code: string): Promise<SmsResult> {
  console.warn(`[SMS/console] 验证码通道为本机模式，未送出真实短信。${phone} 的验证码：${code}`);
  return { ok: true, provider: 'console', detail: 'logged to console (SMS_PROVIDER=console)' };
}

/**
 * 送出一則登入驗證碼。**永不丟例外** —— 呼叫端一律看回傳值。
 *
 * 驗證碼不進 `console.log`（`console` 供應商是唯一的例外，而那需要明確設定）：
 * 應用程式日誌會被貼進工單、聊天室與截圖裡，一則能登入任何帳號的六位數字
 * 不該躺在那些地方。
 */
export async function sendVerificationCode(phone: string, code: string): Promise<SmsResult> {
  let provider: SmsProvider;
  try {
    provider = resolveSmsProvider();
  } catch (err: any) {
    console.error(`[SMS] ${err.message} 短信通道保持关闭，没有任何短信送出。`);
    return { ok: false, provider: 'unknown', reason: 'not_configured', detail: err.message };
  }

  const result = provider === 'console'
    ? await sendViaConsole(phone, code)
    : await sendViaAliyun(phone, code);

  if (!result.ok) {
    console.error(`[SMS] 验证码未送达 ${phone}（${result.provider}/${result.reason}）：${result.detail}`);
  }
  return result;
}
