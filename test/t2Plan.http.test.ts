import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { planT2 } from '../src/t2/routing';
import { entranceState, t1FlagsFromScores } from '../src/t2/entrance';
import { singleFormPlan } from '../src/t2/interimPlan';

/**
 * `GET /api/t2/plan`（票 #56，規格 §9.2）；`PUT /api/t2/diagnosis` 2026-09-29 拿掉了（最後一段證明它不在）。
 *
 * 寫法比照 `t2Gate.http.test.ts`：真的對 Express 發 HTTP 請求，資料層以替身供應。
 * plan 在 T2 閘門的白名單上 —— 付費牆要在**付費前**顯示題量，
 * 所以未解鎖的家長也要打得到。但**未登入**仍是 401：plan 是依這位家長的孩子與篩查算的。
 *
 * 【暫行規則】2026-09-29 起回給畫面的是 `singleFormPlan(planT2(...))`：每個被標記的維度只列一份、全部必做，
 * 選做／加測／補充問卷先不出（`src/t2/interimPlan.ts`，使用者：表單來之前先這樣）。規則引擎本身的逐格測試不動。
 *
 * 【固定日期】
 * 實足月齡由出生日期與「今天」算，測試把今天釘住，孩子才不會在測試寫完的下個月長大一個月。
 */

const TODAY = new Date('2026-09-12T08:00:00+08:00');
vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });

/** 2022-09-12 出生 → 2026-09-12 剛好 48 個月。 */
const BIRTH_48M = '2022-09-12';
/** 2020-01-12 出生 → 80 個月。 */
const BIRTH_80M = '2020-01-12';

const UNLOCKED = 1;
const LOCKED = 2;
const NO_T1 = 3;
const OLDER = 4;
const NO_BIRTHDATE = 5;

const users: Record<number, { id: number; phone: string }> = {
  [UNLOCKED]: { id: UNLOCKED, phone: '13800000001' },
  [LOCKED]: { id: LOCKED, phone: '13800000002' },
  [NO_T1]: { id: NO_T1, phone: '13800000003' },
  [OLDER]: { id: OLDER, phone: '13800000004' },
  [NO_BIRTHDATE]: { id: NO_BIRTHDATE, phone: '13800000005' },
};

function t1(dimensionId: string, status: 'normal' | 'borderline' | 'delay') {
  return { dimensionId, dimensionName: dimensionId, tierId: 'T1', score: 0, maxScore: 8, status, completedAt: '2026-09-01T00:00:00Z' };
}

/** 48 個月、LANG 紅、ATT 紅、SEN 黃 —— 規格 §4.4 的固定輸入。 */
const SCORES_48 = [
  t1('language', 'delay'), t1('attention', 'delay'), t1('sensory_processing', 'borderline'),
  t1('cognitive', 'normal'), t1('social_emotional', 'normal'), t1('emotion_behavior', 'normal'),
  t1('gross_motor', 'normal'), t1('self_care', 'normal'), t1('learning_ability', 'normal'),
];
/** 80 個月、只有 LANG 紅 —— §4.5 的 no_tool 格。 */
const SCORES_80 = [t1('language', 'delay')];

const userData: Record<number, { child: any; completedScores: any[] }> = {
  [UNLOCKED]: { child: { name: '小明', birthDate: BIRTH_48M, ageMonth: 48, gender: 'boy' }, completedScores: SCORES_48 },
  [LOCKED]: { child: { name: '小华', birthDate: BIRTH_48M, ageMonth: 48, gender: 'girl' }, completedScores: SCORES_48 },
  [NO_T1]: { child: { name: '小空', birthDate: BIRTH_48M, ageMonth: 48, gender: 'boy' }, completedScores: [] },
  [OLDER]: { child: { name: '小大', birthDate: BIRTH_80M, ageMonth: 80, gender: 'boy' }, completedScores: SCORES_80 },
  // 舊檔案沒有出生日期：只剩存檔當時算的 ageMonth
  [NO_BIRTHDATE]: { child: { name: '小舊', ageMonth: 48, gender: 'girl' }, completedScores: SCORES_48 },
};

/**
 * 診斷方向 2026-09-29 前後端一起拿掉：`t2_intake` 不再讀寫。替身留著這兩支，只為了證明**一次都沒被叫到**。
 */
const intakeCalls: string[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId === UNLOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  getT2Diagnosis: async () => { intakeCalls.push('get'); return 'asd'; },
  saveT2Diagnosis: async () => { intakeCalls.push('save'); },
  createPayment: async () => 1,
  findPaymentByOutTradeNo: async () => null,
  markPaymentSuccess: async () => false,
  grantUnlock: async () => {},
  createExpertBooking: async () => 1,
  markBookingNotified: async () => {},
}));

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  vi.useRealTimers();
});

const put = (path: string, body: unknown, headers?: Record<string, string>) =>
  client.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });

