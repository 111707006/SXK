import { describe, it, expect } from 'vitest';
import {
  CLIP_STATE,
  ENTRY,
  PLAN_PAGE,
  childLabel,
  planCardMeta,
  planGreeting,
  planTitle,
  planWeekLabel,
  practicedTimes,
  swapReason,
  weekAgeLine,
} from '../src/t2/trainingCopy';

/**
 * 家庭訓練新畫面的字（Keep 規格 §3.1、§3.2、§4.5、§7）。句子在這一檔，畫面只 import。
 * 禁字掃描在 `test/parentWording.structure.test.ts`；這裡釘規格點名的那幾句與會算的那幾個。
 */

describe('孩子怎麼稱呼', () => {
  it('有名字用名字，沒有就是「孩子」', () => {
    expect(childLabel('小宝')).toBe('小宝');
    expect(childLabel('  ')).toBe('孩子');
    expect(childLabel(undefined)).toBe('孩子');
  });
});

describe('計劃大卡（§3.1 第 3 項）', () => {
  it('標題是「{孩子名}的家庭活动计划」', () => {
    expect(planTitle('小宝')).toBe('小宝的家庭活动计划');
  });

  it('12 周计划 + 每周更新', () => {
    expect(ENTRY.planLead).toBe('12 周计划 + 每周更新');
    expect(ENTRY.planTags).toEqual(['定制', '本周', '按 T2 结果']);
  });

  it('共 12 周 · 本周 N 个活动 · 已练 N 次；打卡讀不出來就不寫「已练」', () => {
    expect(planCardMeta(4, 2)).toBe('共 12 周 · 本周 4 个活动 · 已练 2 次');
    expect(planCardMeta(3, null)).toBe('共 12 周 · 本周 3 个活动');
  });
});

describe('本週活動卡', () => {
  it('沒有示範片標「示范片制作中 · 先看图文」', () => {
    expect(CLIP_STATE.none).toBe('示范片制作中 · 先看图文');
  });

  it('本周已练 N 次（只在讀得到打卡時出現）', () => {
    expect(practicedTimes(0)).toBe('本周已练 0 次');
    expect(practicedTimes(3)).toBe('本周已练 3 次');
  });
});

describe('第幾週（§4.5）', () => {
  it('第 N 周 / 共 12 周', () => {
    expect(planWeekLabel({ weekIndex: 3, totalWeeks: 12, firstWeekStart: '2026-09-07' })).toBe('第 3 周 / 共 12 周');
    expect(planWeekLabel({ weekIndex: 12, totalWeeks: 12, firstWeekStart: '2026-07-06' })).toBe('第 12 周 / 共 12 周');
  });

  it('超過 12 週：「已满 12 周，建议再评估一次」', () => {
    expect(planWeekLabel({ weekIndex: 13, totalWeeks: 12, firstWeekStart: '2026-06-29' })).toBe('已满 12 周，建议再评估一次');
  });
});

describe('計劃頁的頭', () => {
  it('Hi，{稱呼} 已为{孩子名}生成', () => {
    expect(planGreeting('小宝')).toBe('Hi，小宝家长 已为小宝生成');
    expect(planGreeting(undefined)).toBe('Hi，家长 已为孩子生成');
  });

  it('樣品寫 4 週的地方全是 12 週', () => {
    const text = JSON.stringify(PLAN_PAGE);
    expect(text).not.toMatch(/(?<!1)4 ?周/);
    expect(text).toContain('12 周');
  });
});

describe('其餘句子', () => {
  it('配對用的月齡與年齡段；兩個月齡不同時接 AGE_SPLIT_NOTE', () => {
    expect(weekAgeLine(18, '1–3 岁', 18)).toBe('按孩子现在 18 个月、1–3 岁这一段安排。');
    expect(weekAgeLine(48, '3–6 岁', 47)).toBe(
      '按孩子现在 48 个月、3–6 岁这一段安排。这一周的活动按孩子现在的月龄安排；报告里的描述按答题那时候的月龄写（答题时 47 个月）。',
    );
    expect(weekAgeLine(18, '', 18)).toBe('按孩子现在 18 个月安排。');
  });

  it('換著玩的活動說它不在這週的計劃裡、練同一塊', () => {
    expect(swapReason('动作发展', '小宝')).toBe(
      '这一个不在这周的计划里：和本周的活动练同一块（动作发展），也适合小宝现在的月龄，玩腻了可以换它。',
    );
  });
});
