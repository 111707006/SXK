import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 掃碼帶走報告的 HTTP 測試（issue #22）。
 *
 * 純函式測試（`reportLink.test.ts`）證明得了 token 猜不到，證明不了**這條路徑
 * 真的存在、真的認得那個 token、也真的只端出那一份報告**。那三件事只有對真的
 * 路由發真的請求才驗得到 —— 這個 repo 已經為此付過一次代價（付費閘門的授權
 * 繞過，101 個純函式測試一條都沒攔住）。
 *
 * 這裡真正要抓的是**別人的報告拿不到**。壞掉的樣子非常安靜：換一個 token 照樣
 * 回 200，只是內容是另一個孩子的。
 */

const OWNER_ID = 7;
const OTHER_ID = 8;

const OWNER_REPORT_ID = 'rep-owner-001';
const OWNER_OLD_REPORT_ID = 'rep-owner-000';
const OTHER_REPORT_ID = 'rep-other-001';

/** 資料層替身。token → 使用者的對應由它保管，形狀與正式的 report_links 相同。 */
vi.mock('../src/db/mysql', () => {
  const links: Array<{ token: string; userId: number; reportId: string }> = [];

  const record = (id: string, childName: string, summary: string) => ({
    id,
    type: 'T1_SCREENING',
    createdAt: '2026-08-01T02:00:00.000Z',
    child: { name: childName, ageMonth: 36, gender: 'boy' },
    scores: [
      {
        dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T1',
        score: 3, maxScore: 8, status: 'delay',
        completedAt: '2026-08-01T02:00:00.000Z', assessedAgeMonth: 36,
      },
    ],
    aiReport: {
      summary,
      neuralPathwayAnalysis: '神经环路分析内容',
      rehabSuggestions: ['建议一'],
      homeGuidance: ['指导一'],
      prognosisPrediction: '预后内容',
      criticalMetrics: {
        neuralPlasticity: 70, sensoryIntegration: 70,
        familyEnvironmentScore: 70, motorControlIndex: 70,
      },
    },
    isAiGenerated: true,
  });

  const userData: Record<number, any> = {
    [OWNER_ID]: {
      child: { name: '小明', ageMonth: 36, gender: 'boy' },
      completedScores: [],
      orders: [],
      reportHistory: [
        record(OWNER_OLD_REPORT_ID, '小明', '这是上一次的旧报告'),
        record(OWNER_REPORT_ID, '小明', '这是扫码带走的那一份'),
      ],
    },
    [OTHER_ID]: {
      child: { name: '小华', ageMonth: 30, gender: 'girl' },
      completedScores: [],
      orders: [],
      reportHistory: [record(OTHER_REPORT_ID, '小华', '这是别人家的报告')],
    },
  };

  return {
    __links: links,
    isConfigured: () => true,
    findUserById: async (id: number) => (userData[id] ? { id } : null),
    getUserDataByUserId: async (userId: number) => userData[userId] ?? null,
    getUserDataByDevice: async () => null,
    saveUserData: async () => {},
    parseUserDataRow: (row: any) => row,
    listUnlockedDimensions: async () => [],
    createPayment: async () => 1,
    findPaymentByOutTradeNo: async () => null,
    markPaymentSuccess: async () => false,
    grantUnlock: async () => {},
    createExpertBooking: async () => 1,
    markBookingNotified: async () => {},

    async issueReportLink(userId: number, reportId: string, freshToken: string) {
      // 與正式的 ON DUPLICATE KEY UPDATE 同一個語意：一份報告只發一個 token。
      const existing = links.find(l => l.userId === userId && l.reportId === reportId);
      if (existing) return existing.token;
      links.push({ token: freshToken, userId, reportId });
      return freshToken;
    },
    async findReportLinkByToken(token: string) {
      const hit = links.find(l => l.token === token);
      return hit ? { userId: hit.userId, reportId: hit.reportId } : null;
    },
  };
});

let client: TestClient;

async function issue(userId: number, reportId: string): Promise<{ url: string; qrSvg: string }> {
  const resp = await client.postJson('/api/report-link', { reportId }, bearer(userId));
  expect(resp.status).toBe(200);
  const body = await resp.json();
  expect(body.available).toBe(true);
  return body;
}

/** 從絕對網址裡取回路徑，測試用戶端只吃相對路徑。 */
function pathOf(url: string): string {
  return new URL(url).pathname;
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
});

