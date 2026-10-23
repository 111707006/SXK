/**
 * T1 最後一步「补充资料」（客戶 10/22，issue #83，`VITE_UI_1022`）。
 *
 * 補充資料原本在建檔表單裡、全部選填，家長不知道為什麼要填。1022 移到 T1 九個方面之後：會影響推薦的
 * 三題（孕週、抽動、聽力）必填、各有「足月」或「不清楚」可選；上學、診斷選填。按「生成报告」時一起寫回
 * 孩子檔案 —— 孩子資料的形狀不變（五個欄位本來就在 `Child` 上）。
 *
 * 判斷全在這裡（純函式），畫面只畫。
 */
import type { Child } from '../types';

type Dx = NonNullable<Child['diagnoses']>[number];

export interface SupplementAnswers {
  /** 孕週：24–36 週，或「足月」。`undefined` ＝ 還沒選。 */
  gestation?: number | 'term';
  /** 抽動：有／沒有／不清楚。 */
  tics?: boolean | 'unknown';
  /** 聽力檢查：做過／沒做過／不清楚。 */
  hearing?: boolean | 'unknown';
  /** 選填。 */
  inSchool?: boolean;
  /** 選填，最多兩個。 */
  diagnoses: Dx[];
}

export type RequiredSupplementField = 'gestation' | 'tics' | 'hearing';

/**
 * 帶入檔案上次的值。檔案上 `null`／`undefined` 兩種意思分不開（「足月／不清楚」與「從沒答過」存成同一個值），
 * 所以只有**重做 T1**（`answeredBefore`：之前交過卷 —— 1022 起交卷一定答過這一步；更早交卷的家長當時在建檔表單
 * 選填，空著的系統本來就當成足月／不清楚，暫採）才把它們當成「足月」「不清楚」帶入；第一次做的孩子空著，讓家長自己選。
 */
export function supplementFromChild(child: Child, answeredBefore: boolean): SupplementAnswers {
  const weeks = child.gestationWeeks;
  return {
    gestation: typeof weeks === 'number' ? weeks : answeredBefore ? 'term' : undefined,
    tics: typeof child.hasTics === 'boolean' ? child.hasTics : answeredBefore ? 'unknown' : undefined,
    hearing: typeof child.hearingChecked === 'boolean' ? child.hearingChecked : answeredBefore ? 'unknown' : undefined,
    inSchool: child.inSchool,
    diagnoses: [...(child.diagnoses ?? [])],
  };
}

/** 還沒答的必填題（照畫面的順序）。空陣列才可以送出。 */
export function supplementMissing(a: SupplementAnswers): RequiredSupplementField[] {
  const missing: RequiredSupplementField[] = [];
  if (a.gestation === undefined) missing.push('gestation');
  if (a.tics === undefined) missing.push('tics');
  if (a.hearing === undefined) missing.push('hearing');
  return missing;
}

/**
 * 寫回孩子檔案：「足月」存 `null`、聽力「不清楚」存 `null`、抽動「不清楚」不存（`hasTics` 拿掉）——
 * 與建檔表單以前存的意思一樣，T2 推薦照舊讀得懂。其他欄位原樣保留。
 */
export function applySupplement(child: Child, a: SupplementAnswers): Child {
  const next: Child = {
    ...child,
    gestationWeeks: a.gestation === undefined || a.gestation === 'term' ? null : a.gestation,
    hearingChecked: a.hearing === undefined || a.hearing === 'unknown' ? null : a.hearing,
    diagnoses: [...a.diagnoses],
  };
  if (typeof a.tics === 'boolean') next.hasTics = a.tics;
  else delete next.hasTics;
  if (typeof a.inSchool === 'boolean') next.inSchool = a.inSchool;
  else delete next.inSchool;
  return next;
}
