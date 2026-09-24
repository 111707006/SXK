import { describe, it, expect } from 'vitest';
import {
  CALENDAR,
  LIBRARY,
  activityNo,
  calendarMonthLabel,
  libraryChips,
  libraryFootnote,
  moduleHeading,
  progressSeen,
  reminderLine,
  unknownActivityTitle,
} from '../src/t2/trainingCopy';

/**
 * 打卡日曆與示範片庫的字（Keep 規格 §3.7、§3.9、K16）。句子在 `trainingCopy.ts` 檔尾那一區，畫面只 import。
 * 禁字掃描在 `test/parentWording.structure.test.ts`（整檔都掃）；這裡釘規格點名的那幾句與會算的那幾個。
 */

describe('提醒列（§3.7）', () => {
  it('設了提醒：「提醒：每周一、三、五 19:30」（0＝星期一）', () => {
    expect(reminderLine({ reminderDays: [0, 2, 4], reminderTime: '19:30' })).toBe('提醒：每周一、三、五 19:30');
    expect(reminderLine({ reminderDays: [5, 6], reminderTime: '08:30' })).toBe('提醒：每周六、日 08:30');
  });

  it('還沒設：「还没设提醒，设定每周哪几天练」', () => {
    expect(reminderLine({ reminderDays: [], reminderTime: null })).toBe('还没设提醒，设定每周哪几天练');
    expect(reminderLine(null)).toBe('还没设提醒，设定每周哪几天练');
  });
});

describe('打卡日曆的其他字', () => {
  it('月份標題', () => {
    expect(calendarMonthLabel('2026-09')).toBe('2026 年 9 月');
    expect(calendarMonthLabel('2027-01')).toBe('2027 年 1 月');
  });

  it('找不到活動（停用、讀不到）只寫編號：「活动 007」', () => {
    expect(unknownActivityTitle('A007')).toBe('活动 007');
  });

  it('「看到 N 项进步」', () => {
    expect(progressSeen(2)).toBe('看到 2 项进步');
  });

  it('三個數字的標題（x/4 與計劃頁底部同一句）', () => {
    expect(CALENDAR.stats).toEqual(['本月练了几天', '连续天数', '本周练过的活动']);
  });

  it('第 12 週末的圖例', () => {
    expect(CALENDAR.legend.reassess).toBe('第 12 周末再评估');
  });
});

describe('示範片庫（§3.9）', () => {
  it('底下那一句照規格', () => {
    expect(libraryFootnote('小宝')).toBe('年龄还没到的也可以先看片。每周排进计划的，只会是适合小宝现在月龄的活动。');
    expect(libraryFootnote(undefined)).toBe('年龄还没到的也可以先看片。每周排进计划的，只会是适合孩子现在月龄的活动。');
  });

  it('三個篩選帶數量：全部／适合{孩子名}现在／再大一点', () => {
    expect(libraryChips('小宝', { all: 17, fit: 7, later: 10 })).toEqual([
      { key: 'all', label: '全部 17' },
      { key: 'fit', label: '适合小宝现在 7' },
      { key: 'later', label: '再大一点 10' },
    ]);
  });

  it('編號寫手冊的三位數（A001 → 001）；認不得的照原樣', () => {
    expect(activityNo('A001')).toBe('001');
    expect(activityNo('A120')).toBe('120');
    expect(activityNo('X9')).toBe('X9');
  });

  it('本週／換著玩的標記', () => {
    expect(LIBRARY.markPlan).toBe('本周');
    expect(LIBRARY.markSwap).toBe('换着玩');
  });
});

describe('片庫的組標題（模組簡體名是票 7 的 MODULE_TITLES_SC，逐字對照在 test/trainingDetailCopy.test.ts）', () => {
  it('「模组一 · 身体动一动」，一到十五', () => {
    expect(moduleHeading(1)).toBe('模组一 · 身体动一动');
    expect(moduleHeading(10)).toBe('模组十 · 认识情绪');
    expect(moduleHeading(15)).toBe('模组十五 · 动脑与解决问题');
  });
});
