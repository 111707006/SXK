import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';
import { bandScores } from './helpers/t1Scores';

/**
 * 「只有 T1」的快照（#92，`TRAINING_PLAN`）：有使用權、做過 T1、還沒有快照的家長，第一次要快照時產生一份（九個方面 T1 推定）；
 * 沒有使用權不產生；之後做了 T2，最新的一份就是 T2 的。
 */
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';

const PASS_PARENT = 1;
const NO_PASS_PARENT = 2;
const users: Record<number, { id: number; phone: string }> = { 1: { id: 1, phone: '13800000001' }, 2: { id: 2, phone: '13800000002' } };
const t1 = bandScores(30, dim => (dim === 'language' ? 0 : 2));
const userData: Record<number, any> = {
  1: { child: { name: '小树', ageMonth: 30, gender: 'girl' }, completedScores: t1 },
  2: { child: { name: '小草', ageMonth: 30, gender: 'boy' }, completedScores: t1 },
};

const db = vi.hoisted(() => ({ findings: [] as Array<{ userId: number; record: any }>, passes: [] as any[] }));

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => users[id] ?? null,
  hasT2Unlock: async () => false,
  listUnlockedDimensions: async () => [],
  getUserDataByUserId: async (id: number) => (userData[id] ? { user_id: id } : null),
  getUserDataByDevice: async () => null,
  parseUserDataRow: (row: any) => ({ ...userData[row.user_id], orders: [], reportHistory: [] }),
  saveUserData: async () => {},
  getPool: () => null,
}));

vi.mock('../src/db/t2Findings', () => ({
  insertFindings: async (userId: number, input: any) => {
    const id = db.findings.length + 1;
    db.findings.push({ userId, record: { id, createdAt: new Date().toISOString(), ...input } });
    return id;
  },
  latestFindings: async (userId: number) => {
    const mine = db.findings.filter(r => r.userId === userId);
    return mine.length === 0 ? null : mine[mine.length - 1].record;
  },
}));

vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async (userId: number) => db.passes.filter(p => p.userId === userId),
  insertTrainingPass: async () => true,
  hasScaleT2Findings: async () => false,
}));

let client: TestClient;
const shift = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

beforeEach(() => {
  db.findings = [];
  db.passes = [{ userId: PASS_PARENT, startsOn: shift(-1), endsOn: shift(26), months: 1, source: 'code' }];
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await client.close();
});

describe('只有 T1 的快照', () => {
  it('有使用權、做過 T1：第一次讀就產生一份，九個方面 T1 推定', async () => {
    const resp = await client.get('/api/t2/findings/latest', bearer(PASS_PARENT));
    expect(resp.status).toBe(200);
    const { findings } = await resp.json();
    expect(findings.toolkitVersion).toBe('t1-only-20261023');
    expect(findings.dimensions).toHaveLength(9);
    expect(findings.dimensions.every((d: any) => d.band === 'not_assessed')).toBe(true);
    expect(findings.dimensions.find((d: any) => d.dimensionId === 'LANG').t1Flag).toBe(2);
    expect(findings.child).toEqual({ assessedAgeMonth: 30, sex: 'girl' });
    // 再讀一次不再產生
    await client.get('/api/t2/findings/latest', bearer(PASS_PARENT));
    expect(db.findings).toHaveLength(1);
  });

  it('沒有使用權：不產生（還沒解鎖 T2 → 被 T2 閘門擋下）', async () => {
    const resp = await client.get('/api/t2/findings/latest', bearer(NO_PASS_PARENT));
    expect(resp.status).toBe(403);
    expect(db.findings).toHaveLength(0);
  });

  it('之後有了 T2 的快照：最新的就是 T2 的', async () => {
    await client.get('/api/t2/findings/latest', bearer(PASS_PARENT));
    db.findings.push({ userId: PASS_PARENT, record: { ...db.findings[0].record, id: 2, findings: { ...db.findings[0].record.findings, toolkitVersion: 'kit-20260908' } } });
    const { findings } = await (await client.get('/api/t2/findings/latest', bearer(PASS_PARENT))).json();
    expect(findings.toolkitVersion).toBe('kit-20260908');
  });
});
