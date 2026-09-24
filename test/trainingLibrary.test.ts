import { describe, it, expect } from 'vitest';
import { filterLibrary, fitsNow, groupByModule, libraryMark } from '../src/components/training/libraryData';
import type { LibraryEntry } from '../src/t2/libraryRoutes';
import type { WeeklyPlanResponse } from '../src/components/training/trainingData';
import { NO_ACTIVITY_CONTENT } from '../src/t2/activitySeed';
import type { Activity } from '../src/t2/types';

/**
 * 示範片庫（Keep 規格 §3.9）的資料整形。純函式，不碰 fetch、不碰 React。
 * 片庫本身（有示範片的啟用活動、依編號排）是伺服器挑的（`libraryEntries`，K09）；這裡只分組、篩選、標記。
 */

function entry(id: string, min: number, max: number, over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    title: `活动 ${id}`,
    moduleNo: 1,
    ageLabel: `${min}–${max}`,
    ageMonths: { min, max },
    posterUrl: null,
    videoSeconds: 10,
    ...over,
  };
}

function activity(id: string): Activity {
  return {
    id,
    title: `活动 ${id}`,
    moduleNo: 1,
    targetMonth: 18,
    ageMonths: { min: 12, max: 36 },
    dimensions: [],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
    ...NO_ACTIVITY_CONTENT,
  };
}

const LIB = [
  entry('A001', 6, 36),
  entry('A002', 12, 36),
  // 3 岁起：18 個月的孩子還沒到
  entry('A004', 36, 72),
  // 比孩子小的（6–12 個月）：既不是「适合现在」也不是「再大一点」
  entry('A021', 6, 12, { moduleNo: 2 }),
  entry('A022', 18, 18, { moduleNo: 2 }),
];

describe('篩選（§3.9）', () => {
  it('適合{孩子名}現在：適齡區間含孩子的實足月齡（頭尾都算）', () => {
    expect(fitsNow(entry('X', 18, 36), 18)).toBe(true);
    expect(fitsNow(entry('X', 6, 18), 18)).toBe(true);
    expect(fitsNow(entry('X', 19, 36), 18)).toBe(false);
    expect(filterLibrary(LIB, 'fit', 18).map(e => e.id)).toEqual(['A001', 'A002', 'A022']);
  });

  it('再大一點：適齡從孩子現在的月齡以後才開始的', () => {
    expect(filterLibrary(LIB, 'later', 18).map(e => e.id)).toEqual(['A004']);
  });

  it('全部：一支都不少，照伺服器的順序', () => {
    expect(filterLibrary(LIB, 'all', 18).map(e => e.id)).toEqual(['A001', 'A002', 'A004', 'A021', 'A022']);
  });
});

describe('依模組分組', () => {
  it('模組由小到大，組內照原本的順序；空的模組不出', () => {
    const groups = groupByModule([entry('A022', 1, 2, { moduleNo: 2 }), entry('A001', 1, 2), entry('A021', 1, 2, { moduleNo: 2 })]);
    expect(groups.map(g => [g.moduleNo, g.entries.map(e => e.id)])).toEqual([
      [1, ['A001']],
      [2, ['A022', 'A021']],
    ]);
    expect(groupByModule([])).toEqual([]);
  });
});

describe('本週／換著玩的標出來', () => {
  const plan = {
    activities: [{ activity: activity('A001'), dimension: 'MOT' }],
    alternates: { MOT: [activity('A002')] },
  } as unknown as WeeklyPlanResponse;

  it('本週的四支標「本周」，換著玩標「换着玩」，其他不標', () => {
    expect(libraryMark('A001', plan)).toBe('plan');
    expect(libraryMark('A002', plan)).toBe('swap');
    expect(libraryMark('A004', plan)).toBeNull();
  });

  it('沒有每週活動（讀不出來）或舊週次沒有換著玩：不標', () => {
    expect(libraryMark('A001', null)).toBeNull();
    expect(libraryMark('A002', { ...plan, alternates: undefined })).toBeNull();
  });
});
