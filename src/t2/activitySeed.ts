/**
 * 活動庫的 300 支種子（#44，規格 v2 §7.1、§7.2、附錄 B.3）。
 *
 * 【這是什麼】
 * 舊原型的 `ACT300` 只有名稱與「3–8岁」這種字串（`act300.ts`，腳本抽的原文）。
 * 這裡把它算成 §7.1 的 `Activity`：模組＝`ceil(編號 / 20)`、月齡區間＝解析字串、
 * 維度＝附錄 B.3 依模組反查的初值。內容團隊之後在後台補 `targetMonth`、`targets`、
 * 步驟；種子只負責把 300 支**都在**、而且每一支的模組與月齡都算得出。
 *
 * 【三條規則，每一條都有測試釘著】
 * - 解析不了的適齡字串**丟例外**，不給預設值。給預設值的話，一支活動會帶著一個
 *   看起來合理的月齡進資料庫，然後在錯的年齡被配給孩子，畫面上沒有任何一處看得出來。
 * - 「全龄」是原型自己的記號（第 20 支「每天动一动」、第 300 支「一起长大的每一天」），
 *   不是解析失敗。它沒有數字，這裡不憑空發明一個上限：0 到平台服務的最大月齡
 *   （`T1_AGE_RANGE.maxMonths`）就是「全部」。
 * - 維度初值**照附錄 B.3 的字面**，不是 §7.2 `DIM_MOD` 的反查 —— 兩者不一樣
 *   （模組 4 在 B.3 是 MOT＋ADL，`DIM_MOD` 反查只有 MOT）。票 #44 的驗收點名 B.3；
 *   配對（§7.3）看的是 `moduleNo ∈ DIM_MOD`，不看這個欄位，所以差異只影響後台顯示。
 *   記在 `docs/specs/t2-v2-errata-2026-09-11.md`。
 *
 * 遷移檔 `deploy/migrations/2026-09-11-activities.sql` 裡的 INSERT 是由這份種子印出來的
 * （`scripts/t2/activitySql.ts`），`test/activitySeed.test.ts` 比對兩邊一致。
 */

import { T1_AGE_RANGE } from '../t1Data';
import { ACT300 } from './act300';
import type { Activity, DimensionCode, ModuleNo } from './types';

/** 一個模組 20 支，300 支 15 個模組（§7.2）。 */
export const ACTIVITIES_PER_MODULE = 20;
export const ACTIVITY_COUNT = 300;
export const MODULE_COUNT = 15;

/** §7.2 客戶的 15 模組名稱。 */
export const MODULE_TITLES: Readonly<Record<ModuleNo, string>> = {
  1: '身體動一動',
  2: '平衡與協調',
  3: '力氣與耐力',
  4: '小手動起來',
  5: '畫畫寫寫前',
  6: '自己來',
  7: '聽懂與回應',
  8: '詞彙與說話',
  9: '聊天與說故事',
  10: '認識情緒',
  11: '情緒來了怎麼辦',
  12: '和人一起玩',
  13: '專心與記憶',
  14: '看與想',
  15: '動腦與解決問題',
};

/**
 * 附錄 B.3：模組 → 維度初值。**照字面**抄，不從 `DIM_MOD` 反推（見檔頭）。
 *
 * 「模組 1–5 → MOT（4、5 另加 ADL；2、3、5 另加 SEN）；6 → ADL；7–9 → LANG（7、9 另加
 * ATT、SOC、COG）；10–12 → EMO（12 另加 SOC）；13–15 → COG（另加 ATT、LEARN）」
 */
