import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

/**
 * 線上家庭訓練頁的「上周 N 个活动」（簡報 11/03 第 25 頁）：讀上一週用 `peek=1`（不替沒開過的那一週補一列），
 * 打卡讀那一週七天；讀不到整組不畫。1022 的入口不畫維度膠囊與「换着玩」。
 */
const calls: string[] = [];
let responses: Record<string, { ok: boolean; body: unknown }> = {};

vi.mock('../src/utils/api', () => ({
  authFetch: async (url: string) => {
    calls.push(url);
    const hit = Object.entries(responses).find(([k]) => url.startsWith(k));
    const r = hit ? hit[1] : { ok: false, body: {} };
    return { ok: r.ok, json: async () => r.body };
  },
}));

const pick = (id: string) => ({ activity: { id, title: id }, dimension: 'MOT', reason: {} });

beforeEach(() => {
  calls.length = 0;
  responses = {};
});

describe('fetchLastWeek', () => {
  it('讀上一週（peek=1）與那一週的打卡，標出練過的', async () => {
    responses = {
      '/api/t2/weekly-plan?week=2026-10-26&peek=1': { ok: true, body: { activities: [pick('A001'), pick('A002')] } },
      '/api/t2/checkins?from=2026-10-26&to=2026-11-01': { ok: true, body: { checkins: [{ activityId: 'A002' }] } },
    };
    const { fetchLastWeek } = await import('../src/components/training/useLastWeek');
    const last = await fetchLastWeek('2026-11-02');
    expect(calls[0]).toBe('/api/t2/weekly-plan?week=2026-10-26&peek=1');
    expect(last?.picks.map(p => p.activity.id)).toEqual(['A001', 'A002']);
    expect([...(last?.practiced ?? [])]).toEqual(['A002']);
  });

  it('上一週沒有存過（404）→ null，不讀打卡', async () => {
    const { fetchLastWeek } = await import('../src/components/training/useLastWeek');
    expect(await fetchLastWeek('2026-11-02')).toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe('1022 的入口', () => {
  const src = readFileSync('src/components/training/LedoEntry.tsx', 'utf8');
  const entry = src.slice(src.indexOf('function Entry1103()'), src.indexOf('function LedoEntryV1()'));

  it('沒有維度膠囊與換著玩、副標是固定字、有常見問題與上週', () => {
    expect(entry).not.toContain('setChip');
    expect(entry).not.toContain('alternateRows');
    expect(entry).not.toContain('weekAgeLine');
    expect(entry).toContain('ENTRY_1103.subtitle');
    expect(entry).toContain('id="training-faq"');
    expect(entry).toContain('id="training-last-week"');
  });
});
