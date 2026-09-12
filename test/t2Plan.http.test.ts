import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { planT2 } from '../src/t2/routing';
import { entranceState, t1FlagsFromScores } from '../src/t2/entrance';
import type { DiagnosisDirection } from '../src/t2/types';

/**
 * `GET /api/t2/plan` 與 `PUT /api/t2/diagnosis`（票 #56，規格 §9.2）。
 *
 * 寫法比照 `t2Gate.http.test.ts`：真的對 Express 發 HTTP 請求，資料層以替身供應。
 * 兩支都在 T2 閘門的白名單上 —— 付費牆要在**付費前**顯示題量，診斷方向會改題量，
 * 所以未解鎖的家長也要打得到。但**未登入**仍是 401：plan 是依這位家長的孩子與篩查算的。
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

/** 替身的 t2_intake：`saveT2Diagnosis` 寫進來、`getT2Diagnosis` 讀出去。 */
const intake = new Map<number, DiagnosisDirection | null>();
const saveCalls: Array<[number, DiagnosisDirection | null]> = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async (userId: number) => userId === UNLOCKED,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id, ...userData[id] } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => (row ? { child: row.child, completedScores: row.completedScores, orders: [], reportHistory: [] } : null),
  saveUserData: async () => {},
  getT2Diagnosis: async (id: number) => intake.get(id) ?? null,
  saveT2Diagnosis: async (id: number, d: DiagnosisDirection | null) => { saveCalls.push([id, d]); intake.set(id, d); },
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
  it('有 T1 結果的家長 → 200，內容與 planT2 對同一輸入的結果相同', async () => {
    const resp = await client.get('/api/t2/plan', bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();

    const flags = t1FlagsFromScores(SCORES_48 as any);
    const expected = planT2(flags, 48);
    expect(body.ageMonth).toBe(48);
    expect(body.required).toEqual(expected.required);
    expect(body.optional).toEqual(expected.optional);
    expect(body.followup).toEqual(expected.followup);
    expect(body.extras).toEqual(expected.extras);
    expect(body.noTool).toEqual(expected.noTool);
    expect(body.estimatedItems).toEqual(expected.estimatedItems);
    expect(body.functionOrder).toBeNull();
    // 前端要的三樣附帶資料
    expect(body.t1Flags).toEqual(flags);
    expect(body.diagnosisDirection).toBeNull();
    expect(body.entrance).toBe(entranceState(expected, flags));
  });

  it('§4.4 的固定輸入：必做 sxk-lang 49 ＋ sxk-ab 41、選做 sxk-spa 75', async () => {
    const body = await (await client.get('/api/t2/plan', bearer(UNLOCKED))).json();
    expect(body.required.map((i: any) => [i.toolId, i.askedCount])).toEqual([['sxk-lang', 49], ['sxk-ab', 41]]);
    expect(body.optional.map((i: any) => [i.toolId, i.askedCount])).toEqual([['sxk-spa', 75]]);
    expect(body.estimatedItems).toEqual({ required: 90, optional: 75, followup: 30 });
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

  it('帶診斷方向查詢 → 該疾病的工具全為 required', async () => {
    const resp = await client.get('/api/t2/plan?diagnosis=asd', bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    const flags = t1FlagsFromScores(SCORES_48 as any);
    const expected = planT2(flags, 48, 'asd');
    expect(body.required).toEqual(expected.required);
    expect(body.required.map((i: any) => i.toolId)).toEqual(
      expect.arrayContaining(['sxk-asb', 'sxk-asr', 'sxk-lang', 'sxk-dev', 'sxk-soc', 'sxk-adp']),
    );
    expect(body.functionOrder).toEqual(expected.functionOrder);
    expect(body.diagnosisDirection).toBe('asd');
  });

  /** 查詢字串上帶了、但不是十個代號之一 → 400，不能安靜地當成沒填。 */
  it('診斷方向不認得 → 400', async () => {
    const resp = await client.get('/api/t2/plan?diagnosis=autism', bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('DIAGNOSIS_INVALID');
  });

  it('查詢字串是空字串 → 視同沒填（中控台「未定」）', async () => {
    const resp = await client.get('/api/t2/plan?diagnosis=', bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect((await resp.json()).diagnosisDirection).toBeNull();
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

describe('PUT /api/t2/diagnosis', () => {
  it('未登入 → 401', async () => {
    const resp = await put('/api/t2/diagnosis', { diagnosis: 'asd' });
    expect(resp.status).toBe(401);
  });

  it('未解鎖也能存 —— 付費前就要能改題量', async () => {
    const resp = await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(LOCKED));
    expect(resp.status).toBe(200);
    expect((await resp.json()).diagnosisDirection).toBe('asd');
    expect(saveCalls).toContainEqual([LOCKED, 'asd']);
  });

  /** 存了之後，沒帶查詢字串的 plan 用存的那一個 —— 之後生成報告要帶（#59）。 */
  it('存了之後 plan 用存的那一個', async () => {
    await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED));
    const body = await (await client.get('/api/t2/plan', bearer(UNLOCKED))).json();
    expect(body.diagnosisDirection).toBe('asd');
    expect(body.required.map((i: any) => i.toolId)).toContain('sxk-asb');
  });

  /** 查詢字串蓋過存的：畫面上家長換選項時即時重算，還沒存也算得出來。 */
  it('查詢字串蓋過存的那一個', async () => {
    await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED));
    const body = await (await client.get('/api/t2/plan?diagnosis=cp', bearer(UNLOCKED))).json();
    expect(body.diagnosisDirection).toBe('cp');
    expect(body.required.map((i: any) => i.toolId)).toContain('sxk-gm');
  });

  it('清掉：null 與空字串都存成 null', async () => {
    await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED));
    const resp = await put('/api/t2/diagnosis', { diagnosis: null }, bearer(UNLOCKED));
    expect(resp.status).toBe(200);
    expect((await resp.json()).diagnosisDirection).toBeNull();
    expect(intake.get(UNLOCKED)).toBeNull();

    await put('/api/t2/diagnosis', { diagnosis: 'asd' }, bearer(UNLOCKED));
    await put('/api/t2/diagnosis', { diagnosis: '' }, bearer(UNLOCKED));
    expect(intake.get(UNLOCKED)).toBeNull();

    const body = await (await client.get('/api/t2/plan', bearer(UNLOCKED))).json();
    expect(body.diagnosisDirection).toBeNull();
    expect(body.required.map((i: any) => i.toolId)).toEqual(['sxk-lang', 'sxk-ab']);
  });

  it('不認得的值 → 400，沒有寫進去', async () => {
    const before = saveCalls.length;
    const resp = await put('/api/t2/diagnosis', { diagnosis: 'autism' }, bearer(UNLOCKED));
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('DIAGNOSIS_INVALID');
    expect(saveCalls.length).toBe(before);
  });
});
