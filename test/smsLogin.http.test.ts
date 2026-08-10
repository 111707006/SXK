import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 手機號驗證碼登入（#25）—— #27 之後家長端**唯一**的入口。
 *
 * 純驗證碼登入沒有獨立的「註冊」動作 —— **第一次驗證成功即建立帳號**，
 * 歸屬在那一刻寫入，此後不變。
 *
 * 這支測試釘住的是三件會安靜壞掉的事：
 *
 * 1. **同一支手機號在兩家合作公司是兩位家長**（ADR-0002）。全域唯一會讓家長在
 *    B 公司做的篩查覆蓋掉 A 公司的檔案，而 A 公司在後台看得到 —— 公司隔離的
 *    `WHERE` 條件擋不住這個，因為那是身分模型本身的洞。
 * 2. **資料庫寫不進去就是失敗。** 已下線的電子郵件註冊那條路會吞掉例外、退回
 *    記憶體、仍回報成功並發 token；家長看到登入成功，帳號卻沒進資料庫，重啟就
 *    消失。這條路不沿用那個作法 —— 而它現在是唯一的一條。
 * 3. **簡訊沒送出去就不可以說送出去了。** 金鑰未設定時通道未開放，
 *    而不是一個安靜的成功。
 */

const VALID_SLUG = 'jia';
const COMPANY_ID = 7;
const OTHER_SLUG = 'yi';
const OTHER_COMPANY_ID = 8;
const PHONE = '13800138000';

/** 未歸屬併為單一值 —— 與資料庫的 `company_key` 生成欄位是同一個約定。 */
const companyKey = (companyId: number | null) => companyId ?? 0;

interface SmsCodeRow {
  id: number;
  phone: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  consumed_at: Date | null;
  request_ip: string | null;
  created_at: Date;
  /**
   * 「資料庫算出來的已經過了幾秒」。真實的那一支查詢用 `TIMESTAMPDIFF` 算好
   * 帶回來，所以替身預設也從 `created_at` 推算 —— 冷卻期那一組測試則直接指定
   * 它並且**不給** `created_at`，藉此證明伺服器不會偷偷回去減兩個時鐘。
   */
  age_sec?: number;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

let smsCodes: SmsCodeRow[] = [];
let users: Array<{ id: number; phone: string; email: string | null; company_id: number | null }> = [];
let nextUserId = 1;
let nextCodeId = 1;
/** 下一次資料層寫入要不要炸掉。用來驗「寫不進去就明確失敗」。 */
let dbWriteFails = false;
/** 歸屬查詢炸掉時，這次登入該落在哪一個範圍就成了一個沒有答案的問題。 */
let companyLookupFails = false;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users.find(u => u.id === id) ?? null,
  findUserByPhone: async (companyId: number | null, phone: string) =>
    users.find(u => u.phone === phone && companyKey(u.company_id) === companyKey(companyId)) ?? null,
  createPhoneUser: async (phone: string, companyId: number | null) => {
    if (dbWriteFails) throw new Error('ER_NO_SUCH_TABLE: users.phone 不存在');
    const row = { id: nextUserId++, phone, email: null, company_id: companyId };
    users.push(row);
    return row.id;
  },
  createSmsCode: async (input: any) => {
    if (dbWriteFails) throw new Error("ER_NO_SUCH_TABLE: Table 'sms_codes' doesn't exist");
    const row: SmsCodeRow = {
      id: nextCodeId++,
      phone: input.phone,
      code_hash: input.codeHash,
      expires_at: input.expiresAt,
      attempts: 0,
      consumed_at: null,
      request_ip: input.requestIp,
      created_at: new Date(),
    };
    smsCodes.push(row);
    return row.id;
  },
  deleteSmsCode: async (id: number) => {
    smsCodes = smsCodes.filter(c => c.id !== id);
  },
  // `age_sec` 由資料庫算好送回來 —— 替身也照做，否則測試驗的是一個真實環境
  // 裡不存在的介面。伺服器**不會**再去碰 `created_at`（見 findLatestSmsCode
  // 的說明：那一欄歸資料庫的時鐘管）。
  findLatestSmsCode: async (phone: string) => {
    const row = [...smsCodes].reverse().find(c => c.phone === phone);
    if (!row) return null;
    return {
      ...row,
      age_sec: row.age_sec ?? Math.floor((Date.now() - row.created_at.getTime()) / 1000),
    };
  },
  countRecentSmsCodesByPhone: async (phone: string, withinHours: number) =>
    smsCodes.filter(c => c.phone === phone && c.created_at >= hoursAgo(withinHours)).length,
  countRecentSmsCodesByIp: async (ip: string, withinHours: number) =>
    smsCodes.filter(c => c.request_ip === ip && c.created_at >= hoursAgo(withinHours)).length,
  incrementSmsCodeAttempts: async (id: number) => {
    const row = smsCodes.find(c => c.id === id);
    if (row) row.attempts += 1;
  },
  consumeSmsCode: async (id: number) => {
    const row = smsCodes.find(c => c.id === id);
    if (!row || row.consumed_at) return false;
    row.consumed_at = new Date();
    return true;
  },
  findCompanyBySlug: async (slug: string) => {
    if (companyLookupFails) throw new Error('ETIMEDOUT');
    return slug === VALID_SLUG
      ? { id: COMPANY_ID, name: '甲机构', slug, wecomWebhookUrl: null, active: true }
      : slug === OTHER_SLUG
        ? { id: OTHER_COMPANY_ID, name: '乙机构', slug, wecomWebhookUrl: null, active: true }
        : null;
  },
  findCompanyByUserId: async () => null,
  listActiveSpecialists: async () => [],
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  listUnlockedDimensions: async () => [],
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
  parseUserDataRow: () => null,
}));

