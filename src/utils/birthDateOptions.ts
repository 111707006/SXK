/**
 * 出生日期三個下拉（年／月／日）的選項生成與夾值。
 *
 * 【為什麼不用日期輸入框】`<input type="date">` 在 iPad Safari 上叫出的是**系統
 * 繪製的浮層**，位置與尺寸我們控制不了。客戶影片裡家長點開年月滾輪之後，滾輪把
 * 整張表單蓋住，「保存修改」按鈕壓在它底下，連點十秒都關不掉 —— 需求說明書 p.5
 * 紅字「BUG：无法点日」。不跟原生控制項對打，換掉它。
 *
 * 【為什麼判斷全部住在這裡】專案沒有 jsdom，留在 JSX 裡的分支一行都測不到。
 * 三個下拉本身只負責把這裡算出來的陣列畫出來。
 *
 * 【為什麼要有「區間」這個概念】舊表單讓家長隨便選，選完才跳「适用范围为12-180
 * 个月」。範圍外的日期根本不該出現在選項裡。
 */

import { T1_AGE_RANGE } from '../t1Data';
import { daysInMonth, monthsBefore, parseBirthDate } from './dateUtils';

/** 可選的生日區間，兩端都含。 */
export interface BirthDateWindow {
  /** 最早選得到的那一天。再早一天，孩子就超過適用範圍上限。 */
  earliest: Date;
  /** 最晚選得到的那一天。再晚一天，孩子就不滿適用範圍下限。 */
  latest: Date;
}

/**
 * 三個下拉當下的選擇。月是 1–12（不是 `Date` 的 0–11），日是 1–31。
 *
 * 還沒選的位置是 `null`。三個都是 `null` 是一個**正常狀態** —— 多合作公司上線前
 * 建的舊檔案只有月齡沒有出生日期，那時候不該憑空補一個看起來很正常的日子進去。
 */
export interface BirthDateSelection {
  year: number | null;
  month: number | null;
  day: number | null;
}

/**
 * 適用範圍寫給家長看的樣子，例如「12-180 个月（1-15 岁）」。
 *
 * 這句話原本在兩張表單裡各手寫了兩次，與驗證式用的數字各自為政。改了年齡段卻
 * 漏改文案，家長會照著一句錯的說明去試一個永遠選不到的日期。
 */
export const APPLICABLE_RANGE_TEXT =
  `${T1_AGE_RANGE.minMonths}-${T1_AGE_RANGE.maxMonths} 个月` +
  `（${Math.floor(T1_AGE_RANGE.minMonths / 12)}-${Math.floor(T1_AGE_RANGE.maxMonths / 12)} 岁）`;

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 還沒選年月時，日的選項給滿 —— 年月選定之後 `clampSelection` 會再夾一次。 */
const LONGEST_MONTH = 31;

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) out.push(n);
  return out;
}

/** 選項都是連續的整數區間，所以夾值就是夾在頭尾之間。空陣列代表這個位置無解。 */
function clampInto(value: number, options: number[]): number | null {
  if (options.length === 0) return null;
  return Math.min(Math.max(value, options[0]), options[options.length - 1]);
}

/**
 * 由「今天」與適用範圍反推**可選的生日區間**。
 *
 * 下界不是「往回 180 個月」而是「往回 181 個月的隔天」：剛滿 15 歲又過了十天的
 * 孩子，實足月齡仍是 180，仍在範圍內。用 180 當下界會讓這一整個月的孩子選不到
 * 自己的生日，而畫面上看不出少了什麼。
 *
 * `storedBirthDate` 是檔案上**已經存下來的**那一天。它可能已經超出適用範圍 ——
 * 孩子滿 15 歲之後檔案仍要能改（見 `EditProfileModal` 的判斷）。存下來的日子若
 * 選不到，家長光是改個名字就會把孩子的生日弄丟，所以區間為它往外讓一步。
 * 讓出來的那一段仍存得不進去：`EditProfileModal` 會擋下「改動過又落在範圍外」。
 */
