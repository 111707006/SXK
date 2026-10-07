/**
 * 孩子資料＋T1 成績 → 推薦引擎的輸入（客規 §3；T2 v3 推薦規格 §2）。純函式。
 *
 * 【T1 的三種讀法，這裡是第二種】
 * 客規 §1 的等級：8–7 未见明显、6–5 轻度、4–3 中度、2–0 明显；紅旗題答「还不能」至少中度。A 的 T1 報告與線上干預的
 * T1 推定各有自己的讀法（規格 §2.2），三者不共用函式。
 *
 * 【計分方向】A 的 T1 每題 2＝可以做到、0＝还不能，每維 Σ（0–8）；客規每題 0＝可以做到、2＝还不能、每維 8 − Σ。
 * 兩者每維分數相同；逐題要翻過來（`2 − v`）。
 *
 * 【舊的 T1】2026-10 之前存的成績沒有逐題作答（`items`）：關鍵題標籤、紅旗維度都當沒有，`itemsMissing = true`，
 * 上層提示家長重做一次 T1 推薦會更準（待問表 R-11）。
 */

import { getT1AgeBand } from '../../t1Data';
import { SITE_DIMENSION_ID } from '../dimensionMap';
import { DIMENSION_CODES } from '../types';
import type { DimensionCode } from '../types';
import type { DxCode, KeyTag, Level, RecommendInput } from './types';

/** 家長在孩子資料裡填的補充欄位（只在專案 A 問；都選填）。 */
export interface ChildRecommendFields {
  /** 診斷，最多 2 個，第一個為主；「疑似」與「已診斷」同檔（客規 §1）。 */
  diagnoses?: DxCode[];
  /** 是否上托育／幼兒園／學校（決定教師版能不能用）。 */
  inSchool?: boolean;
  /** 有反覆眨眼、清喉嚨等抽動。 */
  hasTics?: boolean;
  /** 做過聽力檢查：是／否／不知道（`null`）。 */
  hearingChecked?: boolean | null;
  /** 出生孕週；未滿 37 週、而且未滿 24 個月時用矯正月齡（客規 §3）。沒填＝足月。 */
  gestationWeeks?: number | null;
}

/** T1 一維的成績（`DimensionScore` 的子集）。`items` 是那一維四題的作答，A 的計分方向（2＝可以做到）。 */
export interface T1ScoreInput {
  tierId: string;
  dimensionId: string;
  score: number;
  items?: ReadonlyArray<number>;
}

export const VALID_DX: ReadonlyArray<Exclude<DxCode, 'NONE'>> = ['LDADHD', 'ASD', 'GDD', 'CP', 'EMO', 'LANG'];

/** 早產矯正（客規 §3）：孕週 < 37、而且實足月齡 < 24 → 減掉早產的週數換成月（4.345 週一個月，四捨五入），不低於 0。 */
export function correctedAgeMonth(ageM: number, gestationWeeks: number | null | undefined): number {
  if (gestationWeeks == null || !(gestationWeeks < 37) || ageM >= 24) return ageM;
  return Math.max(0, ageM - Math.round((40 - gestationWeeks) / 4.345));
}

/** 客規 §1 的等級；紅旗題答「还不能」至少中度。 */
export function levelOf(score: number, redFlagCannot: boolean): Level {
  const base: Level = score >= 7 ? 0 : score >= 5 ? 1 : score >= 3 ? 2 : 3;
  return redFlagCannot && base < 2 ? 2 : base;
}

export interface BuiltInput {
  input: RecommendInput;
  /** 至少一維有分數、但沒有逐題作答（舊的 T1）。 */
  itemsMissing: boolean;
}

/**
 * 組推薦輸入。`ageM` 是做 T1 那時候的測評月齡（沒有就用實足月齡）；`doneCodes` 是近 3 個月完成的量表（客戶代碼）。
 * 認不得的診斷碼略過、超過 2 個只取前 2 個。
 */
export function buildRecommendInput(args: {
  ageM: number;
  child: ChildRecommendFields;
  t1Scores: ReadonlyArray<T1ScoreInput>;
  doneCodes?: ReadonlyArray<string>;
}): BuiltInput {
  const ageM = correctedAgeMonth(args.ageM, args.child.gestationWeeks);
  const band = getT1AgeBand(args.ageM); // 題目是照當時的實足月齡出的（範圍外落到最近一段；E 段之後照 E，待問表 R-5）
  const levels = {} as Record<DimensionCode, Level>;
  const rfdims: DimensionCode[] = [];
  const items: Record<string, 0 | 1 | 2> = {};
  let itemsMissing = false;

  for (const d of DIMENSION_CODES) {
    const site = SITE_DIMENSION_ID[d];
    const score = [...args.t1Scores].reverse().find(s => s.tierId === 'T1' && s.dimensionId === site);
    if (!score) {
      levels[d] = 0;
      continue;
    }
    const questions = band.questions.filter(q => q.dimensionId === site);
    const answered = Array.isArray(score.items) && score.items.length === questions.length;
    if (!answered) itemsMissing = true;
    let redFlagCannot = false;
    if (answered) {
      questions.forEach((q, i) => {
        const v = score.items![i];
        if (v === 0 || v === 1 || v === 2) items[`${d}_${i}`] = (2 - v) as 0 | 1 | 2;
        if (q.isRedFlag && v === 0) redFlagCannot = true;
      });
    }
    if (redFlagCannot) rfdims.push(d);
    levels[d] = levelOf(Math.max(0, Math.min(8, Math.round(score.score))), redFlagCannot);
  }

  const dx = (args.child.diagnoses ?? []).filter((x): x is Exclude<DxCode, 'NONE'> => VALID_DX.includes(x as never)).slice(0, 2);
  const extraTags: KeyTag[] = args.child.hasTics ? ['TIC'] : [];
  return {
    input: {
      ageM,
      levels,
      rfdims,
      items,
      dx,
      school: args.child.inSchool === true,
      done: [...(args.doneCodes ?? [])],
      extraTags,
      hearingChecked: args.child.hearingChecked ?? null,
    },
    itemsMissing,
  };
}