/** 送出去的簡訊。內容看得到，所以「有沒有真的送」與「送了什麼」都驗得了。 */
const sent: Array<{ phone: string; code: string }> = [];
let smsChannelOpen = true;

vi.mock('../src/sms', () => ({
  sendVerificationCode: async (phone: string, code: string) => {
    if (!smsChannelOpen) {
      return { ok: false, provider: 'aliyun', reason: 'not_configured', detail: '缺少：ALI_SMS_SIGN_NAME' };
    }
    sent.push({ phone, code });
    return { ok: true, provider: 'aliyun', detail: 'sent' };
  },
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  smsCodes = [];
  users = [];
  sent.length = 0;
  nextUserId = 1;
  nextCodeId = 1;
  dbWriteFails = false;
  companyLookupFails = false;
  smsChannelOpen = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

/** 索取一次驗證碼，回傳那則簡訊裡的六位數字。 */
async function requestCode(phone = PHONE, companySlug?: string): Promise<string> {
  const resp = await client.postJson('/api/auth/sms/request', { phone, companySlug });
  expect(resp.status).toBe(200);
  return sent[sent.length - 1].code;
}

/** 讓上一次索取看起來是很久以前的事，跳過冷卻等待。 */
function ageLatestCode(phone = PHONE, ms = 10 * 60 * 1000) {
  const row = [...smsCodes].reverse().find(c => c.phone === phone)!;
  row.created_at = new Date(Date.now() - ms);
}

describe('索取驗證碼', () => {
  it('手機號格式不對就不送，也不寫任何一筆', async () => {
    for (const phone of ['12345', '23800138000', '', '1380013800a', null]) {
      const resp = await client.postJson('/api/auth/sms/request', { phone });
      expect(resp.status).toBe(400);
    }
    expect(sent).toEqual([]);
    expect(smsCodes).toEqual([]);
  });

  it('索取成功後，資料庫裡存的是雜湊而不是驗證碼本身', async () => {
    const code = await requestCode();
    expect(smsCodes).toHaveLength(1);
    expect(smsCodes[0].code_hash).not.toBe(code);
    expect(smsCodes[0].code_hash).not.toContain(code);
  });

  it('驗證碼有到期時間，而且是未來', async () => {
    await requestCode();
    expect(smsCodes[0].expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('回應裡不得帶著驗證碼 —— 那等於誰打這支 API 誰就能登入', async () => {
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
    const body = await resp.text();
    expect(body).not.toContain(sent[0].code);
  });

  it('記下來源 IP，讓防刷有東西可查', async () => {
    await requestCode();
    expect(smsCodes[0].request_ip).toBeTruthy();
  });

  it('重複索取之間要等 —— 冷卻期內不再送，也不再寫', async () => {
    await requestCode();
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });

    expect(resp.status).toBe(429);
    expect(sent).toHaveLength(1);
    expect(smsCodes).toHaveLength(1);
  });

  it('冷卻期過了就能再索取一次', async () => {
    await requestCode();
    ageLatestCode();
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });

    expect(resp.status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  // ── 冷卻期認的是資料庫算出來的秒數，不是兩個時鐘相減 ──
  //
  // 這一條釘住的是介面本身：`created_at` 由資料庫寫，Node 那一邊沒有釘住連線
  // 時區，兩者相減的前提（兩個時區剛好一樣）沒有人保證過。RDS 在 +08:00 而
  // 容器在 UTC 是預設值撞出來的常見組合，而差的那八小時往一邊是冷卻期整個
  // 失效，往另一邊是**所有家長都登不進來**（永遠 429，等待時間以小時計）。
  describe('冷卻期只認資料庫算出來的秒數', () => {
    /** 只回 age_sec、完全不給 created_at 的一筆 —— 伺服器不該需要它。 */
    function latestWithAge(ageSec: number) {
      return { id: 999, phone: PHONE, code_hash: 'x', expires_at: new Date(Date.now() + 60_000), attempts: 0, consumed_at: null, request_ip: '127.0.0.1', age_sec: ageSec };
    }

    it('資料庫說才過了 10 秒就擋，回的等待秒數照那個數字算', async () => {
      smsCodes.push(latestWithAge(10) as any);
      const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
      expect(resp.status).toBe(429);
      expect((await resp.json()).retryAfterSec).toBe(50);
      expect(sent).toEqual([]);
    });

    it('資料庫說過了 61 秒就放行 —— 即使那一筆根本沒有 created_at 可減', async () => {
      smsCodes.push(latestWithAge(61) as any);
      const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
      expect(resp.status).toBe(200);
      expect(sent).toHaveLength(1);
    });
  });

  // ── 同一個來源的當日上限 ──
  //
  // 按號碼算的上限擋不住換號碼：一台機器帶著一份號碼表跑過去，每一支都在自己
  // 的額度之內，而簡訊帳單是整份的，收到簡訊的也都是真實的人。
  describe('同一個來源的當日上限', () => {
    /**
     * 送一次真的請求，看伺服器實際記下來的來源位址長什麼樣。
     *
     * 不寫死 `127.0.0.1`：回送位址在不同環境下可能是 `::1` 或 `::ffff:127.0.0.1`，
     * 猜錯的話這一組會全部變成綠燈卻什麼都沒擋。
     */
    async function probeRequestIp(): Promise<string> {
      await client.postJson('/api/auth/sms/request', { phone: '13700000000' });
      return smsCodes[smsCodes.length - 1].request_ip!;
    }

    /** 塞一批「今天已經從這個來源送出去」的紀錄，號碼全部不同。 */
    function fillFromSameIp(count: number, ip: string) {
      for (let i = 0; i < count; i++) {
        smsCodes.push({
          id: nextCodeId++, phone: `1390000${String(i).padStart(4, '0')}`, code_hash: 'x',
          expires_at: new Date(), attempts: 0, consumed_at: null,
          request_ip: ip, created_at: new Date(),
        });
      }
    }

    it('達到上限後，換一支全新的號碼也送不出去', async () => {
      fillFromSameIp(49, await probeRequestIp()); // 連探測那一筆共 50 筆
      sent.length = 0;
      const resp = await client.postJson('/api/auth/sms/request', { phone: '13911112222' });

      expect(resp.status).toBe(429);
      expect(sent).toEqual([]);
    });

    it('沒達到上限就照常送 —— 一整間診所共用一個位址是正常使用', async () => {
      fillFromSameIp(48, await probeRequestIp()); // 共 49 筆
      sent.length = 0;
      const resp = await client.postJson('/api/auth/sms/request', { phone: '13911112222' });

      expect(resp.status).toBe(200);
      expect(sent).toHaveLength(1);
    });

    it('別的來源送過幾次不算在這個來源頭上', async () => {
      fillFromSameIp(80, '203.0.113.9');
      const resp = await client.postJson('/api/auth/sms/request', { phone: '13911112222' });

      expect(resp.status).toBe(200);
    });
  });
});

describe('簡訊通道未開放時', () => {
  // ── 這一條是整支測試的重點之一 ──
  it('金鑰未設定就明確回報通道未開放，不假裝送出成功', async () => {
    smsChannelOpen = false;
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
    const body = await resp.json();

    expect(resp.status).toBe(503);
    expect(body.success).not.toBe(true);
    expect(body.error).toBeTruthy();
  });

  it('沒送出去的驗證碼不留在資料庫裡卡住下一次索取', async () => {
    smsChannelOpen = false;
    await client.postJson('/api/auth/sms/request', { phone: PHONE });
    expect(smsCodes).toEqual([]);

    // 通道修好之後，家長不必等冷卻期就能再試一次。
    smsChannelOpen = true;
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
    expect(resp.status).toBe(200);
  });
});

describe('資料庫寫不進去時', () => {
  // ── 這一條是整支測試的重點之一 ──
  it('索取的寫入失敗就明確失敗，不吞例外、不退回記憶體、不回報成功', async () => {
    dbWriteFails = true;
    const resp = await client.postJson('/api/auth/sms/request', { phone: PHONE });
    const body = await resp.json();

    expect(resp.status).toBeGreaterThanOrEqual(500);
    expect(body.success).not.toBe(true);
    // 寫不進去就不該有簡訊出去 —— 那則簡訊的驗證碼永遠驗不了。
    expect(sent).toEqual([]);
  });

  it('建帳號失敗就明確失敗，且不發通行證', async () => {
    const code = await requestCode();
    dbWriteFails = true;
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code });
    const body = await resp.json();

    expect(resp.status).toBeGreaterThanOrEqual(500);
    expect(body.token).toBeUndefined();
    expect(body.success).not.toBe(true);
  });
});

describe('驗證碼的核對', () => {
  it('錯的驗證碼進不去，且錯誤次數會累加', async () => {
    await requestCode();
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '000000' });

    expect(resp.status).toBe(401);
    expect((await resp.json()).token).toBeUndefined();
    expect(smsCodes[0].attempts).toBe(1);
  });

  it('錯誤次數達上限即鎖定該筆，之後連正確的驗證碼也不放行', async () => {
    const code = await requestCode();
    for (let i = 0; i < 5; i++) {
      await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '000000' });
    }
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code });

    expect(resp.status).toBe(401);
    expect(users).toEqual([]);
    // 訊息要說得出「必須重新索取」，否則家長只會一直輸入同一組正確的碼。
    expect((await resp.json()).error).toContain('重新');
  });

  it('鎖定之後重新索取一次就能再登入', async () => {
    await requestCode();
    for (let i = 0; i < 5; i++) {
      await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '000000' });
    }
    ageLatestCode();
    const fresh = await requestCode();
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: fresh });

    expect(resp.status).toBe(200);
  });

  it('過期的驗證碼不放行', async () => {
    const code = await requestCode();
    smsCodes[0].expires_at = new Date(Date.now() - 1000);
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code });

    expect(resp.status).toBe(401);
    expect(users).toEqual([]);
  });

  it('同一組驗證碼不能用第二次', async () => {
    const code = await requestCode();
    expect((await client.postJson('/api/auth/sms/verify', { phone: PHONE, code })).status).toBe(200);

    const again = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code });
    expect(again.status).toBe(401);
    expect(users).toHaveLength(1);
  });

  it('從來沒索取過就直接驗證，一樣進不去', async () => {
    const resp = await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456' });
    expect(resp.status).toBe(401);
    expect(users).toEqual([]);
  });
});

