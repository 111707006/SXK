import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckinScreen from '../src/components/training/CheckinScreen';
import DetailScreen from '../src/components/training/DetailScreen';
import { ActionsSheet, EquipSheet } from '../src/components/training/DetailSheets';
import PlayerScreen from '../src/components/training/PlayerScreen';
import ReminderSheet from '../src/components/training/ReminderSheet';
import { TrainingProvider, type TrainingContextValue } from '../src/components/training/TrainingContext';
import type { WeeklyPlanResponse } from '../src/components/training/trainingData';
import type { TrainingData } from '../src/components/training/useTrainingData';
import { ACTIVITY_CONTENT } from '../src/t2/activityContent';
import { parseAgeRange } from '../src/t2/activitySeed';
import { weekPractice } from '../src/t2/practiceStats';
import type { Checkin, PracticePrefs } from '../src/t2/practice';
import type { Activity, DimensionCode, ModuleNo } from '../src/t2/types';
import { t2FindingsFixture } from './helpers/t2Fixtures';

/**
 * 票 7 的畫面在「第一次畫出來」那一刻長什麼樣（react-dom/server；專案沒有 jsdom，點擊與影片播放要在
 * 純 vite harness 與實機上看）。這裡釘的是驗收裡看得見的那幾條：
 * - §3.3：只有模組一（有腳本）出開場白、原理、孩子卡住了怎麼辦、大人常做錯的三件事、邊做邊說；
 *   其餘 280 支那幾區整個不出。
 * - 年齡提醒：孩子還不到適齡時出，區間內、比適齡大時不出（見 `ageFit`）。
 * - 沒有示範片：大圖是「示范片制作中」、GO 是「看图文步骤」、播放器是圖文模式。
 * - §3.6：打卡成功的兩個數字、七天格；打卡讀不出來時不出數字。
 *
 * 活動內容用客戶手冊與腳本的原文（`ACTIVITY_CONTENT`），不自己編一份。
 */

function fromContent(id: string, over: Partial<Activity> = {}): Activity {
  const c = ACTIVITY_CONTENT.find(x => x.id === id);
  if (!c) throw new Error(id);
  return {
    id,
    title: c.title,
    moduleNo: Math.ceil(Number(id.slice(1)) / 20) as ModuleNo,
    targetMonth: 24,
    ageMonths: parseAgeRange(c.ageLabel),
    ageLabel: c.ageLabel,
    people: c.people,
    dimensions: ['MOT'],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    need: c.need,
    trains: c.trains,
    steps: c.steps.map(instruction => ({ instruction, imageUrl: null })),
    easier: c.easier,
    harder: c.harder,
    tip: c.tip,
    deeper: c.deeper,
    guide: c.guide,
    videoUrl: null,
    posterUrl: null,
    videoSeconds: null,
    active: true,
    ...over,
  };
}

/** A001（模組一，有腳本、有片）、A041（模組三，沒有腳本、沒有片）、A019（有片）。 */
const A001 = fromContent('A001', { videoUrl: '/media/activities/A001.mp4', videoSeconds: 10 });
const A041 = fromContent('A041');

function pick(activity: Activity, dimension: DimensionCode) {
  return { activity, dimension, reason: { band: 'watch' as const, window: { lo: 12, hi: 30 }, matchedTags: [], belowWindow: false } };
}

function planWith(ageMonth: number): WeeklyPlanResponse {
  return {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    createdAt: '2026-09-21T02:00:00.000Z',
    findingsId: 7,
    ageMonth,
    ageKey: '12-36',
    reportAgeMonth: ageMonth,
    activities: [pick(A001, 'MOT'), pick(A041, 'MOT'), pick(fromContent('A141'), 'LANG'), pick(fromContent('A121'), 'SOC')],
    preparing: [],
    alternates: { MOT: [fromContent('A019', { videoUrl: '/media/activities/A019.mp4' })] },
  };
}

let seq = 100;
const checkin = (activityId: string, checkinDate: string, id = ++seq): Checkin => ({
  id,
  activityId,
  findingsId: 7,
  checkinDate,
  weekStart: '2026-09-21',
  mood: null,
  progress: [],
  createdAt: null,
});

