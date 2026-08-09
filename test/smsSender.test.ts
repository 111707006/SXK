import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { sendVerificationCode, buildAliyunSmsRequest, resolveSmsProvider } from '../src/sms';

/**
 * 簡訊通道（#25）。
 *
 * 這裡釘住的核心是一句否定：**送不出去的時候不可以回報送出去了。**
 * 驗證碼是登入的唯一憑據 —— 一個假裝成功的通道會讓家長在輸入框前面等一則
 * 永遠不會到的簡訊，而伺服器日誌上一片祥和。
 *
 * 供應商是可抽換的一層：預設阿里雲，`SMS_PROVIDER` 換掉的只有這一層。
 */

const posts: Array<{ url: string; body: any }> = [];
let axiosData: any = { Code: 'OK', Message: 'OK', BizId: 'b1' };
let axiosThrows: Error | null = null;

vi.mock('axios', () => ({
  default: {
    post: async (url: string, body: any) => {
      posts.push({ url, body });
      if (axiosThrows) throw axiosThrows;
      return { status: 200, data: axiosData };
    },
  },
}));

const ALI_ENV = [
  'ALI_SMS_ACCESS_KEY_ID',
  'ALI_SMS_ACCESS_KEY_SECRET',
  'ALI_SMS_SIGN_NAME',
  'ALI_SMS_TEMPLATE_CODE',
] as const;

function configureAliyun() {
  process.env.ALI_SMS_ACCESS_KEY_ID = 'testid';
  process.env.ALI_SMS_ACCESS_KEY_SECRET = 'testsecret';
  process.env.ALI_SMS_SIGN_NAME = '森心康';
  process.env.ALI_SMS_TEMPLATE_CODE = 'SMS_123456';
}

