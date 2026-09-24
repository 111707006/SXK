import { describe, it, expect } from 'vitest';
import { MODULE_TITLES } from '../src/t2/activitySeed';
import {
  CHECKIN,
  MODULE_TITLES_SC,
  REMINDER_SHEET,
  ageReminder,
  ageText,
  checkinSub,
  clipLoopLabel,
  detailHeadline,
  libraryReason,
  reminderLabel,
  splitMinutes,
  stepOf,
} from '../src/t2/trainingCopy';
import type { ModuleNo } from '../src/t2/types';

/**
 * 活動詳情、播放器、打卡成功與抽屜的字（Keep 規格 §3.3–§3.6、§3.8，票 B7）。
 * 票 6 那幾頁的字在 `trainingCopy.test.ts`；禁字掃描在 `parentWording.structure.test.ts`。
 */

/**
 * `MODULE_TITLES` 裡出現的繁體字 → 簡體（逐字對照，只列這 15 個名稱用得到的）。
 * 這張表是這支測試自己的真相來源：它不從 `MODULE_TITLES_SC` 推，推出來的就等於拿程式驗程式。
 */
const T2S: Record<string, string> = {
  體: '体', 動: '动', 與: '与', 協: '协', 調: '调', 氣: '气', 來: '来', 畫: '画', 寫: '写',
  聽: '听', 應: '应', 詞: '词', 彙: '汇', 說: '说', 認: '认', 識: '识', 緒: '绪', 麼: '么',
  辦: '办', 專: '专', 憶: '忆', 決: '决', 題: '题', 腦: '脑', 記: '记', 話: '话', 問: '问',
};

describe('模組名（詳情標題「{標題} · {模組名} · {亲子}」）', () => {
  it('15 個模組都有簡體名，逐字對得上 activitySeed 的繁體 MODULE_TITLES', () => {
    const numbers = Object.keys(MODULE_TITLES).map(Number).sort((a, b) => a - b);
    expect(Object.keys(MODULE_TITLES_SC).map(Number).sort((a, b) => a - b)).toEqual(numbers);
    expect(numbers).toHaveLength(15);
    for (const n of numbers as ModuleNo[]) {
      const expected = [...MODULE_TITLES[n]].map(ch => T2S[ch] ?? ch).join('');
      expect(MODULE_TITLES_SC[n], `模組 ${n}`).toBe(expected);
    }
  });

  it('簡體名裡不剩任何一個上面那張表的繁體字', () => {
    const traditional = new Set(Object.keys(T2S));
    for (const name of Object.values(MODULE_TITLES_SC)) {
      expect([...name].filter(ch => traditional.has(ch)), name).toEqual([]);
    }
  });

  it('模組一是「身体动一动」（與客戶腳本的檔名《…模组一_身体动一动》同一個字）', () => {
    expect(MODULE_TITLES_SC[1]).toBe('身体动一动');
  });
});

describe('詳情標題', () => {
  it('「{標題} · {模組名} · {亲子}」', () => {
    expect(detailHeadline({ title: '我们来爬行', moduleNo: 1, people: '亲子' })).toBe('我们来爬行 · 身体动一动 · 亲子');
  });

  it('手冊沒填人物配置時不留空的一段', () => {
    expect(detailHeadline({ title: '我们来爬行', moduleNo: 1, people: '' })).toBe('我们来爬行 · 身体动一动');
  });
});

describe('孩子現在幾個月怎麼寫', () => {
  it('未滿一歲寫月、整歲寫歲、其餘歲加月', () => {
    expect(ageText(8)).toBe('8 个月');
    expect(ageText(36)).toBe('3 岁');
    expect(ageText(18)).toBe('1 岁 6 个月');
  });
});