describe('產生報告連結', () => {
  it('登入的家長拿得到一條帶長亂數的連結與一張二維碼', async () => {
    const { url, qrSvg } = await issue(OWNER_ID, OWNER_REPORT_ID);
    // 43 個字元的 base64url —— 與 reportLink.ts 的常數同一件事。
    expect(pathOf(url)).toMatch(/^\/r\/[A-Za-z0-9_-]{43}$/);
    expect(qrSvg).toContain('<svg');
    // 二維碼要真的有圖，不是一個空的 <svg/>。
    expect(qrSvg).toContain('<path');
  });

  // 少了這一條，家長每重開一次報告頁就多一個**永久且撤不回**的連結。
  it('同一份報告重複索取拿到的是同一條連結', async () => {
    const first = await issue(OWNER_ID, OWNER_REPORT_ID);
    const second = await issue(OWNER_ID, OWNER_REPORT_ID);
    expect(second.url).toBe(first.url);
  });

  it('不同的報告是不同的連結', async () => {
    const a = await issue(OWNER_ID, OWNER_REPORT_ID);
    const b = await issue(OWNER_ID, OWNER_OLD_REPORT_ID);
    expect(a.url).not.toBe(b.url);
  });

  it('沒登入索取不到 —— 連結綁在帳號上', async () => {
    const resp = await client.postJson('/api/report-link', { reportId: OWNER_REPORT_ID });
    expect(resp.status).toBe(401);
  });

  it('沒帶報告編號回 400，不發一條指向不明的連結', async () => {
    const resp = await client.postJson('/api/report-link', {}, bearer(OWNER_ID));
    expect(resp.status).toBe(400);
  });
});

describe('掃碼打開的那一頁', () => {
  it('不必登入就打得開，內容是那一份報告', async () => {
    const { url } = await issue(OWNER_ID, OWNER_REPORT_ID);
    // 刻意不帶 Authorization：手機上沒有登入，那正是這個功能存在的理由。
    const resp = await client.get(pathOf(url));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/html');

    const html = await resp.text();
    expect(html).toContain('小明');
    expect(html).toContain('这是扫码带走的那一份');
    expect(html).toContain('语言沟通');
  });

  /**
   * 本檔的核心。同一位家長有兩份報告，token 指的是哪一份就只能看到哪一份 ——
   * 退回「最新的那一份」的話，拿著這張二維碼的醫師會在某一天看到另一份內容，
   * 而他不會知道換了。
   */
  it('token 只對應該份報告，不會端出同一位家長的另一份', async () => {
    const { url } = await issue(OWNER_ID, OWNER_OLD_REPORT_ID);
    const html = await (await client.get(pathOf(url))).text();
    expect(html).toContain('这是上一次的旧报告');
    expect(html).not.toContain('这是扫码带走的那一份');
  });

  // 換一個 token 就看到別人的孩子 —— 這是這條公開路徑最貴的一種壞法。
  it('別人的 token 給的是別人的報告，猜不到就拿不到', async () => {
    const mine = await issue(OWNER_ID, OWNER_REPORT_ID);
    const theirs = await issue(OTHER_ID, OTHER_REPORT_ID);
    expect(theirs.url).not.toBe(mine.url);

    const html = await (await client.get(pathOf(mine.url))).text();
    expect(html).not.toContain('小华');
    expect(html).not.toContain('这是别人家的报告');
  });

  it.each([
    ['形狀不對的 token', '/r/abc'],
    ['形狀對但不存在的 token', `/r/${'A'.repeat(43)}`],
    ['帶路徑穿越的 token', '/r/..%2f..%2fetc'],
  ])('%s 回 404，而且是一頁人看得懂的中文', async (_label, path) => {
    const resp = await client.get(path);
    expect(resp.status).toBe(404);
    expect(await resp.text()).toContain('重新扫一次');
  });

  // 手機上打得開才算數。少了 viewport，iOS Safari 會用 980px 的假想寬度排版
  // 再整頁縮小，字小到讀不了 —— 而畫面上看起來「有內容」。
  it('版面在手機上讀得了', async () => {
    const { url } = await issue(OWNER_ID, OWNER_REPORT_ID);
    const html = await (await client.get(pathOf(url))).text();
    expect(html).toContain('name="viewport"');
    expect(html).toContain('width=device-width');
  });

  /**
   * 這條連結撤不回來。報告本身已經是敏感資料，沒有理由讓它再多帶一組聯絡方式
   * 出門 —— 專家預約區塊裡有聯絡人姓名與手機號。
   */
  it('不夾帶帳號與專家預約裡的聯絡方式', async () => {
    const { url } = await issue(OWNER_ID, OWNER_REPORT_ID);
    const html = await (await client.get(pathOf(url))).text();
    expect(html).not.toContain('专家预约');
  });
});
