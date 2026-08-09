import { describe, it, expect } from 'vitest';
import { ageBandDrift, latestAssessedAgeMonth } from '../src/utils/ageBandDrift';
import { getT1AgeBand, T1_AGE_BANDS, T1_AGE_RANGE } from '../src/t1Data';
import type { AssessmentRecord, DimensionScore } from '../src/types';

/**
 * 跨年齡段的判斷（issue #24）。
 *
 * 孩子的實足月齡會自己往前走，測評月齡不會。兩者落在不同的年齡段時，那份結果是
 * 用**另一組題目**測出來的 —— 它仍然是當時的有效記錄，但照著今天的年齡去讀就會
 * 讀錯。畫面得說出這件事。
 *
 * 判斷寫在元件的 JSX 條件裡就沒有任何一條測試驗得到它，而它錯掉的樣子很安靜：
 * 提示不出現（家長照著過期的結果做決定），或到處都出現（提示變成雜訊，家長開始
 * 忽略它）。邊界正好是最容易寫錯的地方 —— `>` 與 `>=` 差一個月。
 */

function t1Score(overrides: Partial<DimensionScore> = {}): DimensionScore {
  return {
    dimensionId: 'language',
    dimensionName: '语言沟通',
    tierId: 'T1',
    score: 6,
    maxScore: 8,
    status: 'borderline',
    completedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function t1Record(ageMonth: number, createdAt: string): AssessmentRecord {
  return {
    id: `rec_${createdAt}`,
    type: 'T1_SCREENING',
    child: { name: '小明', ageMonth, gender: 'boy' },
    scores: [],
    createdAt,
  };
}

describe('年齡段查表', () => {
  it('每一段的兩端都落在自己那一段', () => {
    for (const band of T1_AGE_BANDS) {
      expect(getT1AgeBand(band.minAge).id, `${band.id} 段的下界`).toBe(band.id);
      expect(getT1AgeBand(band.maxAge).id, `${band.id} 段的上界`).toBe(band.id);
    }
  });

  it('適用範圍外落到最近的一段', () => {
    // 這是 `t1Data` 既有的行為：出得了題目才有結果可讀。判斷必須跟著它，
    // 否則畫面會說「請重測」，而重測拿到的是同一組題目。
    expect(getT1AgeBand(T1_AGE_RANGE.minMonths - 1).id).toBe('A');
    expect(getT1AgeBand(0).id).toBe('A');
    expect(getT1AgeBand(T1_AGE_RANGE.maxMonths + 1).id).toBe('E');
    expect(getT1AgeBand(999).id).toBe('E');
  });
});

describe('實足月齡與測評月齡是否已不同段', () => {
  it('同一段內長大了幾個月不算跨段', () => {
    // B 段是 24–47。從 24 走到 47 都還是同一組題目，此時提示只會是雜訊。
    expect(ageBandDrift(47, 24)).toBeNull();
    expect(ageBandDrift(24, 24)).toBeNull();
  });

  it('剛好沒跨段 —— 停在同一段的最後一個月', () => {
    const band = T1_AGE_BANDS[1]; // B 段 24–47
    expect(ageBandDrift(band.maxAge, band.minAge)).toBeNull();
  });

  it('剛好跨段 —— 多一個月就換了一組題目', () => {
    const b = T1_AGE_BANDS[1]; // 24–47
    const c = T1_AGE_BANDS[2]; // 48–71
    const drift = ageBandDrift(c.minAge, b.maxAge);
    expect(drift).not.toBeNull();
    expect(drift!.currentBand.id).toBe('C');
    expect(drift!.assessedBand.id).toBe('B');
    expect(drift!.currentAgeMonth).toBe(48);
    expect(drift!.assessedAgeMonth).toBe(47);
  });

  it('每一組相鄰的段都在交界處被認出來', () => {
    // 只驗 B→C 的話，一個寫死成「48 個月以上才提示」的實作照樣全綠。
    for (let i = 1; i < T1_AGE_BANDS.length; i++) {
      const prev = T1_AGE_BANDS[i - 1];
      const next = T1_AGE_BANDS[i];
      expect(ageBandDrift(next.minAge, prev.maxAge), `${prev.id}→${next.id}`).not.toBeNull();
      expect(ageBandDrift(prev.maxAge, prev.maxAge), `${prev.id} 段內`).toBeNull();
    }
  });

  it('跨了兩段也算 —— 隔了很久才回來的孩子', () => {
    const drift = ageBandDrift(120, 30);
    expect(drift!.assessedBand.id).toBe('B');
    expect(drift!.currentBand.id).toBe('E');
  });

  it('測評月齡比實足月齡大也算 —— 生日被改對了', () => {
    // 家長把打錯的出生日期改回來時，實足月齡會**變小**。那次篩查一樣是用
    // 另一組題目測的，一樣讀不得。方向不對稱的話這個情形會靜靜地漏掉。
    const drift = ageBandDrift(30, 60);
    expect(drift).not.toBeNull();
    expect(drift!.currentBand.id).toBe('B');
    expect(drift!.assessedBand.id).toBe('C');
  });

  it('提示說得出兩邊分別是哪一段', () => {
    // 驗收條件：「提示說得出目前是哪一段、結果是哪一段測的」。
    const drift = ageBandDrift(48, 47)!;
    expect(drift.currentBand.name).toContain('C 段');
    expect(drift.assessedBand.name).toContain('B 段');
  });

  it('缺一邊就不判斷，不猜', () => {
    // 沒做過篩查、或舊資料裡沒有測評月齡。此時「跨了段」與「沒跨段」都是猜的，
    // 而猜錯的兩種樣子都不好：憑空冒出一句請重測，或安靜地不說。
    expect(ageBandDrift(48, null)).toBeNull();
    expect(ageBandDrift(null, 47)).toBeNull();
    expect(ageBandDrift(null, null)).toBeNull();
    expect(ageBandDrift(48, undefined)).toBeNull();
  });

  it('讀不出來的數字不判斷', () => {
    // 這些值可能直接來自 localStorage 或雲端 JSON，沒有人保證它的形狀。
    expect(ageBandDrift(48, NaN)).toBeNull();
    expect(ageBandDrift(Infinity, 47)).toBeNull();
    expect(ageBandDrift(48, -1)).toBeNull();
    expect(ageBandDrift(48, 47.5)).toBeNull();
  });

  it('適用範圍外的兩個月齡落在同一段就不提示', () => {
    // 190 與 200 個月都出 E 段的題目。說「請重測」等於請家長再答一次一樣的題。
    expect(ageBandDrift(200, 190)).toBeNull();
    expect(ageBandDrift(6, 3)).toBeNull();
  });
});

describe('最近一次篩查的測評月齡從哪裡來', () => {
  it('沒有篩查資料時回 null', () => {
    expect(latestAssessedAgeMonth([], [])).toBeNull();
  });

  it('優先讀篩查成績上記下的測評月齡', () => {
    const scores = [t1Score({ assessedAgeMonth: 30 })];
    // 歷史紀錄裡有一份更早的篩查，但成績才是「目前的結果」。
    expect(latestAssessedAgeMonth(scores, [t1Record(24, '2025-01-01T00:00:00.000Z')])).toBe(30);
  });

  it('同一次篩查的九個維度取最後完成的那一個', () => {
    const scores = [
      t1Score({ dimensionId: 'language', assessedAgeMonth: 30, completedAt: '2026-01-01T00:00:00.000Z' }),
      t1Score({ dimensionId: 'cognitive', assessedAgeMonth: 42, completedAt: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(latestAssessedAgeMonth(scores, [])).toBe(42);
  });

  it('不理深度評估的成績 —— 那不是篩查', () => {
    const scores = [t1Score({ tierId: 'T2', assessedAgeMonth: 99 })];
    expect(latestAssessedAgeMonth(scores, [])).toBeNull();
  });

  it('舊成績沒有這個欄位時退回篩查紀錄裡的測評月齡', () => {
    // 這個欄位是這張票才加的。已經在跑的部署裡有一批只有分數、沒有測評月齡的
    // 成績 —— 而那正是「年齡改照今天算之後立刻跨段」的那一批孩子。
    const legacy = [t1Score()];
    const history = [t1Record(30, '2026-01-01T00:00:00.000Z')];
    expect(latestAssessedAgeMonth(legacy, history)).toBe(30);
  });

  it('退回時取最近的一份篩查紀錄', () => {
    const history = [
      t1Record(24, '2025-01-01T00:00:00.000Z'),
      t1Record(40, '2026-06-01T00:00:00.000Z'),
      t1Record(30, '2025-08-01T00:00:00.000Z'),
    ];
    expect(latestAssessedAgeMonth([], history)).toBe(40);
  });

  it('退回時不理專項報告 —— 它的年齡段不是篩查用的那一段', () => {
    const specialized: AssessmentRecord = {
      ...t1Record(99, '2026-07-01T00:00:00.000Z'),
      type: 'T2_T3_SPECIALIZED',
    };
    const history = [t1Record(30, '2026-01-01T00:00:00.000Z'), specialized];
    expect(latestAssessedAgeMonth([], history)).toBe(30);
  });

  it('形狀壞掉的輸入不會炸，也不會生出一個假的月齡', () => {
    expect(latestAssessedAgeMonth(null as any, undefined as any)).toBeNull();
    expect(latestAssessedAgeMonth([t1Score({ assessedAgeMonth: 'x' as any })], [])).toBeNull();
    expect(latestAssessedAgeMonth([], [{ ...t1Record(0, 'x'), child: null as any }])).toBeNull();
  });
});
