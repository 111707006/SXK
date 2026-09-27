import { describe, it, expect, beforeAll, vi } from 'vitest';

/**
 * 後台家長列表的一列怎麼從資料庫變成畫面上的那幾格 —— 分數那兩格（2026-09-27）。
 *
 * 用假的連線池：要驗的是 `completed_scores` 那一包 JSON 怎麼變成「被標記的維度＋各自得分」
 * 與「T1 總分」，不是 MySQL。HTTP 那一層（公司範圍）由 `adminIsolation.http.test.ts` 驗。
 */

let rows: unknown[] = [];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  getPool: () => ({
    execute: async () => [rows],
  }),
}));

let store: typeof import('../src/admin/adminStore');

beforeAll(async () => {
  store = await import('../src/admin/adminStore');
});

const score = (dimensionId: string, dimensionName: string, s: number, status: string, tierId = 'T1') => ({
  dimensionId,
  dimensionName,
  tierId,
  score: s,
  maxScore: 8,
  status,
  completedAt: '2026-09-20T01:00:00.000Z',
});

function row(completedScores: unknown) {
  return {
    id: 5,
    email: null,
    phone: '13800001234',
    company_id: 2,
    created_at: '2026-09-01T00:00:00.000Z',
    child: JSON.stringify({ name: '小安', gender: 'girl', ageMonth: 30 }),
    completed_scores: completedScores === null ? null : JSON.stringify(completedScores),
    screened_at: '2026-09-20T01:00:00.000Z',
    booking_count: 0,
  };
}

async function listOne() {
  const parents = await store.listParents({ kind: 'company', companyId: 2 }, { sort: 'newest', booked: 'all' });
  expect(parents).toHaveLength(1);
  return parents[0];
}

describe('家長列表的分數', () => {
  it('被標記的維度帶著各自的得分，總分加的是九格 T1', async () => {
    rows = [
      row([
        score('language', '语言沟通', 4, 'delay'),
        score('attention', '注意力与执行', 7, 'borderline'),
        ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => score(id, id, 8, 'normal')),
      ]),
    ];
    const p = await listOne();
    expect(p.flaggedDimensions).toEqual([
      { dimensionId: 'language', dimensionName: '语言沟通', status: 'delay', score: 4, maxScore: 8 },
      { dimensionId: 'attention', dimensionName: '注意力与执行', status: 'borderline', score: 7, maxScore: 8 },
    ]);
    expect(p.screeningTotal).toEqual({ score: 4 + 7 + 7 * 8, maxScore: 72 });
  });

  it('只有孩子資料、還沒做篩查的家長：總分是 null，不是 0 / 0', async () => {
    rows = [row(null)];
    const p = await listOne();
    expect(p.flaggedDimensions).toEqual([]);
    expect(p.screeningTotal).toBeNull();
  });

  it('壞掉的 JSON 當作沒做篩查，不讓整份列表讀不出來', async () => {
    rows = [{ ...row(null), completed_scores: '{not json' }];
    const p = await listOne();
    expect(p.screeningTotal).toBeNull();
  });
});
