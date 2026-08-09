import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  birthDateToSelection,
  birthDateWindow,
  clampSelection,
  dayOptions,
  monthOptions,
  selectionToBirthDate,
  yearOptions,
} from '../src/utils/birthDateOptions';
import { calculateAgeMonth } from '../src/utils/dateUtils';
import { T1_AGE_RANGE } from '../src/t1Data';

/**
 * 出生日期的年／月／日選項。
 *
 * 這些判斷全部住在這裡而不在 JSX 裡，是因為專案沒有 jsdom —— 留在元件裡的
 * 分支一行都測不到。三個下拉本身只是把這裡算出來的陣列畫出來。
 */

/** 掃一段連續的日子，回傳每一天的實足月齡。 */
function ageOn(year: number, monthIndex: number, day: number, today: Date): number | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(year, monthIndex, day);
  return calculateAgeMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, today);
}

/** 涵蓋月底、閏日與平常日子的參考日期。月底是溢位 bug 唯一會現形的地方。 */
const REFERENCE_DAYS = [
  new Date(2026, 7, 9),   // 平常的一天
  new Date(2026, 0, 31),  // 1/31
  new Date(2026, 2, 31),  // 3/31
  new Date(2026, 4, 31),  // 5/31
  new Date(2028, 1, 29),  // 閏日
  new Date(2027, 1, 28),  // 平年的 2 月底
  new Date(2026, 11, 1),  // 月初
];