function render(
  element: ReactElement,
  opts: { ageMonth?: number; checkins?: Checkin[] | null; prefs?: PracticePrefs | null; prefsStatus?: TrainingData['prefsStatus'] } = {},
): string {
  const plan = planWith(opts.ageMonth ?? 18);
  const checkins = opts.checkins === undefined ? [] : opts.checkins;
  const noop = () => {};
  const data: TrainingData = {
    status: 'ready',
    plan,
    checkins,
    today: '2026-09-23',
    practice: checkins ? weekPractice(checkins, plan.weekStart, plan.activities.map(p => p.activity.id)) : null,
    prefs: opts.prefs ?? null,
    prefsStatus: opts.prefsStatus ?? 'idle',
    loadPrefs: noop,
    savePrefs: async () => {},
    refresh: async () => {},
    reloadCheckins: async () => {},
  };
  const value: TrainingContextValue = {
    data,
    nav: { openPage: noop, openSheet: noop, replacePage: noop, back: noop, popTo: noop, returnToPage: noop },
    findings: t2FindingsFixture({ MOT: { band: 'watch' } }),
    childName: '小宝',
    onBookService: noop,
  };
  return renderToStaticMarkup(createElement(TrainingProvider, { value }, element));
}

const detail = (id: string, opts?: Parameters<typeof render>[1]) =>
  render(createElement(DetailScreen, { id, from: 'plan', active: true }), opts);

describe('詳情：腳本那幾區只有模組一有（§3.3 最後一句）', () => {
  const guide = A001.guide!;
  const withGuide = detail('A001');
  const without = detail('A041');

  it('A001 有腳本：開場白、原理（先三條＋展開全部）、卡住了怎麼辦、常做錯的三件事、「含边做边说」', () => {
    expect(withGuide).toContain(guide.intro);
    expect(withGuide).toContain('data-testid="detail-principles"');
    expect(withGuide).toContain(guide.principles[0]);
    expect(withGuide).not.toContain(guide.principles[3]);
    expect(withGuide).toContain(`展开全部 ${guide.principles.length} 条`);
    expect(withGuide).toContain('data-testid="detail-reactions"');
    expect(withGuide).toContain(`如果${guide.reactions[0].if}`);
    expect(withGuide).toContain('data-testid="detail-mistakes"');
    expect(withGuide).toContain('看动作列表（含边做边说）');
    // 太难或太简单：有腳本用腳本的降階／升階
    expect(withGuide).toContain(guide.down);
  });

  it('A041 沒有腳本：那幾區整個不出（不是空的標題），降一階／升一階用手冊的「简单／难一点」', () => {
    expect(without).not.toContain('data-testid="detail-principles"');
    expect(without).not.toContain('data-testid="detail-reactions"');
    expect(without).not.toContain('data-testid="detail-mistakes"');
    expect(without).not.toContain('孩子卡住了怎么办');
    expect(without).not.toContain('大人最常做错的三件事');
    expect(without).not.toContain('含边做边说');
    expect(without).toContain(A041.easier);
    expect(without).toContain(A041.harder);
  });

  it('兩支都有：標題「{標題} · {模組名} · {亲子}」、練什麼、步驟（有幾則列幾則）、小提醒、出處森心康', () => {
    expect(withGuide).toContain('我们来爬行 · 身体动一动 · 亲子');
    expect(without).toContain(`${A041.title} · 力气与耐力 · 亲子`);
    for (const html of [withGuide, without]) expect(html).toContain('森心康');
    expect(without).toContain(A041.trains);
    for (const s of A041.steps) expect(without).toContain(s.instruction);
    expect(without).toContain(A041.tip);
    expect(withGuide).not.toContain('星晨');
  });

  it('本週四支：「为什么这周排这一个」是配對的理由句；「为什么练大运动」', () => {
    expect(withGuide).toContain('为什么这周排这一个：');
    expect(withGuide).toContain('所以这周安排这一支来练');
    expect(withGuide).toContain('为什么练');
  });
});

describe('詳情：大圖與播放方式', () => {
  it('有示範片：靜音循環的 video（三種 playsinline、preload=metadata），第一次畫出來時還沒給 src', () => {
    const html = detail('A001');
    expect(html).toMatch(/<video[^>]*playsinline=""[^>]*>/i);
    expect(html).toMatch(/<video[^>]*webkit-playsinline="true"/);
    expect(html).toMatch(/<video[^>]*x5-playsinline="true"/);
    expect(html).toMatch(/<video[^>]*preload="metadata"/);
    expect(html).not.toMatch(/<video[^>]*src=/);
    expect(html).toContain('跟着示范做');
    expect(html).not.toContain('示范片制作中');
  });

  it('沒有示範片：「示范片制作中」、GO 是「看图文步骤」、沒有 video', () => {
    const html = detail('A041');
    expect(html).toContain('示范片制作中');
    expect(html).toContain('看图文步骤');
    expect(html).not.toContain('<video');
  });
});