describe('第一次驗證成功即建帳號，歸屬在那一刻寫入', () => {
  it('帶有效識別碼，歸屬寫進新帳號，並發出通行證', async () => {
    const code = await requestCode(PHONE, VALID_SLUG);
    const resp = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code, companySlug: VALID_SLUG,
    });
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.phone).toBe(PHONE);
    expect(users).toEqual([{ id: 1, phone: PHONE, email: null, company_id: COMPANY_ID }]);
  });

  it.each([
    ['識別碼查無此公司', 'not-a-real-company'],
    ['識別碼是空字串', ''],
    ['完全沒帶識別碼', undefined],
    ['識別碼型別不對', 12345],
  ])('%s 時歸屬留空，流程照常，且不猜一家公司填上去', async (_label, slug) => {
    const code = await requestCode();
    const resp = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code, ...(slug === undefined ? {} : { companySlug: slug }),
    });

    expect(resp.status).toBe(200);
    expect(users).toHaveLength(1);
    expect(users[0].company_id).toBeNull();
  });

  it('第二次登入不再建帳號，歸屬一個字都不動', async () => {
    const first = await requestCode(PHONE, VALID_SLUG);
    await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: first, companySlug: VALID_SLUG });

    ageLatestCode();
    const second = await requestCode(PHONE, VALID_SLUG);
    const resp = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code: second, companySlug: VALID_SLUG,
    });

    expect(resp.status).toBe(200);
    expect(users).toHaveLength(1);
    expect(users[0].company_id).toBe(COMPANY_ID);
  });
});