describe('GET /api/t2/plan', () => {
  it('有 T1 結果的家長 → 200，內容是 planT2 對同一輸入的結果套上暫行規則', async () => {
    const resp = await client.get('/api/t2/plan', bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();

    const flags = t1FlagsFromScores(SCORES_48 as any);
    const expected = singleFormPlan(planT2(flags, 48), flags);
    expect(body.ageMonth).toBe(48);
    expect(body.required).toEqual(expected.required);
    expect(body.optional).toEqual(expected.optional);
    expect(body.followup).toEqual(expected.followup);
    expect(body.extras).toEqual(expected.extras);
    expect(body.noTool).toEqual(expected.noTool);
    expect(body.estimatedItems).toEqual(expected.estimatedItems);
    expect(body.functionOrder).toBeNull();
    // 前端要的兩樣附帶資料；診斷方向（與暫行規則的 singleForm 提示）已經拿掉
    expect(body.t1Flags).toEqual(flags);
    expect(body.entrance).toBe(entranceState(expected, flags));
    expect(body).not.toHaveProperty('diagnosisDirection');
    expect(body).not.toHaveProperty('singleForm');
  });

  it('§4.4 的固定輸入：每個被標記的維度一份、全部必做（原本的選做 sxk-spa 也列必做）；沒有選做、加測、補充問卷', async () => {
    const body = await (await client.get('/api/t2/plan', bearer(UNLOCKED))).json();
    expect(body.required.map((i: any) => [i.toolId, i.askedCount, i.role])).toEqual([
      ['sxk-lang', 49, 'required'], ['sxk-ab', 41, 'required'], ['sxk-spa', 75, 'required'],
    ]);
    expect(body.optional).toEqual([]);
    expect(body.followup).toEqual([]);
    expect(body.extras).toEqual([]);
    expect(body.estimatedItems).toEqual({ required: 165, optional: 0, followup: 0 });
    expect(body.entrance).toBe('show');
  });

  /** 付費牆要顯示題量，所以未解鎖也 200（§9.2）。 */
  it('未解鎖也 200，內容相同', async () => {
    const locked = await client.get('/api/t2/plan', bearer(LOCKED));
    expect(locked.status).toBe(200);
    const unlocked = await client.get('/api/t2/plan', bearer(UNLOCKED));
    const a = await locked.json();
    const b = await unlocked.json();
    expect(a.required).toEqual(b.required);
    expect(a.estimatedItems).toEqual(b.estimatedItems);
  });

  it('未登入 → 401', async () => {
    const resp = await client.get('/api/t2/plan');
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  /** 診斷方向拿掉了：舊版前端若還帶著 `?diagnosis=`，一律不看（不 400、不改題量、不改順序）。 */
  it('帶 ?diagnosis= 也不看', async () => {
    const plain = await (await client.get('/api/t2/plan', bearer(UNLOCKED))).json();
    for (const q of ['asd', 'autism', '']) {
      const resp = await client.get(`/api/t2/plan?diagnosis=${q}`, bearer(UNLOCKED));
      expect(resp.status, q).toBe(200);
      const body = await resp.json();
      expect(body.required, q).toEqual(plain.required);
      expect(body.functionOrder, q).toBeNull();
    }
  });

  /** 80 個月、只有 LANG 紅：LANG no_tool、什麼都不用答 → 入口不顯示、導向專家。 */
  it('被標記的維度全是 no_tool → entrance = expert_only', async () => {
    const body = await (await client.get('/api/t2/plan', bearer(OLDER))).json();
    expect(body.ageMonth).toBe(80);
    expect(body.noTool).toEqual(['LANG']);
    expect(body.required).toEqual([]);
    expect(body.entrance).toBe('expert_only');
  });

  it('沒做過篩查 → 404 T1_REQUIRED', async () => {
    const resp = await client.get('/api/t2/plan', bearer(NO_T1));
    expect(resp.status).toBe(404);
    expect((await resp.json()).code).toBe('T1_REQUIRED');
  });

  /** 沒有出生日期的舊檔案：退回存檔時的 ageMonth，不是拒絕。 */
  it('沒有出生日期 → 用檔案上的 ageMonth', async () => {
    const body = await (await client.get('/api/t2/plan', bearer(NO_BIRTHDATE))).json();
    expect(body.ageMonth).toBe(48);
  });
});

describe('診斷方向（2026-09-29 前後端一起拿掉）', () => {
  // `/api/t2` 的付費閘門在路由之前：沒登入 401、沒買 403，與任何一條不存在的 `/api/t2/…` 一樣；
  // 登入又買了的家長才走得到「沒有這條路」—— 404。它不再是付費前開放的路徑。
  it('PUT /api/t2/diagnosis 不存在了：登入又買了的家長 404；沒買的 403（不再是付費前開放的路徑）', async () => {
    expect((await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED))).status).toBe(404);
    expect((await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(LOCKED))).status).toBe(403);
  });

  it('t2_intake 一次都沒被讀、沒被寫（資料庫裡就算有舊值也不影響題量）', async () => {
    intakeCalls.length = 0;
    await client.get('/api/t2/plan', bearer(UNLOCKED));
    await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED));
    expect(intakeCalls).toEqual([]);
  });
});
