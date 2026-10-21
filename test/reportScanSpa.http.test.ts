import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Express } from 'express';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 掃碼頁改走 SPA（客戶 10/17 第 1 項，issue #65，規格 docs/specs/client-changes-2026-10-17.md §2.2）。
 *
 * 開關 `REPORT_SCAN_SPA` 開著時：
 *   - `GET /api/r/:token` 依 token 回**那一筆**報告快照（收乾淨的），不帶手機號、帳號、其他報告；
 *   - `/r/:token` 交給 SPA（`index.html`），前端看路徑畫 `ReportBody`。
 * 開關關著時的行為由 `reportLink.http.test.ts` 原封不動地驗（那支檔不設這個開關）。
 *
 * ⚠️ 必須在載入 `server.ts` 之前設定：開關在模組層級就讀掉了。
 */
process.env.REPORT_SCAN_SPA = '1';

const OWNER_ID = 7;
const OTHER_ID = 8;
const OWNER_PHONE = '13912345678';
const OWNER_EMAIL = 'owner@example.com';

const OWNER_REPORT_ID = 'rep-owner-001';
const OWNER_OLD_REPORT_ID = 'rep-owner-000';
const OWNER_GONE_REPORT_ID = 'rep-owner-gone';
const OTHER_REPORT_ID = 'rep-other-001';