describe('同一支手機號在兩家公司是兩位家長（ADR-0002）', () => {
  // ── 這一條是整支測試的重點 ──
  it('在甲、乙兩家公司各建一個帳號，彼此不是同一位家長', async () => {
    const a = await requestCode(PHONE, VALID_SLUG);
    await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: a, companySlug: VALID_SLUG });

    ageLatestCode();
    const b = await requestCode(PHONE, OTHER_SLUG);
    await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: b, companySlug: OTHER_SLUG });

    expect(users).toHaveLength(2);
    expect(users.map(u => u.company_id)).toEqual([COMPANY_ID, OTHER_COMPANY_ID]);
    // 兩個不同的識別鍵 —— 孩子檔案與篩查分數以它為鍵，這是「彼此看不到」的所在。
    expect(users[0].id).not.toBe(users[1].id);
  });

  it('未歸屬範圍內同一支手機號只能有一個帳號', async () => {
    const first = await requestCode();
    await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: first });

    ageLatestCode();
    const second = await requestCode(PHONE, 'not-a-real-company');
    const resp = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code: second, companySlug: 'not-a-real-company',
    });

    expect(resp.status).toBe(200);
    expect(users).toHaveLength(1);
  });

  /**
   * 歸屬查詢在**這條路徑上**沒有安全的預設值。
   *
   * 註冊時查不動就留空是對的 —— 那是一個全新的帳號，未歸屬是正常狀態。
   * 但這裡查的是「該去哪一個範圍找他的既有帳號」：退成未歸屬會讓一位歸屬甲
   * 公司的家長在那一刻查不到自己，於是在未歸屬範圍內被建出第二個帳號，
   * 孩子的檔案與分數留在他再也走不回去的那一個。
   */
  it('歸屬查不動時明確失敗，不退成未歸屬另建一個帳號', async () => {
    const first = await requestCode(PHONE, VALID_SLUG);
    await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: first, companySlug: VALID_SLUG });
    expect(users).toHaveLength(1);

    ageLatestCode();
    const second = await requestCode(PHONE, VALID_SLUG);
    companyLookupFails = true;
    const resp = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code: second, companySlug: VALID_SLUG,
    });

    expect(resp.status).toBe(503);
    expect((await resp.json()).token).toBeUndefined();
    expect(users).toHaveLength(1);
  });

  /**
   * 那次失敗**不可以順手把驗證碼燒掉**。
   *
   * 燒掉的代價全落在家長身上：他手上那組正確的驗證碼再也驗不過，而按「重新
   * 获取」會撞上冷卻期 —— 於是被擋在門外一分鐘，拿著一組沒有用的號碼。
   * 歸屬查的是公司名冊，跟驗證碼有沒有被用過完全無關，先問不會少任何保護。
   */
  it('歸屬查不動時驗證碼不被作廢 —— 資料庫回來之後同一組還能用', async () => {
    const code = await requestCode(PHONE, VALID_SLUG);

    companyLookupFails = true;
    const failed = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code, companySlug: VALID_SLUG,
    });
    expect(failed.status).toBe(503);
    expect(smsCodes[0].consumed_at).toBeNull();

    companyLookupFails = false;
    const retry = await client.postJson('/api/auth/sms/verify', {
      phone: PHONE, code, companySlug: VALID_SLUG,
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).token).toBeTruthy();
  });

  it('歸屬甲公司的家長不會被乙公司的登入撿走', async () => {
    const a = await requestCode(PHONE, VALID_SLUG);
    const created = await (
      await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: a, companySlug: VALID_SLUG })
    ).json();

    ageLatestCode();
    const b = await requestCode(PHONE, OTHER_SLUG);
    const second = await (
      await client.postJson('/api/auth/sms/verify', { phone: PHONE, code: b, companySlug: OTHER_SLUG })
    ).json();

    // 通行證裡的識別鍵不同，才代表兩人的資料不會撞在一起。
    expect(second.token).not.toBe(created.token);
    expect(users[1].company_id).toBe(OTHER_COMPANY_ID);
  });
});
