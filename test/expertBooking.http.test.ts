import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 四種諮詢的 HTTP 測試（issue #21）。
 *
 * 純函式測試（`serviceTypes.test.ts`）證明得了「這個字串認不認得」，證明不了
 * **路由有沒有把它讀進去、有沒有原封不動傳給資料層與通知**。這條路徑上有兩個
 * 落點，錯了都不會有任何聲音：
 *
 *   1. 路由讀了 `serviceType` 卻沒往下傳 → 每一筆都存成線上諮詢說明，
 *      而家長端的四顆按鈕看起來都正常。
 *   2. 認不得的值悄悄落回預設 → 同上，只是換一種方式。
 *
 * 資料層與通知都以替身供應，並把收到的東西原樣記下來 —— 「伺服器到底送了
 * 哪一種下去」因此成為斷言得到的事實，而不是要去偷看的內部呼叫。
 */

const bookings: any[] = [];
const notifications: any[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async () => null,
  findCompanyByUserId: async () => null,
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
  listUnlockedDimensions: async () => [],
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  markBookingNotified: async () => {},
  createExpertBooking: async (input: any) => {
    bookings.push(input);
    return bookings.length;
  },
}));

vi.mock('../src/notify', () => ({
  notifyExpertBooking: async (n: any) => {
    notifications.push(n);
    return [{ channel: 'wecom', ok: true, detail: 'test' }];
  },
}));

let client: TestClient;

/** 一份最小的合法預約。服務類型由各測試自己決定要不要帶。 */
function body(extra: Record<string, unknown> = {}) {
  return {
    specialistId: 'spec-1',
    specialistName: '王医师',
    parentName: '张妈妈',
    parentPhone: '13800138000',
    childAgeMonth: 36,
    childGender: 'boy',
    reportSummary: '语言沟通（临界 5/8）',
    preferredSlot: '2026-08-20 周四上午',
    deviceId: 'dev-1',
    ...extra,
  };
}

/** 通知是背景工作，回應送出之後才跑 —— 給事件迴圈一次機會。 */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  bookings.length = 0;
  notifications.length = 0;
});

afterAll(async () => {
  await client.close();
});

describe('四種服務都約得到，而且存的是家長按的那一種', () => {
  it.each([
    'online_consult',
    'online_training',
    'offline_training',
    'offline_consult',
  ])('%s 存進資料層時仍是同一種', async serviceType => {
    const resp = await client.postJson('/api/expert-booking', body({ serviceType }));
    expect(resp.status).toBe(200);
    expect((await resp.json()).ok).toBe(true);
    expect(bookings).toHaveLength(1);
    expect(bookings[0].serviceType).toBe(serviceType);
  });

  it.each([
    'online_consult',
    'online_training',
    'offline_training',
    'offline_consult',
  ])('%s 也原封不動傳給通知', async serviceType => {
    await client.postJson('/api/expert-booking', body({ serviceType }));
    await settle();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].serviceType).toBe(serviceType);
  });
});

describe('既有的線上諮詢說明行為不變', () => {
  /**
   * 本 issue 的驗收條件之一。既有的家長端建置根本不送 `serviceType` ——
   * 這裡若拒絕或存成別的類型，專案 B 唯一的轉換點會在部署當下壞掉，
   * 而症狀是「約了但客服接到的是另一種服務」。
   */
  it('沒帶服務類型時，存的是線上諮詢說明', async () => {
    const resp = await client.postJson('/api/expert-booking', body());
    expect(resp.status).toBe(200);
    expect(bookings[0].serviceType).toBe('online_consult');
  });

  it('其餘每一個欄位都照舊傳下去', async () => {
    await client.postJson('/api/expert-booking', body());
    expect(bookings[0]).toMatchObject({
      specialistId: 'spec-1',
      parentName: '张妈妈',
      parentPhone: '13800138000',
      childAgeMonth: 36,
      childGender: 'boy',
      reportSummary: '语言沟通（临界 5/8）',
      preferredSlot: '2026-08-20 周四上午',
      deviceId: 'dev-1',
    });
  });

  it('既有的欄位驗證一條都沒鬆掉', async () => {
    const missingSpecialist = await client.postJson('/api/expert-booking', body({ specialistId: '' }));
    expect(missingSpecialist.status).toBe(400);

    const badPhone = await client.postJson('/api/expert-booking', body({ parentPhone: '123' }));
    expect(badPhone.status).toBe(400);

    const noName = await client.postJson('/api/expert-booking', body({ parentName: '   ' }));
    expect(noName.status).toBe(400);

    expect(bookings).toEqual([]);
  });
});

describe('認不得的服務類型被擋在門口', () => {
  /**
   * 悄悄落回預設值才是最貴的失敗：家長按的是線下訓練，存進去的是線上諮詢，
   * 客服照著線上的流程回電，而**沒有任何一個畫面看得出這個落差**。
   * 400 讓錯誤停在送出的那一刻。
   */
  it.each([
    ['拼錯', 'offline_trainning'],
    ['大小寫不同', 'OFFLINE_TRAINING'],
    ['前後有空白', ' offline_training '],
    ['中文名稱', '线下干预训练'],
    ['非字串', 42],
  ])('%s 回 400，而且一列都沒寫進去', async (_label, serviceType) => {
    const resp = await client.postJson('/api/expert-booking', body({ serviceType }));
    expect(resp.status).toBe(400);
    expect(bookings).toEqual([]);
    expect(notifications).toEqual([]);
  });
});