vi.mock('../src/db/mysql', () => {
  const links: Array<{ token: string; userId: number; reportId: string }> = [];

  const record = (id: string, childName: string, summary: string, createdAt: string) => ({
    id,
    type: 'T1_SCREENING',
    createdAt,
    child: { name: childName, ageMonth: 36, gender: 'boy' },
    scores: [
      {
        dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T1',
        score: 3, maxScore: 8, status: 'delay',
        completedAt: createdAt, assessedAgeMonth: 36,
      },
    ],
    aiReport: {
      summary,
      neuralPathwayAnalysis: '神经环路分析内容',
      rehabSuggestions: ['建议一'],
      homeGuidance: ['指导一'],
      prognosisPrediction: '预后内容',
      criticalMetrics: {
        neuralPlasticity: 70, sensoryIntegration: 71,
        familyEnvironmentScore: 72, motorControlIndex: 73,
      },
    },
    isAiGenerated: true,
    // 家長端存上來的 JSON 什麼都可能夾帶 —— 收乾淨之後不該出門。
    contactPhone: '13912345678',
  });

  const userData: Record<number, any> = {
    [OWNER_ID]: {
      child: { name: '小明', ageMonth: 40, gender: 'boy' },
      phone: OWNER_PHONE,
      email: OWNER_EMAIL,
      completedScores: [],
      orders: [],
      reportHistory: [
        record(OWNER_OLD_REPORT_ID, '小明', '这是上一次的旧报告', '2026-07-01T02:00:00.000Z'),
        record(OWNER_REPORT_ID, '小明', '这是扫码带走的那一份', '2026-08-01T02:00:00.000Z'),
      ],
    },
    [OTHER_ID]: {
      child: { name: '小华', ageMonth: 30, gender: 'girl' },
      completedScores: [],
      orders: [],
      reportHistory: [record(OTHER_REPORT_ID, '小华', '这是别人家的报告', '2026-08-02T02:00:00.000Z')],
    },
  };

  return {
    isConfigured: () => true,
    findUserById: async (id: number) => (userData[id] ? { id, phone: OWNER_PHONE, email: OWNER_EMAIL } : null),
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

let app: Express;
let client: TestClient;

async function issueToken(userId: number, reportId: string): Promise<string> {
  const resp = await client.postJson('/api/report-link', { reportId }, bearer(userId));
  expect(resp.status).toBe(200);
  const body = await resp.json();
  return new URL(body.url).pathname.replace(/^\/r\//, '');
}

beforeAll(async () => {
  app = await loadApp();
  // 正式站的 SPA 兜底在 `startServer()` 裡（`app.get('*')` 回 index.html），測試不呼叫它。
  // 這裡掛一個同位置的替身：Express 照註冊順序比對，排在所有路由之後，與正式站一樣。
  app.get('*', (_req, res) => {
    res.type('html').send('<!doctype html><div id="root"></div><!-- SPA -->');
  });
  client = await startTestApp(app);
});

afterAll(async () => {
  await client.close();
});

describe('GET /api/r/:token（開關開著）', () => {
  it('不必登入，回那一筆報告快照與當時的孩子', async () => {
    const token = await issueToken(OWNER_ID, OWNER_REPORT_ID);
    const resp = await client.get(`/api/r/${token}`);
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.child).toEqual({ name: '小明', ageMonth: 36, gender: 'boy' });
    expect(body.record.id).toBe(OWNER_REPORT_ID);
    expect(body.record.createdAt).toBe('2026-08-01T02:00:00.000Z');
    expect(body.record.isAiGenerated).toBe(true);
    expect(body.record.aiReport.summary).toBe('这是扫码带走的那一份');
    expect(body.record.aiReport.criticalMetrics).toEqual({
      neuralPlasticity: 70, sensoryIntegration: 71, familyEnvironmentScore: 72, motorControlIndex: 73,
    });
    expect(body.record.scores).toEqual([
      {
        dimensionId: 'language', dimensionName: '语言沟通', tierId: 'T1',
        score: 3, maxScore: 8, status: 'delay',
        completedAt: '2026-08-01T02:00:00.000Z', assessedAgeMonth: 36,
      },
    ]);
  });

  it('token 只對應那一份，不端出同一位家長的另一份', async () => {
    const token = await issueToken(OWNER_ID, OWNER_OLD_REPORT_ID);
    const text = await (await client.get(`/api/r/${token}`)).text();
    expect(text).toContain('这是上一次的旧报告');
    expect(text).not.toContain('这是扫码带走的那一份');
  });

  it('別人的 token 給的是別人的報告', async () => {
    const mine = await issueToken(OWNER_ID, OWNER_REPORT_ID);
    const text = await (await client.get(`/api/r/${mine}`)).text();
    expect(text).not.toContain('小华');
    expect(text).not.toContain('这是别人家的报告');
  });

  it('回應裡沒有手機號、帳號、其他報告', async () => {
    const token = await issueToken(OWNER_ID, OWNER_REPORT_ID);
    const resp = await client.get(`/api/r/${token}`);
    const body = await resp.json();
    expect(Object.keys(body).sort()).toEqual(['child', 'record']);
    const text = JSON.stringify(body);
    expect(text).not.toContain(OWNER_PHONE);
    expect(text).not.toContain(OWNER_EMAIL);
    expect(text).not.toMatch(/phone|email|userId|reportHistory/i);
    expect(text).not.toContain('这是上一次的旧报告');
  });

  it.each([
    ['形狀不對的 token', '/api/r/abc'],
    ['形狀對但查無', `/api/r/${'A'.repeat(43)}`],
    ['帶路徑穿越', '/api/r/..%2f..%2fetc'],
  ])('%s → 404', async (_label, path) => {
    const resp = await client.get(path);
    expect(resp.status).toBe(404);
    expect(resp.headers.get('content-type')).toContain('application/json');
  });

  // 不退回最新一份：拿著這張二維碼的人不會知道自己看的已經換了一份。
  it('報告已不在歷史裡 → 404，不退回最新一份', async () => {
    const token = await issueToken(OWNER_ID, OWNER_GONE_REPORT_ID);
    const resp = await client.get(`/api/r/${token}`);
    expect(resp.status).toBe(404);
    expect(await resp.text()).not.toContain('这是扫码带走的那一份');
  });
});

describe('/r/:token（開關開著）交給 SPA', () => {
  // 已經印出去的二維碼網址就是這一條，路徑不變。
  it('有效的 token：回 index.html，不再是伺服器拼的 HTML', async () => {
    const token = await issueToken(OWNER_ID, OWNER_REPORT_ID);
    const resp = await client.get(`/r/${token}`);
    expect(resp.status).toBe(200);
    const html = await resp.text();
    expect(html).toContain('<!-- SPA -->');
    expect(html).not.toContain('这是扫码带走的那一份');
  });

  // 失效字樣由前端畫（打 /api/r/:token 拿到 404）—— 伺服器這一頭不先查。
  it('失效的 token 也回 SPA，由前端畫失效字樣', async () => {
    const resp = await client.get(`/r/${'A'.repeat(43)}`);
    const html = await resp.text();
    expect(html).toContain('<!-- SPA -->');
  });
});