describe('詳情：年齡提醒', () => {
  it('孩子還不到適齡（A041 是 2–8 岁，孩子 18 个月）→ 出提醒；沒有片時不叫家長去看片', () => {
    const html = detail('A041', { ageMonth: 18 });
    expect(html).toContain('data-testid="detail-age-reminder"');
    expect(html).toContain('适合 2–8岁；小宝现在 1 岁 6 个月，先看看怎么玩就好。');
  });

  it('有片的那一支還不到適齡 → 「先看看示范片就好」', () => {
    const html = detail('A001', { ageMonth: 4 });
    expect(html).toContain('适合 6个月–3岁；小宝现在 4 个月，先看看示范片就好。');
  });

  it('區間內 → 不出', () => {
    expect(detail('A041', { ageMonth: 30 })).not.toContain('data-testid="detail-age-reminder"');
  });

  it('比適齡大（配對往前取的那種）→ 不出', () => {
    expect(detail('A001', { ageMonth: 48 })).not.toContain('data-testid="detail-age-reminder"');
  });
});

describe('詳情：系列列與已練次數', () => {
  it('從計劃點進來：「计划 · 小宝的家庭活动计划 · 本周」與 1/4', () => {
    const html = detail('A001');
    expect(html).toContain('data-testid="detail-series"');
    expect(html).toContain('小宝的家庭活动计划 · 本周');
    expect(html).toContain('>1/4<');
  });

  it('本周已练 N 次；打卡讀不出來時不寫數字', () => {
    expect(detail('A001', { checkins: [checkin('A001', '2026-09-22'), checkin('A001', '2026-09-23')] })).toContain('本周已练 2 次');
    const unknown = detail('A001', { checkins: null });
    expect(unknown).not.toContain('本周已练');
    expect(unknown).toContain('做完就打卡');
  });
});

describe('按 GO 之後', () => {
  it('有片、選了看片 → 樣式 A：video 三種 playsinline、「示范片 0:10 · 循环播放」、第 1 步、边做边说', () => {
    const html = render(createElement(PlayerScreen, { id: 'A001', from: 'plan', mode: 'video' }));
    expect(html).toContain('data-testid="training-player"');
    expect(html).toMatch(/<video[^>]*x5-playsinline="true"/);
    expect(html).toContain('示范片 0:10 · 循环播放');
    expect(html).toContain('第 1 步 · 共 4 步');
    expect(html).toContain(A001.steps[0].instruction);
    expect(html).toContain('data-testid="player-say"');
    expect(html).toContain(A001.guide!.shots[0].say);
  });

  it('有片但選了只看圖文 → 圖文模式，不多說「还没有示范片」', () => {
    const html = render(createElement(PlayerScreen, { id: 'A001', from: 'plan', mode: 'pictures' }));
    expect(html).toContain('data-testid="training-pictures"');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('这一个还没有示范片');
  });

  it('沒有片 → 圖文模式，多一句「示范片做好后，按 GO 会改成看片跟着做」', () => {
    const html = render(createElement(PlayerScreen, { id: 'A041', from: 'plan', mode: 'video' }));
    expect(html).toContain('data-testid="training-pictures"');
    expect(html).toContain('这一个还没有示范片；示范片做好后，按 GO 会改成看片跟着做。');
  });
});

describe('打卡成功（§3.6）', () => {
  const screen = (id: string) => createElement(CheckinScreen, { id, checkinId: 999, times: 3, date: '2026-09-23' });

  it('「{活動名} · 第 N 次」、本週打卡次數、x/4、七天格', () => {
    const html = render(screen('A001'), { checkins: [checkin('A041', '2026-09-21'), checkin('A019', '2026-09-22')] });
    expect(html).toContain('打卡成功');
    expect(html).toContain('我们来爬行 · 第 3 次');
    expect(html).toContain('data-testid="checkin-numbers"');
    // 本週 3 次（含剛打的）；計劃裡練過 A041、A001 → 2/4（A019 是換著玩，不算）
    expect(html).toMatch(/>3<\/p><p[^>]*>本周打卡次数</);
    expect(html).toContain('>2/4<');
    expect(html).toContain('data-day="2026-09-21" data-done="true"');
    expect(html).toContain('data-day="2026-09-23" data-done="true"');
    expect(html).toContain('data-day="2026-09-24"');
    expect(html).not.toContain('data-day="2026-09-24" data-done');
  });

  it('心情三選一；有腳本時列三條進步；說明句「都是选填，会记在打卡日历里」', () => {
    const html = render(screen('A001'));
    for (const m of ['很投入', '还可以', '不太想玩']) expect(html).toContain(m);
    expect(html).toContain('data-testid="checkin-progress"');
    for (const p of A001.guide!.progress) expect(html).toContain(p);
    expect(html).toContain('都是选填，会记在打卡日历里');
    expect(html).not.toContain('下周安排活动时会参考');
    expect(html).toContain('看打卡日历');
    expect(html).toContain('回到计划');
  });

  it('沒有腳本的活動不列進步', () => {
    expect(render(screen('A041'))).not.toContain('data-testid="checkin-progress"');
  });

  it('打卡讀不出來 → 兩個數字與七天格不出（不寫 0）', () => {
    const html = render(screen('A001'), { checkins: null });
    expect(html).not.toContain('data-testid="checkin-numbers"');
    expect(html).not.toContain('本周打卡次数');
  });
});

