import { describe, it, expect } from 'vitest';
import { activePassOn, coveredThrough, daysLeft, nextPassRange, PASS_DAYS, type TrainingPass } from '../src/t2/trainingPass';
import { grantTrainingPass, trainingPassState } from '../src/t2/trainingPassService';
import { calendarDateOf } from '../src/t2/weeks';

/**
 * 居家訓練使用權的規則（#91，`TRAINING_PLAN`）：有效、續接、過期再買、三種長度、跨月跨年、Asia/Shanghai 換日；
 * T2 附送一個月只發一次。
 */

const pass = (startsOn: string, endsOn: string, over: Partial<TrainingPass> = {}): TrainingPass => ({ startsOn, endsOn, months: 1, source: 'code', ...over });

describe('長度', () => {
  it('一個月 28 天、三個月 84 天（一期 12 週）、六個月 168 天（兩期）', () => {
    expect(PASS_DAYS).toEqual({ 1: 28, 3: 84, 6: 168 });
    expect(nextPassRange([], '2026-10-23', 1)).toEqual({ startsOn: '2026-10-23', endsOn: '2026-11-19' });
    expect(nextPassRange([], '2026-10-23', 3)).toEqual({ startsOn: '2026-10-23', endsOn: '2027-01-14' });
    expect(nextPassRange([], '2026-10-23', 6)).toEqual({ startsOn: '2026-10-23', endsOn: '2027-04-08' });
  });
});

describe('有效與續接', () => {
  const p1 = pass('2026-10-01', '2026-10-28');

  it('頭尾兩天都算有效，前一天與後一天不算', () => {
    expect(activePassOn([p1], '2026-10-01')).toBe(p1);
    expect(activePassOn([p1], '2026-10-28')).toBe(p1);
    expect(activePassOn([p1], '2026-09-30')).toBeNull();
    expect(activePassOn([p1], '2026-10-29')).toBeNull();
  });

  it('還在有效期內續買：接在迄日後面，不重疊', () => {
    expect(nextPassRange([p1], '2026-10-20', 1)).toEqual({ startsOn: '2026-10-29', endsOn: '2026-11-25' });
  });

  it('過期再買：從今天起', () => {
    expect(nextPassRange([p1], '2026-12-01', 1)).toEqual({ startsOn: '2026-12-01', endsOn: '2026-12-28' });
  });

  it('跨年', () => {
    expect(nextPassRange([pass('2026-12-10', '2027-01-06')], '2026-12-20', 1)).toEqual({ startsOn: '2027-01-07', endsOn: '2027-02-03' });
  });

  it('「到哪天」看接得上的最後一天；斷開的那一段不算', () => {
    const p2 = pass('2026-10-29', '2026-11-25');
    const later = pass('2027-01-01', '2027-01-28');
    expect(coveredThrough([p1, p2, later], '2026-10-15')).toBe('2026-11-25');
    expect(coveredThrough([p1], '2026-10-29')).toBeNull();
  });

  it('還剩幾天（含今天）', () => {
    expect(daysLeft('2026-10-28', '2026-10-28')).toBe(1);
    expect(daysLeft('2026-10-01', '2026-10-28')).toBe(28);
  });

  it('今天是 Asia/Shanghai 的日曆日：UTC 16:00 已經是隔天', () => {
    expect(calendarDateOf(new Date('2026-10-28T15:59:59Z'))).toBe('2026-10-28');
    expect(calendarDateOf(new Date('2026-10-28T16:00:00Z'))).toBe('2026-10-29');
  });
});

describe('附送一個月與加一段', () => {
  function memory(hasT2: boolean) {
    const rows: Array<TrainingPass & { uniqueKey: string | null }> = [];
    return {
      rows,
      deps: {
        list: async () => rows.map(({ uniqueKey: _k, ...p }) => p),
        insert: async (_u: number, p: TrainingPass & { refId: number | null; uniqueKey: string | null }) => {
          if (p.uniqueKey && rows.some(r => r.uniqueKey === p.uniqueKey)) return false;
          rows.push({ startsOn: p.startsOn, endsOn: p.endsOn, months: p.months, source: p.source, uniqueKey: p.uniqueKey });
          return true;
        },
        hasScaleT2Report: async () => hasT2,
      },
    };
  }

  it('有 T2 報告：第一次查發一個月，之後不再發', async () => {
    const m = memory(true);
    expect(await trainingPassState(m.deps, 1, '2026-10-23')).toEqual({ active: true, endsOn: '2026-11-19', lastEndsOn: '2026-11-19' });
    await trainingPassState(m.deps, 1, '2026-10-24');
    expect(m.rows.filter(r => r.source === 't2_bonus')).toHaveLength(1);
  });

  it('沒有 T2 報告：不發', async () => {
    const m = memory(false);
    expect(await trainingPassState(m.deps, 1, '2026-10-23')).toEqual({ active: false, endsOn: null, lastEndsOn: null });
  });

  it('附送接在既有的使用權後面', async () => {
    const m = memory(true);
    await grantTrainingPass(m.deps, 1, '2026-10-23', { months: 3, source: 'code', refId: 5, uniqueKey: 'code:5' });
    const state = await trainingPassState(m.deps, 1, '2026-10-23');
    expect(state.endsOn).toBe('2027-02-11'); // 84 天到 2027-01-14，再接 28 天
  });

  it('同一件事（同一組碼）只發一段', async () => {
    const m = memory(false);
    expect(await grantTrainingPass(m.deps, 1, '2026-10-23', { months: 1, source: 'code', refId: 5, uniqueKey: 'code:5' })).toBe(true);
    expect(await grantTrainingPass(m.deps, 1, '2026-10-23', { months: 1, source: 'code', refId: 5, uniqueKey: 'code:5' })).toBe(false);
    expect(m.rows).toHaveLength(1);
  });

  it('到期之後 lastEndsOn 還在（畫「已经到期」）', async () => {
    const m = memory(false);
    await grantTrainingPass(m.deps, 1, '2026-10-01', { months: 1, source: 'code', refId: 1, uniqueKey: null });
    expect(await trainingPassState(m.deps, 1, '2026-11-30')).toEqual({ active: false, endsOn: null, lastEndsOn: '2026-10-28' });
  });
});