export const MODULE_DIMENSIONS: Readonly<Record<ModuleNo, ReadonlyArray<DimensionCode>>> = {
  1: ['MOT'],
  2: ['MOT', 'SEN'],
  3: ['MOT', 'SEN'],
  4: ['MOT', 'ADL'],
  5: ['MOT', 'ADL', 'SEN'],
  6: ['ADL'],
  7: ['LANG', 'ATT', 'SOC', 'COG'],
  8: ['LANG'],
  9: ['LANG', 'ATT', 'SOC', 'COG'],
  10: ['EMO'],
  11: ['EMO'],
  12: ['EMO', 'SOC'],
  13: ['COG', 'ATT', 'LEARN'],
  14: ['COG', 'ATT', 'LEARN'],
  15: ['COG', 'ATT', 'LEARN'],
};

/** 「全龄」：0 到平台服務的最大月齡。上限不是發明的，是平台自己的。 */
export const ALL_AGES: Readonly<{ min: number; max: number }> = {
  min: 0,
  max: T1_AGE_RANGE.maxMonths,
};

/** 編號 → 模組：`ceil(編號 / 20)`。編號不在 1–300 就丟例外。 */
export function moduleNoOf(no: number): ModuleNo {
  if (!Number.isInteger(no) || no < 1 || no > ACTIVITY_COUNT) {
    throw new Error(`活動編號 ${no} 不在 1–${ACTIVITY_COUNT}`);
  }
  return Math.ceil(no / ACTIVITIES_PER_MODULE) as ModuleNo;
}

/** 編號 → id：`17 → 'A017'`（§7.1「沿用 ACT300 編號」）。 */
export function activityIdOf(no: number): string {
  if (!Number.isInteger(no) || no < 1 || no > ACTIVITY_COUNT) {
    throw new Error(`活動編號 ${no} 不在 1–${ACTIVITY_COUNT}`);
  }
  return `A${String(no).padStart(3, '0')}`;
}

/*
 * 原型的兩種寫法：「3–8岁」（第一個數字沒單位，跟第二個走）與「6个月–3岁」。
 * 破折號原型用的是 en dash（–），順便收一般的連字號，兩個都沒有歧義。
 */
const RANGE = /^(\d+)(个月|岁)?[–-](\d+)(个月|岁)$/;
const ALL_AGES_TEXT = /^全龄(?:／收官)?$/;

/**
 * 適齡字串 → 月齡區間。**解析不了就丟例外**，沒有預設值。
 *
 * 「全龄／收官」的「收官」是原型給最後一支活動的備註（收尾之意），不是年齡，去掉就是全龄。
 * 只認這一個備註：出現別的字就丟例外，讓人來看那是什麼。
 */
export function parseAgeRange(text: string): { min: number; max: number } {
  const s = text.trim();
  if (ALL_AGES_TEXT.test(s)) return { ...ALL_AGES };

  const m = RANGE.exec(s);
  if (!m) throw new Error(`看不懂的適齡字串：「${text}」`);
  const [, lo, loUnit, hi, hiUnit] = m;
  const min = toMonths(Number(lo), loUnit ?? hiUnit);
  const max = toMonths(Number(hi), hiUnit);
  if (!(min < max)) throw new Error(`適齡區間下限不小於上限：「${text}」→ ${min}–${max}`);
  return { min, max };
}

function toMonths(n: number, unit: string): number {
  return unit === '个月' ? n : n * 12;
}

function seedFrom(entry: { no: number; name: string; age: string }): Activity {
  const moduleNo = moduleNoOf(entry.no);
  return {
    id: activityIdOf(entry.no),
    title: entry.name,
    moduleNo,
    targetMonth: null,
    ageMonths: parseAgeRange(entry.age),
    dimensions: [...MODULE_DIMENSIONS[moduleNo]],
    targets: [],
    avoidIf: [],
    durationMin: 0,
    equipment: [],
    steps: [],
    videoUrl: null,
    active: true,
  };
}

/**
 * 300 支種子，依編號排序。模組層級就算，所以原型的字串有一個解析不了，整個模組
 * 載入就失敗 —— 那正是要的：壞在啟動時，不是壞在某個孩子的配對結果裡。
 */
export const ACTIVITY_SEED: ReadonlyArray<Activity> = ACT300.map(seedFrom);