describe('可選的生日區間由適用範圍反推', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('區間兩端正好貼著適用範圍的兩端', () => {
    for (const today of REFERENCE_DAYS) {
      const { earliest, latest } = birthDateWindow(today);

      const earliestAge = ageOn(earliest.getFullYear(), earliest.getMonth(), earliest.getDate(), today);
      const latestAge = ageOn(latest.getFullYear(), latest.getMonth(), latest.getDate(), today);

      expect(earliestAge, `${today.toDateString()} 的最早一天`).toBe(T1_AGE_RANGE.maxMonths);
      expect(latestAge, `${today.toDateString()} 的最晚一天`).toBe(T1_AGE_RANGE.minMonths);
    }
  });

  it('再往外一天就掉出適用範圍 —— 區間不多也不少', () => {
    // 少算一天，一個實足月齡仍在範圍內的孩子就選不到自己的生日；
    // 多算一天，家長選得到一個存檔時才會被擋下的日期，正是這張票要取代的行為。
    for (const today of REFERENCE_DAYS) {
      const { earliest, latest } = birthDateWindow(today);

      const beforeEarliest = ageOn(earliest.getFullYear(), earliest.getMonth(), earliest.getDate() - 1, today);
      const afterLatest = ageOn(latest.getFullYear(), latest.getMonth(), latest.getDate() + 1, today);

      expect(beforeEarliest, `${today.toDateString()} 最早一天的前一天`).toBe(T1_AGE_RANGE.maxMonths + 1);
      expect(afterLatest, `${today.toDateString()} 最晚一天的隔天`).toBe(T1_AGE_RANGE.minMonths - 1);
    }
  });

  it('沒傳今天時用執行期的當下', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9));
    expect(selectionToBirthDate(birthDateToSelection(toIso(birthDateWindow(new Date()).latest)))).toBe('2025-08-09');
  });

  it('已存的生日已經超出適用範圍時，只多放行那一天', () => {
    // 孩子滿 15 歲之後檔案仍要能改（EditProfileModal 已有這條判斷）。
    // 存下來的那一天若選不到，家長光是改個名字就會把孩子的生日弄丟。
    //
    // 但只放行**那一天**。把區間的端點拉到它那裡，中間那一整段（這個例子是
    // 十四個月）就全部變成選得到卻存不進去 —— 正是這張票要取代的行為。
    const today = new Date(2026, 7, 9);
    const agedOut = '2010-05-03'; // 約 195 個月
    const plain = birthDateWindow(today);
    const widened = birthDateWindow(today, agedOut);

    expect(plain.allowed).toBeNull();
    expect(toIso(widened.earliest)).toBe(toIso(plain.earliest));
    expect(toIso(widened.latest)).toBe(toIso(plain.latest));
    expect(toIso(widened.allowed!)).toBe(agedOut);
  });

  it('已存的生日還在範圍內時不必額外放行', () => {
    const today = new Date(2026, 7, 9);
    expect(birthDateWindow(today, '2018-03-07').allowed).toBeNull();
  });

  it('讀不出來的已存生日不動到區間', () => {
    const today = new Date(2026, 7, 9);
    for (const bad of ['不是日期', '', '2018-02-30']) {
      const w = birthDateWindow(today, bad);
      expect(toIso(w.earliest)).toBe(toIso(birthDateWindow(today).earliest));
      expect(w.allowed).toBeNull();
    }
  });
});

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('選不到適用範圍外的日期', () => {
  /** 把三個下拉能組出來的每一天列出來。 */
  function everySelectableDate(w: ReturnType<typeof birthDateWindow>): string[] {
    const out: string[] = [];
    for (const year of yearOptions(w)) {
      for (const month of monthOptions(w, year)) {
        for (const day of dayOptions(w, year, month)) {
          out.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }
    }
    return out;
  }

  function outOfRange(dates: string[], today: Date): string[] {
    return dates.filter(iso => {
      const age = calculateAgeMonth(iso, today);
      return age === null || age < T1_AGE_RANGE.minMonths || age > T1_AGE_RANGE.maxMonths;
    });
  }

  it('每一個選得到的組合都落在適用範圍內', () => {
    // 這是這張票的核心：範圍外的日期不該存在於選項裡，而不是選完才跳錯誤訊息。
    const today = new Date(2026, 2, 31); // 月底，最容易露出溢位
    expect(outOfRange(everySelectableDate(birthDateWindow(today)), today)).toEqual([]);
  });

  it('已存的生日超出範圍時，選得到的範圍外日期就只有它一天', () => {
    // 只釘沒有 storedBirthDate 的那條路徑是不夠的：撐開區間的寫法在這條路徑上
    // 會多開出四百多個選得到卻存不進去的日子，而上面那條測試看不到它。
    const today = new Date(2026, 2, 31);
    for (const stored of ['2010-05-03', '2026-01-15']) { // 太老 / 太小
      const w = birthDateWindow(today, stored);
      expect(outOfRange(everySelectableDate(w), today), `已存 ${stored}`).toEqual([stored]);
    }
  });

  it('已存的那一天真的選得到', () => {
    const today = new Date(2026, 2, 31);
    const stored = '2010-05-03';
    expect(everySelectableDate(birthDateWindow(today, stored))).toContain(stored);
  });

  it('適用範圍內的每一天都選得到', () => {
    // 反過來也要成立，否則某些孩子的生日永遠選不出來，而畫面上看不出少了什麼。
    const today = new Date(2026, 2, 31);
    const w = birthDateWindow(today);
    const missing: string[] = [];

    const cursor = new Date(w.earliest);
    while (cursor <= w.latest) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      const day = cursor.getDate();
      const reachable =
        yearOptions(w).includes(year) &&
        monthOptions(w, year).includes(month) &&
        dayOptions(w, year, month).includes(day);
      if (!reachable) missing.push(toIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    expect(missing).toEqual([]);
  });

  it('年份選項就是區間涵蓋到的那幾年，由早到晚', () => {
    const today = new Date(2026, 7, 9);
    const w = birthDateWindow(today);
    const years = yearOptions(w);

    expect(years[0]).toBe(w.earliest.getFullYear());
    expect(years[years.length - 1]).toBe(w.latest.getFullYear());
    expect(years).toEqual([...years].sort((a, b) => a - b));
    // 12–180 個月 = 一年到十五歲，最多跨十六個年份
    expect(years.length).toBe(w.latest.getFullYear() - w.earliest.getFullYear() + 1);
  });
});

describe('月的選項依已選年份收邊', () => {
  const today = new Date(2026, 7, 9);
  const w = birthDateWindow(today); // 2011-07-10 ~ 2025-08-09

  it('中間的年份十二個月都在', () => {
    expect(monthOptions(w, 2018)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('最早的那一年從區間起點的月份起算', () => {
    expect(monthOptions(w, w.earliest.getFullYear())[0]).toBe(w.earliest.getMonth() + 1);
  });

  it('最晚的那一年到區間終點的月份為止', () => {
    const months = monthOptions(w, w.latest.getFullYear());
    expect(months[months.length - 1]).toBe(w.latest.getMonth() + 1);
  });

  it('還沒選年份時十二個月都能選 —— 此時沒有任何依據可以收邊', () => {
    expect(monthOptions(w, null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('日的選項依已選年月動態產生', () => {
  const today = new Date(2026, 7, 9);
  const w = birthDateWindow(today);

  it('閏年的二月有 29 天，平年只有 28 天', () => {
    expect(dayOptions(w, 2016, 2)).toHaveLength(29);
    expect(dayOptions(w, 2015, 2)).toHaveLength(28);
    // 百年不閏、四百年再閏：2000 落在區間外，這裡用區間內的年份確認一般規則
    expect(dayOptions(w, 2020, 2)).toHaveLength(29);
  });

  it('30 天與 31 天的月份分得開', () => {
    expect(dayOptions(w, 2018, 4)).toHaveLength(30);
    expect(dayOptions(w, 2018, 1)).toHaveLength(31);
    expect(dayOptions(w, 2018, 12)).toHaveLength(31);
  });

  it('區間起點所在的那個月從起點那一天算起', () => {
    const days = dayOptions(w, w.earliest.getFullYear(), w.earliest.getMonth() + 1);
    expect(days[0]).toBe(w.earliest.getDate());
  });

  it('區間終點所在的那個月到終點那一天為止', () => {
    const days = dayOptions(w, w.latest.getFullYear(), w.latest.getMonth() + 1);
    expect(days[days.length - 1]).toBe(w.latest.getDate());
  });

  it('年或月還沒選時給滿 31 天 —— 選完年月會再夾一次', () => {
    expect(dayOptions(w, null, null)).toHaveLength(31);
    expect(dayOptions(w, 2018, null)).toHaveLength(31);
    expect(dayOptions(w, null, 2)).toHaveLength(31);
  });
});

describe('對齊：換了年或月之後，原本選的值不會變成一個錯的日子', () => {
  const today = new Date(2026, 7, 9);
  const w = birthDateWindow(today); // 2011-07-10 ~ 2025-08-09

  it('1 月 31 日換到 2 月變成 2 月 28 日，不是 3 月 3 日', () => {
    // 那個月根本沒有 31 日，而家長要的是「月底」—— 夾到該月最後一天正是他的意思。
    // 交給 Date 正規化則會安靜地跳到下個月，選的日期與存下來的差三天。
    expect(clampSelection({ year: 2015, month: 2, day: 31 }, w)).toEqual({ year: 2015, month: 2, day: 28 });
    expect(clampSelection({ year: 2016, month: 2, day: 31 }, w)).toEqual({ year: 2016, month: 2, day: 29 });
    expect(clampSelection({ year: 2018, month: 4, day: 31 }, w)).toEqual({ year: 2018, month: 4, day: 30 });
  });

  it('落在區間外的年份退回未選，不會被換成另一年', () => {
    // 這裡不能夾。家長選 1990 年，夾成 2011 年就是把他的選擇換掉了，
    // 而畫面上只是安靜地變了一個數字。
    expect(clampSelection({ year: 1990, month: 6, day: 15 }, w).year).toBeNull();
    expect(clampSelection({ year: 2099, month: 6, day: 15 }, w).year).toBeNull();
  });

  it('先選了月，再選到區間邊界那一年，月退回未選而不是跳到別的月', () => {
    // 年還沒選時十二個月都給，所以家長選得到 3 月；接著選 2011 年（那年只從
    // 7 月開始）。把 3 月夾成 7 月，孩子的生日就差了四個月，而家長不會發現。
    const early = clampSelection({ year: w.earliest.getFullYear(), month: 3, day: 15 }, w);
    expect(early.year).toBe(w.earliest.getFullYear());
    expect(early.month).toBeNull();

    const late = clampSelection({ year: w.latest.getFullYear(), month: 12, day: 15 }, w);
    expect(late.year).toBe(w.latest.getFullYear());
    expect(late.month).toBeNull();
  });

  it('落在區間邊界那個月之外的日也退回未選', () => {
    // 區間從 2011-07-10 起算，7 月 5 日不在範圍內。
    const sel = clampSelection(
      { year: w.earliest.getFullYear(), month: w.earliest.getMonth() + 1, day: 5 },
      w
    );
    expect(sel.month).toBe(w.earliest.getMonth() + 1);
    expect(sel.day).toBeNull();
  });

  it('對齊過的選擇要嘛還沒選完，要嘛是一個落在適用範圍內的日子', () => {
    // 沒有第三種結果 —— 尤其不會是「看起來選完了、但存不進去」。
    const wild = [
      { year: 1900, month: 1, day: 1 },
      { year: 2100, month: 12, day: 31 },
      { year: 2011, month: 1, day: 31 },
      { year: 2025, month: 12, day: 31 },
      { year: 2016, month: 2, day: 30 },
      { year: 2018, month: 3, day: 7 },
    ];
    for (const sel of wild) {
      const aligned = clampSelection(sel, w);
      const iso = selectionToBirthDate(aligned);
      if (iso === '') continue; // 還沒選完，表單自己會擋
      const age = calculateAgeMonth(iso, today);
      expect(age, `${JSON.stringify(sel)} 對齊成 ${iso}`).not.toBeNull();
      expect(age!).toBeGreaterThanOrEqual(T1_AGE_RANGE.minMonths);
      expect(age!).toBeLessThanOrEqual(T1_AGE_RANGE.maxMonths);
    }
  });

  it('已存的那一天即使超出範圍也留得住 —— 家長改名字不會弄丟孩子的生日', () => {
    const stored = '2010-05-03';
    const widened = birthDateWindow(today, stored);
    expect(clampSelection({ year: 2010, month: 5, day: 3 }, widened)).toEqual({ year: 2010, month: 5, day: 3 });
    // 但它旁邊那些日子仍然選不到
    expect(clampSelection({ year: 2010, month: 5, day: 4 }, widened).day).toBeNull();
  });

  it('還沒選的位置維持沒選，不憑空補一個值', () => {
    // 舊檔案沒有出生日期時三個下拉都是空的。補一個看起來很正常的日期進去，
    // 家長一按保存那個猜出來的日子就變成孩子永久的生日。
    expect(clampSelection({ year: null, month: null, day: null }, w)).toEqual({
      year: null,
      month: null,
      day: null,
    });
    expect(clampSelection({ year: 2018, month: null, day: 31 }, w)).toEqual({
      year: 2018,
      month: null,
      day: 31,
    });
  });
});

describe('選擇與出生日期字串互轉', () => {
  it('三個都選了才組得出一個出生日期', () => {
    expect(selectionToBirthDate({ year: 2018, month: 3, day: 7 })).toBe('2018-03-07');
    expect(selectionToBirthDate({ year: 2018, month: 3, day: null })).toBe('');
    expect(selectionToBirthDate({ year: null, month: 3, day: 7 })).toBe('');
    expect(selectionToBirthDate({ year: null, month: null, day: null })).toBe('');
  });

  it('出生日期讀得回三個選擇', () => {
    expect(birthDateToSelection('2018-03-07')).toEqual({ year: 2018, month: 3, day: 7 });
  });

  it('讀不出來的出生日期回三個空的選擇，不回一個看起來很正常的日期', () => {
    const empty = { year: null, month: null, day: null };
    expect(birthDateToSelection('')).toEqual(empty);
    expect(birthDateToSelection('不是日期')).toEqual(empty);
    expect(birthDateToSelection('2018-02-30')).toEqual(empty);
  });

  it('轉過去再轉回來還是同一天', () => {
    for (const iso of ['2011-07-10', '2016-02-29', '2025-08-09', '2018-12-31']) {
      expect(selectionToBirthDate(birthDateToSelection(iso))).toBe(iso);
    }
  });
});