export function birthDateWindow(today: Date = new Date(), storedBirthDate?: string | null): BirthDateWindow {
  // `today` 來自 `useToday()` 或 `new Date()`，往回十五年不可能掉出四位數年份。
  const latest = monthsBefore(today, T1_AGE_RANGE.minMonths)!;
  const earliest = addDays(monthsBefore(today, T1_AGE_RANGE.maxMonths + 1)!, 1);

  const stored = storedBirthDate ? parseBirthDate(storedBirthDate) : null;
  if (!stored) return { earliest, latest };

  return {
    earliest: stored < earliest ? stored : earliest,
    latest: stored > latest ? stored : latest,
  };
}

/** 區間涵蓋到的年份，由早到晚。 */
export function yearOptions(window: BirthDateWindow): number[] {
  return range(window.earliest.getFullYear(), window.latest.getFullYear());
}

/**
 * 已選年份底下選得到的月份。
 *
 * 年份還沒選時十二個月都給 —— 此時沒有任何依據可以收邊，而家長從哪一個下拉
 * 開始選是他家的事。
 */
export function monthOptions(window: BirthDateWindow, year: number | null): number[] {
  if (year === null) return ALL_MONTHS;
  if (year < window.earliest.getFullYear() || year > window.latest.getFullYear()) return [];

  const first = year === window.earliest.getFullYear() ? window.earliest.getMonth() + 1 : 1;
  const last = year === window.latest.getFullYear() ? window.latest.getMonth() + 1 : 12;
  return range(first, last);
}

/**
 * 已選年月底下選得到的日子 —— 閏年的二月是 29 天，四月是 30 天。
 *
 * 區間的頭尾那個月還要再收一次：區間從 7 月 10 日開始的話，那年 7 月只有 10 日
 * 之後選得到。
 */
export function dayOptions(window: BirthDateWindow, year: number | null, month: number | null): number[] {
  if (year === null || month === null) return range(1, LONGEST_MONTH);
  if (!monthOptions(window, year).includes(month)) return [];

  const isEarliestMonth = year === window.earliest.getFullYear() && month === window.earliest.getMonth() + 1;
  const isLatestMonth = year === window.latest.getFullYear() && month === window.latest.getMonth() + 1;

  const first = isEarliestMonth ? window.earliest.getDate() : 1;
  const last = isLatestMonth ? window.latest.getDate() : daysInMonth(year, month - 1);
  return range(first, last);
}

/**
 * 把一組選擇夾回選得到的範圍。每動一個下拉就跑一次。
 *
 * 兩件事會讓一組原本合法的選擇失效：換到較短的月份（1 月 31 日 → 2 月沒有 31 日），
 * 以及換到區間邊界那一年（2011 年只從 7 月 10 日開始）。交給 `Date` 正規化會安靜地
 * 跳到下個月 —— 家長選的是 2 月，存下來的是 3 月 3 日。
 *
 * **沒選的位置維持沒選**。補一個值進去，家長一按保存那個猜出來的日子就變成孩子
 * 永久的生日。
 */
export function clampSelection(selection: BirthDateSelection, window: BirthDateWindow): BirthDateSelection {
  const year = selection.year === null ? null : clampInto(selection.year, yearOptions(window));
  const month = selection.month === null ? null : clampInto(selection.month, monthOptions(window, year));
  const day = selection.day === null ? null : clampInto(selection.day, dayOptions(window, year, month));
  return { year, month, day };
}

/** 三個都選了才組得出一個出生日期；還沒選完回空字串（表單自己會擋）。 */
export function selectionToBirthDate(selection: BirthDateSelection): string {
  const { year, month, day } = selection;
  if (year === null || month === null || day === null) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 讀不出來的出生日期回三個空的選擇，不回一個看起來很正常的日期。 */
export function birthDateToSelection(birthDate: string): BirthDateSelection {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return { year: null, month: null, day: null };
  return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
}