describe('年齡提醒（§3.3）', () => {
  it('有示範片：「适合 {适龄}；{孩子名}现在 {月龄}，先看看示范片就好」', () => {
    expect(ageReminder('2–4岁', '小宝', 18, true)).toBe('适合 2–4岁；小宝现在 1 岁 6 个月，先看看示范片就好。');
  });

  it('沒有示範片：不叫家長去看一支不存在的片', () => {
    expect(ageReminder('2–4岁', '小宝', 18, false)).toBe('适合 2–4岁；小宝现在 1 岁 6 个月，先看看怎么玩就好。');
  });

  it('沒有名字就是「孩子」', () => {
    expect(ageReminder('2–4岁', undefined, 18, true)).toContain('孩子现在 1 岁 6 个月');
  });
});

describe('片庫裡的一支為什麼可以選（「什么时候选它」）', () => {
  it('適合現在的月齡', () => {
    expect(libraryReason('fits', '6个月–3岁', '小宝', 18)).toBe('这一个不在这周的计划里，也适合小宝现在的月龄，想换着玩可以选它。');
  });

  it('還不到那個年齡', () => {
    expect(libraryReason('tooYoung', '3–6岁', '小宝', 18)).toBe('这一个适合 3–6岁，小宝现在 1 岁 6 个月，还不到这个年龄——先看看示范片，到了再练。');
  });

  it('不知道月齡、或比適齡大：只說不在計劃裡、想換著玩可以選', () => {
    expect(libraryReason('unknown', '3–6岁', '小宝', null)).toBe('这一个不在这周的计划里，想换着玩可以选它。');
    expect(libraryReason('tooOld', '6个月–1岁', '小宝', 30)).toBe('这一个不在这周的计划里，想换着玩可以选它。');
  });
});

describe('播放器與打卡成功', () => {
  it('「第 i 步 · 共 n 步」', () => {
    expect(stepOf(1, 4)).toBe('第 1 步 · 共 4 步');
  });

  it('左上角「示范片 0:10 · 循环播放」；不知道長度就不寫長度', () => {
    expect(clipLoopLabel('0:10')).toBe('示范片 0:10 · 循环播放');
    expect(clipLoopLabel('')).toBe('示范片 · 循环播放');
  });

  it('打卡成功的副標「{活動名} · 第 N 次」', () => {
    expect(checkinSub('我们来爬行', 3)).toBe('我们来爬行 · 第 3 次');
  });

  it('說明句是「都是选填，会记在打卡日历里」（不是樣品那句「下周安排活动时会参考」：配對不看心情）', () => {
    expect(CHECKIN.optional).toBe('都是选填，会记在打卡日历里');
    expect(JSON.stringify(CHECKIN)).not.toContain('参考');
  });
});

describe('加到日曆（§3.8）', () => {
  it('提醒是手機日曆發的：「加到手机日历，到时间手机会提醒你」，不是「到时间提醒你」', () => {
    expect(REMINDER_SHEET.sub).toContain('加到手机日历，到时间手机会提醒你');
    expect(REMINDER_SHEET.sub).not.toMatch(/[，。]到时间提醒你/);
  });

  it('「每周一、三、五 19:30」', () => {
    expect(reminderLabel([0, 2, 4], '19:30')).toBe('每周一、三、五 19:30');
    expect(reminderLabel([6], '08:30')).toBe('每周日 08:30');
  });

  it('微信裡要先在瀏覽器打開', () => {
    expect(REMINDER_SHEET.wechat).toContain('在浏览器打开');
  });
});

describe('數字列的片長（腳本的「2–3 分钟」拆成大字與單位）', () => {
  it('結尾是「分钟」：數字放大、單位另外排', () => {
    expect(splitMinutes('2–3 分钟')).toEqual({ big: '2–3', unit: '分钟' });
    expect(splitMinutes('3分钟')).toEqual({ big: '3', unit: '分钟' });
  });

  it('不是這種寫法：整段原文照放，不硬拆', () => {
    expect(splitMinutes('约两分钟左右')).toEqual({ big: '约两分钟左右', unit: '' });
  });
});
