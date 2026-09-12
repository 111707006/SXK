/**
 * T2 的九碼 ↔ 正式站的 `dimensionId` 與家長看到的維度名稱（CONTEXT.md「維度」的對照表）。
 *
 * 【為什麼要有這一檔】
 * 同九件事有三套名字：T2 規格用 `LANG`、正式站的資料庫與 `src/data.ts` 用 `language`、
 * 家長讀到的是「语言沟通」。三套之間的對照只寫在 CONTEXT.md 的表格裡，程式碼一直是各處
 * 自己抄一份 —— 抄的地方多了就會漂。這一檔是那張表在程式碼裡的唯一副本。
 *
 * ⚠️ CONTEXT.md 那條警語照抄：**三處對不齊是歷史留下的，不是筆誤，不要順手改。**
 * `gross_motor` 的中文是「动作发展」（全部動作，不只粗大）；`social_emotional` 帶著
 * emotional，但情緒是另一個獨立維度；`self_care` 與 ADL 是同一件事的兩個詞。
 *
 * 【名稱為什麼用查的，不用抄的】
 * 家長在九宮格、報告、目標段落讀到的必須是同一個詞。`src/utils/statusWording.ts` 檔頭記著
 * 這個專案發生過「同一顆紅燈五個名字」；維度名稱抄第二份就是同一種錯的下一次。
 */

import { DIMENSIONS_DATA } from '../data';
import { DIMENSION_CODES } from './types';
import type { DimensionCode } from './types';

/** 九碼 → 正式站 `src/data.ts` 的 `DimensionConfig.id`。 */
export const SITE_DIMENSION_ID: Readonly<Record<DimensionCode, string>> = {
  COG: 'cognitive',
  LANG: 'language',
  SOC: 'social_emotional',
  EMO: 'emotion_behavior',
  ATT: 'attention',
  MOT: 'gross_motor',
  SEN: 'sensory_processing',
  ADL: 'self_care',
  LEARN: 'learning_ability',
};

/**
 * 九碼 → 家長看到的維度名稱，從 `DIMENSIONS_DATA` 查出來（不抄）。
 * 對不上就在載入時丟錯 —— 正式站改了 id 而這張表沒跟上時，要在第一次 import 就爆，
 * 不是在某一份報告上悄悄少一個名字。
 */
export const SITE_DIMENSION_NAME: Readonly<Record<DimensionCode, string>> = Object.fromEntries(
  DIMENSION_CODES.map(code => {
    const id = SITE_DIMENSION_ID[code];
    const config = DIMENSIONS_DATA.find(d => d.id === id);
    if (!config) throw new Error(`維度對照：正式站的 DIMENSIONS_DATA 裡沒有 ${id}（${code}）`);
    return [code, config.name];
  }),
) as Record<DimensionCode, string>;
