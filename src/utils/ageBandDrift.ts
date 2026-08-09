/**
 * 孩子的實足月齡是否已經跨出上一次篩查所在的年齡段。
 *
 * 這裡是**判斷**，不是像素：純函式、不碰 React、不碰 DOM、不讀時鐘。理由與
 * `src/admin/adminView.ts` 相同 —— 寫在元件的 JSX 條件裡就沒有任何一條測試驗得到
 * 它，而它錯掉的兩種樣子都很安靜：提示不出現（家長照著用另一組題目測出來的結果
 * 做決定），或到處都出現（提示成了雜訊，家長開始忽略它）。
 *
 * 這件事本來被寫死的「今天」掩蓋著。年齡改照真實日期走之後，會有一批孩子立刻
 * 跨段 —— 那是預期行為，不是回歸。
 *
 * **不失效、不擋、不標為過期。** 舊結果仍是當時的有效記錄，這個模組只負責說出
 * 「兩者已不同段」這個事實，讓畫面把它講清楚並建議重測。
 */
import type { AssessmentRecord, DimensionScore } from '../types';
import { getT1AgeBand } from '../t1Data';

/** 一段年齡段在畫面上要說出來的部分。刻意不回整個 `T1AgeBand` —— 題目不該外流到 UI。 */
export interface AgeBandRef {
  id: string;
  name: string;
}

export interface AgeBandDrift {
  /** 照今天算，現在該做哪一段的篩查。 */
  currentBand: AgeBandRef;
  /** 那一次篩查當時用的是哪一段。 */
  assessedBand: AgeBandRef;
  currentAgeMonth: number;
  assessedAgeMonth: number;
}

/**
 * 月齡只收**非負整數**。
 *
 * 這些值可能直接來自 localStorage 或雲端 JSON，沒有人保證它的形狀。硬算會讓
 * `NaN` 落到 A 段（`NaN >= 12` 是 false）—— 一個看起來很正常的年齡段。
 */
function isAgeMonth(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 某個月齡對應的年齡段，只留畫面要說的部分。
 *
 * 後台也用這一支（`adminStore.ts`）—— 家長端與專家端必須說出同一個年齡段名稱，
 * 兩邊各自查一次表就有兩種說法的空間。
 */
export function ageBandOf(ageMonth: number): AgeBandRef {
  const band = getT1AgeBand(ageMonth);
  return { id: band.id, name: band.name };
}

/**
 * 兩個月齡是否落在不同的年齡段；是的話回傳兩邊分別是哪一段。
 *
 * 比的是**年齡段**而不是月齡差：差幾個月完全不重要，重要的是「有沒有換一組題目」。
 * 47 → 48 只多一個月卻換了整份量表；24 → 47 差了快兩年卻是同一份。
 *
 * 方向刻意對稱。家長把打錯的出生日期改回來時實足月齡會**變小**，那次篩查一樣是
 * 用另一組題目測的、一樣讀不得；只判「長大了」會讓這個情形靜靜地漏掉。
 *
 * 適用範圍外的月齡跟著 `getT1AgeBand` 落到最近的一段 —— 判斷必須與實際出的題目
 * 一致，否則畫面會請家長重測，而重測拿到的是同一組題目。
 *
 * 任何一邊缺了或讀不出來就回 `null`，**不猜**。此時「跨了段」與「沒跨段」都是猜的。
 */
export function ageBandDrift(
  currentAgeMonth: number | null | undefined,
  assessedAgeMonth: number | null | undefined
): AgeBandDrift | null {
  if (!isAgeMonth(currentAgeMonth) || !isAgeMonth(assessedAgeMonth)) return null;

  const currentBand = ageBandOf(currentAgeMonth);
  const assessedBand = ageBandOf(assessedAgeMonth);
  if (currentBand.id === assessedBand.id) return null;

  return { currentBand, assessedBand, currentAgeMonth, assessedAgeMonth };
}

/**
 * 最近一次篩查的測評月齡。找不到回 `null`。
 *
 * 先讀篩查成績上記下的值：`completedScores` 裡的 T1 成績就是「目前的結果」，
 * 重做篩查會整組覆蓋掉它，因此它一定是最新的一次。
 *
 * 讀不到才退回篩查紀錄裡那個孩子的月齡。`assessedAgeMonth` 是 issue #24 才加的
 * 欄位，已經在跑的部署裡有一批只有分數、沒有測評月齡的成績 —— 而那正是「年齡改
 * 照今天算之後立刻跨段」的那一批孩子，少了這條退路他們就完全收不到提示。
 *
 * 只認 `T1_SCREENING`。專項報告（T2/T3）的年齡段不是篩查用的那一段，拿它來比會
 * 得出一個與家長看到的結果無關的判斷。
 */
export function latestAssessedAgeMonth(
  scores: DimensionScore[] | null | undefined,
  history: AssessmentRecord[] | null | undefined
): number | null {
  const fromScores = latestBy(
    (scores ?? []).filter(s => s?.tierId === 'T1' && isAgeMonth(s.assessedAgeMonth)),
    s => s.completedAt
  );
  if (fromScores) return fromScores.assessedAgeMonth!;

  const fromHistory = latestBy(
    (history ?? []).filter(r => r?.type === 'T1_SCREENING' && isAgeMonth(r.child?.ageMonth)),
    r => r.createdAt
  );
  return fromHistory ? fromHistory.child.ageMonth : null;
}

/**
 * 依時間字串取最後一筆（`YYYY-MM-DD...` 的字典序等於時間序）。
 *
 * 讀不出時間的當成空字串。任何正常的時間都比空字串大，所以一筆 `completedAt`
 * 壞掉的成績不會只因為壞掉就贏過所有正常的紀錄 —— 但全部都壞掉時仍有話可說。
 */
function latestBy<T>(items: T[], timeOf: (item: T) => string | undefined): T | null {
  let best: T | null = null;
  let bestKey = '';
  for (const item of items) {
    const key = typeof timeOf(item) === 'string' ? (timeOf(item) as string) : '';
    if (best === null || key >= bestKey) {
      best = item;
      bestKey = key;
    }
  }
  return best;
}
