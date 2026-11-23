import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApp, startTestApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { ADHD_PAGE_VERSION } from '../src/adhd/page';

/** ⚠️ 必須在載入 `server.ts` 之前設定。 */
process.env.APP_MODE = 'adhd';

const ME = 7;
const OTHER = 8;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === 7 || id === 8 ? { id, phone: '13800000000', company_id: 1 } : null),
}));

const rows = vi.hoisted(() => [] as { id: number; userId: number; clientCaseId: string; input: any }[]);
vi.mock('../src/db/adhdAssessments', () => ({
  upsertAdhdAssessment: async (userId: number, input: any) => {
    const hit = rows.find(r => r.userId === userId && r.clientCaseId === input.clientCaseId);
    if (hit) {
      hit.input = input;
      return hit.id;
    }
    const id = rows.length + 1;
    rows.push({ id, userId, clientCaseId: input.clientCaseId, input });
    return id;
  },
  listAdhdAssessments: async (userId: number) =>
    rows
      .filter(r => r.userId === userId)
      .map(r => ({ id: r.id, subjectName: r.input.subjectName, conclusionStatus: r.input.conclusionStatus, conclusionTitle: r.input.conclusionTitle, createdAt: '', updatedAt: '' })),
  findAdhdAssessmentPayload: async (userId: number, id: number) => rows.find(r => r.userId === userId && r.id === id)?.input.payload ?? null,
}));

/** 客戶頁面 `casePayload()` 的形狀（2026-11-23 在頁面上實際取的，留下這幾欄）。 */
function payload(over: Record<string, unknown> = {}) {
  return {
    system: 'SXK-ADHD-SCREEN',
    version: '1.3',
    basics: { name: '测试', ageYears: '30' },
    raw: {
      s1: [3, 3, 2, 4, 3, 2],
      a18: [3, 3, 2, 3, 3, 4, 2, 3, 2, 3, 1, 3, 2, 3, 1, 2, 1, 2],
      obs: { ans: Array(30).fill(1), info: { mode: 'self' } },
      copm: {},
    },
    data: { s2: { conclusion: { status: 'followup', title: '建议安排进一步专业评估' } } },
    ...over,
  };
}

describe('成人 ADHD 受評者端：/api/adhd/assessments', () => {
  let client: TestClient;
  beforeAll(async () => {
    client = await startTestApp(await loadApp());
  });
  afterAll(async () => {
    await client?.close();
  });
  beforeEach(() => {
    rows.length = 0;
  });

  it('未登入 401', async () => {
    expect((await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0001', payload: payload() })).status).toBe(401);
    expect((await client.get('/api/adhd/assessments')).status).toBe(401);
  });

  it('存一筆、讀歷次、讀那一筆', async () => {
    const res = await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0001', payload: payload() }, bearer(ME));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(rows[0].input).toMatchObject({
      pageVersion: ADHD_PAGE_VERSION,
      subjectName: '测试',
      conclusionStatus: 'followup',
      conclusionTitle: '建议安排进一步专业评估',
    });
    const list = await (await client.get('/api/adhd/assessments', bearer(ME))).json();
    expect(list.assessments).toHaveLength(1);
    const one = await client.get(`/api/adhd/assessments/${id}`, bearer(ME));
    expect(one.status).toBe(200);
    expect((await one.json()).payload.raw.s1).toEqual([3, 3, 2, 4, 3, 2]);
  });

  it('同一份個案再送一次是同一筆（回頭改答案）', async () => {
    await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0001', payload: payload() }, bearer(ME));
    await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0001', payload: payload() }, bearer(ME));
    expect(rows).toHaveLength(1);
    await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0002', payload: payload() }, bearer(ME));
    expect(rows).toHaveLength(2);
  });

  it('別人的那一筆 404', async () => {
    const { id } = await (await client.postJson('/api/adhd/assessments', { clientCaseId: 'case-0001', payload: payload() }, bearer(ME))).json();
    expect((await client.get(`/api/adhd/assessments/${id}`, bearer(OTHER))).status).toBe(404);
    expect((await client.get('/api/adhd/assessments/abc', bearer(ME))).status).toBe(404);
  });

  it.each([
    ['clientCaseId 太短', { clientCaseId: 'x', payload: payload() }],
    ['system 不對', { clientCaseId: 'case-0001', payload: payload({ system: 'OTHER' }) }],
    ['六題少一題', { clientCaseId: 'case-0001', payload: payload({ raw: { ...payload().raw, s1: [1, 1, 1, 1, 1] } }) }],
    ['值域外', { clientCaseId: 'case-0001', payload: payload({ raw: { ...payload().raw, a18: Array(18).fill(5) } }) }],
    ['OBS 值域外（0–3）', { clientCaseId: 'case-0001', payload: payload({ raw: { ...payload().raw, obs: { ans: Array(30).fill(4) } } }) }],
    ['還沒答齊的結論不存', { clientCaseId: 'case-0001', payload: payload({ data: { s2: { conclusion: { status: 'incomplete', title: 'x' } } } }) }],
    ['沒有姓名', { clientCaseId: 'case-0001', payload: payload({ basics: { name: '  ' } }) }],
  ])('%s → 400、不落表', async (_name, body) => {
    const res = await client.postJson('/api/adhd/assessments', body, bearer(ME));
    expect(res.status).toBe(400);
    expect(rows).toHaveLength(0);
  });
});