beforeEach(() => {
  posts.length = 0;
  axiosData = { Code: 'OK', Message: 'OK', BizId: 'b1' };
  axiosThrows = null;
  process.env.SMS_PROVIDER = '';
  for (const key of ALI_ENV) process.env[key] = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('供應商是可抽換的一層', () => {
  it('未指定時預設阿里雲', () => {
    expect(resolveSmsProvider(undefined)).toBe('aliyun');
    expect(resolveSmsProvider('')).toBe('aliyun');
  });

  it('認不得的供應商名稱不得悄悄退回阿里雲', () => {
    expect(() => resolveSmsProvider('twilio')).toThrow(/SMS_PROVIDER/);
  });

  it('打錯供應商名稱時通道關閉，而不是照樣用阿里雲送出', async () => {
    configureAliyun();
    process.env.SMS_PROVIDER = 'twilio';
    const result = await sendVerificationCode('13800138000', '123456');

    expect(result.ok).toBe(false);
    expect(posts).toEqual([]);
  });
});

describe('金鑰未設定時通道未開放', () => {
  it('缺金鑰就明確回報未開放，且一次網路請求都不發', async () => {
    const result = await sendVerificationCode('13800138000', '123456');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('not_configured');
    expect(posts).toEqual([]);
  });

  it('缺的是哪幾項要說得出來 —— 否則運維只知道「沒開」', async () => {
    process.env.ALI_SMS_ACCESS_KEY_ID = 'testid';
    const result = await sendVerificationCode('13800138000', '123456');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ALI_SMS_SIGN_NAME');
    expect(result.detail).not.toContain('ALI_SMS_ACCESS_KEY_ID');
  });
});

describe('阿里雲 Dysmsapi 的請求', () => {
  it('金鑰齊了就真的送出，並帶著驗證碼', async () => {
    configureAliyun();
    const result = await sendVerificationCode('13800138000', '123456');

    expect(result.ok).toBe(true);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain('dysmsapi.aliyuncs.com');
    const form = new URLSearchParams(posts[0].body);
    expect(form.get('PhoneNumbers')).toBe('13800138000');
    expect(form.get('TemplateParam')).toBe('{"code":"123456"}');
    expect(form.get('Signature')).toBeTruthy();
  });

  it('阿里雲回 200 但 Code 不是 OK，仍然是失敗', async () => {
    configureAliyun();
    axiosData = { Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: '触发限流' };
    const result = await sendVerificationCode('13800138000', '123456');

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('isv.BUSINESS_LIMIT_CONTROL');
  });

  it('連線丟例外時回失敗，不往外拋', async () => {
    configureAliyun();
    axiosThrows = new Error('ECONNRESET');
    const result = await sendVerificationCode('13800138000', '123456');

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ECONNRESET');
  });

  it('驗證碼不進日誌 —— 日誌是會被轉貼的', async () => {
    configureAliyun();
    const log = console.log as unknown as ReturnType<typeof vi.fn>;
    await sendVerificationCode('13800138000', '123456');
    const said = (log.mock.calls as unknown[][]).flat().join(' ');
    expect(said).not.toContain('123456');
  });
});

/**
 * 簽名的規範化字串。
 *
 * 期望值**不是**照著實作再算一次，而是照阿里雲的規則手寫出來的 —— 參數依鍵
 * 排序、每個鍵與值各自 percent-encode（`+`→`%20`、`*`→`%2A`、`%7E`→`~`），
 * 再把整串規範化查詢字串**再編碼一次**接在 `POST&%2F&` 後面。
 * 規範化錯了，阿里雲只會回一個 SignatureDoesNotMatch，看不出錯在哪一步。
 */
describe('簽名的規範化字串', () => {
  const FIXED = {
    accessKeyId: 'testid',
    accessKeySecret: 'testsecret',
    templateCode: 'SMS_1',
    phone: '13800138000',
    code: '123456',
    nonce: '3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf',
    timestamp: '2026-08-10T00:00:00Z',
  };

  it('percent-encode 依 RFC3986，而不是 encodeURIComponent 的預設行為', () => {
    const { stringToSign } = buildAliyunSmsRequest({ ...FIXED, signName: 'a b*c~d' });
    // 規範化字串裡的 SignName：空白是 %20、星號是 %2A、波浪號原樣保留，
    // 而整串又被再編碼一次，所以 `%` 在這裡呈現為 `%25`。
    expect(stringToSign).toContain('SignName%3Da%2520b%252Ac~d');
  });

  it('參數依鍵排序，且整串再編碼一次接在 POST&%2F& 後面', () => {
    const { stringToSign, form } = buildAliyunSmsRequest({ ...FIXED, signName: 'SXK' });

    // 手寫的規範化查詢字串 —— 來源是阿里雲的規則，不是實作。
    const canonical = [
      'AccessKeyId=testid',
      'Action=SendSms',
      'Format=JSON',
      'PhoneNumbers=13800138000',
      'RegionId=cn-hangzhou',
      'SignName=SXK',
      'SignatureMethod=HMAC-SHA1',
      `SignatureNonce=${FIXED.nonce}`,
      'SignatureVersion=1.0',
      'TemplateCode=SMS_1',
      'TemplateParam=%7B%22code%22%3A%22123456%22%7D',
      'Timestamp=2026-08-10T00%3A00%3A00Z',
      'Version=2017-05-25',
    ].join('&');
    const expected =
      'POST&%2F&' +
      encodeURIComponent(canonical).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');

    expect(stringToSign).toBe(expected);

    // 簽名是 base64(HMAC-SHA1(secret + '&', stringToSign))。
    expect(form.get('Signature')).toBe(
      crypto.createHmac('sha1', 'testsecret&').update(expected).digest('base64')
    );
  });

  it('送出的表單不含 stringToSign 這類診斷欄位', () => {
    const { form } = buildAliyunSmsRequest({ ...FIXED, signName: 'SXK' });
    for (const key of form.keys()) {
      expect(key.startsWith('__')).toBe(false);
    }
  });
});