describe('抽屜', () => {
  it('動作列表：n 个步骤、片長、說明句、步驟時間軸；有腳本時加「边做边说」', () => {
    const html = render(createElement(ActionsSheet, { id: 'A001', from: 'plan' }));
    expect(html).toContain('data-testid="sheet-actions"');
    expect(html).toContain('个步骤');
    expect(html).toContain('0:10');
    expect(html).toContain('按 GO 之后示范片循环播放，步骤一步一步往下看；做完就打卡。');
    expect(html).toContain('data-testid="sheet-actions-say"');
    expect(html).toContain('GO · 开始跟着做');
  });

  it('動作列表（沒有片、沒有腳本）：「先照图文一步一步做」，沒有边做边说', () => {
    const html = render(createElement(ActionsSheet, { id: 'A041', from: 'plan' }));
    expect(html).toContain('先照图文一步一步做');
    expect(html).not.toContain('data-testid="sheet-actions-say"');
    expect(html).toContain(A041.easier);
  });

  it('要準備：手冊「需要什么」；有腳本時加场地／器材／安全检查／大人位置', () => {
    const withGuide = render(createElement(EquipSheet, { id: 'A001' }));
    expect(withGuide).toContain(A001.need);
    for (const key of ['场地', '器材', '安全检查', '大人位置']) expect(withGuide).toContain(key);
    const without = render(createElement(EquipSheet, { id: 'A041' }));
    expect(without).toContain(A041.need);
    expect(without).not.toContain('安全检查');
  });
});

describe('加到日曆抽屜：伺服器上存的提醒還不知道時，不讓預設值蓋掉它', () => {
  const sheet = () => createElement(ReminderSheet);
  /** 兩顆按鈕（加到打卡日历、也加到手机日历）各自是不是 disabled。 */
  const buttons = (html: string) =>
    html
      .split('<button')
      .slice(1)
      .map(chunk => chunk.slice(0, chunk.indexOf('</button>')))
      .map(chunk => ({ label: /加到打卡日历|也加到手机日历/.exec(chunk)?.[0], disabled: chunk.slice(0, chunk.indexOf('>')).includes('disabled=""') }))
      .filter((b): b is { label: string; disabled: boolean } => b.label !== undefined);

  it('讀取中：畫面上的一、三、五 19:30 只是預設，兩顆按鈕都不能按，說「正在读取」', () => {
    const html = render(sheet(), { prefsStatus: 'loading' });
    expect(html).toContain('正在读取已经设好的提醒');
    expect(buttons(html)).toEqual([
      { label: '加到打卡日历', disabled: true },
      { label: '也加到手机日历', disabled: true },
    ]);
  });

  it('讀不出來：說「暂时读不到」，家長自己選過才能按（這裡還沒選 → 不能按）', () => {
    const html = render(sheet(), { prefsStatus: 'error' });
    expect(html).toContain('暂时读不到已经设好的提醒');
    expect(buttons(html).every(b => b.disabled)).toBe(true);
  });

  it('讀到了：照存的顯示（二、四 20:30），兩顆都能按', () => {
    const html = render(sheet(), { prefsStatus: 'ready', prefs: { reminderDays: [1, 3], reminderTime: '20:30' } });
    expect(html).not.toContain('data-testid="reminder-stored-unknown"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>二</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>四</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>一</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>20:30</);
    expect(buttons(html).every(b => !b.disabled)).toBe(true);
  });

  it('說法是「加到手机日历，到时间手机会提醒你」', () => {
    expect(render(sheet(), { prefsStatus: 'ready' })).toContain('加到手机日历，到时间手机会提醒你');
  });
});
