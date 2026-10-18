import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { developmentIndex, passProbability, P_CAP, P_FLOOR } from '../src/developmentIndex/developmentIndex';
import { T1_PASS_RATES } from '../src/developmentIndex/passRates';
import { T1_AGE_BANDS } from '../src/t1Data';
import { bandScores } from './helpers/t1Scores';

/**
 * 發育指數（#68，規格 docs/specs/client-changes-2026-10-17.md §3.2；CONTEXT.md「同齡估算」「發育指數」）。
 * 只測公開的那一支 `developmentIndex(成績, 篩查當時月齡)` 與通過率表本身。
 */

const AGES = T1_AGE_BANDS.flatMap(b => [b.minAge, Math.round((b.minAge + b.maxAge) / 2), b.maxAge]);

describe('developmentIndex', () => {
  it.each(AGES)('%i 個月：全部「可以做到」→ 100、全部「还不能」→ 70', age => {
    expect(developmentIndex(bandScores(age, () => 2), age)).toBe(100);
    expect(developmentIndex(bandScores(age, () => 0), age)).toBe(70);
  });

  describe('讀不到逐題作答回 null，不補數字', () => {
    it('R1b 之前的舊成績（沒有 items）', () => {
      expect(developmentIndex(bandScores(30, () => 2, false), 30)).toBeNull();
    });
    it('少一維', () => {
      expect(developmentIndex(bandScores(30, () => 2).slice(1), 30)).toBeNull();
    });
    it('有一維的逐題對不上題數', () => {
      const scores = bandScores(30, () => 2);
      scores[0] = { ...scores[0], items: [2, 2, 2] };
      expect(developmentIndex(scores, 30)).toBeNull();
    });
    it('月齡不明（成績上沒有、也沒給）', () => {
      const scores = bandScores(30, () => 2).map(({ assessedAgeMonth: _, ...s }) => s);
      expect(developmentIndex(scores, null)).toBeNull();
      expect(developmentIndex(scores, 30)).toBe(100);
    });
    it('不是陣列、空的', () => {
      expect(developmentIndex(null, 30)).toBeNull();
      expect(developmentIndex([], 30)).toBeNull();
    });
  });

  it('用成績上的測評月齡，不用呼叫端給的（跨段之後題目就對不上了）', () => {
    const scores = bandScores(30, () => 2);
    expect(developmentIndex(scores, 100)).toBe(100);
  });

  /** 從全「还不能」一題一題往上加分（0→1→2），總分每加 1，指數不會變低；也只會出現那五個值。 */
  it.each(AGES)('%i 個月：同月齡下總分越高，指數不會越低；只出現五個值', age => {
    const n = bandScores(age, () => 0).length * 4;
    const seen = new Set<number>();
    for (const order of [(i: number) => i, (i: number) => n - 1 - i, (i: number) => (i * 7) % n]) {
      const answers = new Array<0 | 1 | 2>(n).fill(0);
      let last = -Infinity;
      for (let step = 0; step < 2 * n; step++) {
        const k = order(step % n);
        answers[k] = (answers[k] + 1) as 1 | 2;
        const value = developmentIndex(bandScores(age, (dimIndexKey, i) => answers[dimIdx(age, dimIndexKey) * 4 + i]), age);
        expect(value).not.toBeNull();
        expect(value!).toBeGreaterThanOrEqual(last);
        last = value!;
        seen.add(value!);
      }
    }
    for (const v of seen) expect([100, 90, 80, 75, 70]).toContain(v);
  });

  it.each(AGES)('%i 個月：只有一題「有时」或一題「还不能」，其餘做得到 → 100', age => {
    expect(developmentIndex(bandScores(age, (d, i) => (d === 'language' && i === 0 ? 1 : 2)), age)).toBe(100);
    expect(developmentIndex(bandScores(age, (d, i) => (d === 'language' && i === 0 ? 0 : 2)), age)).toBe(100);
  });
});

function dimIdx(age: number, dimId: string): number {
  return bandScores(age, () => 0).findIndex(s => s.dimensionId === dimId);
}

describe('通過率表', () => {
  const questions = T1_AGE_BANDS.flatMap(b => b.questions.map(q => ({ id: q.id, band: b })));

  it('180 題各一列、照題目順序、沒有多的', () => {
    expect(questions).toHaveLength(180);
    expect(T1_PASS_RATES.map(r => r.questionId)).toEqual(questions.map(q => q.id));
  });

  it('每列有來源，資料齊全', () => {
    for (const r of T1_PASS_RATES) {
      expect(['denver', 'cdc', 'ai']).toContain(r.source);
      if (r.source === 'denver') {
        expect(r.code).toMatch(/^(PS|FM|LA|GM)\d+$/);
        expect(r.item).not.toBe('');
      } else if (r.source === 'cdc') {
        // cdc.gov 有頁面的月齡（2022 年修訂版）
        expect([9, 12, 15, 18, 24, 30, 36, 48, 60]).toContain(r.ageMonths);
        expect(r.milestone).not.toBe('');
      } else {
        for (const p of [r.atMin, r.atMax]) expect(p > 0 && p < 1).toBe(true);
      }
    }
  });

  it('丹佛與 CDC 只用在 6 歲以前（A–C 段）', () => {
    const late = T1_PASS_RATES.filter(r => /^t1_[de]_/.test(r.questionId));
    expect(late.every(r => r.source === 'ai')).toBe(true);
  });

  it('每題在年齡段頭尾兩個月齡都有機率，夾在上下限之間', () => {
    for (const { id, band } of questions) {
      for (const age of [band.minAge, band.maxAge]) {
        const p = passProbability(id, age);
        expect(p).not.toBeNull();
        expect(p!).toBeGreaterThanOrEqual(P_FLOOR);
        expect(p!).toBeLessThanOrEqual(P_CAP);
      }
    }
    expect(passProbability('t1_x_01', 30)).toBeNull();
  });

  /** 原文逐格抄在 fixture（含逗號小數點與註腳字母），這裡改回數字後逐格對。 */
  const jimma = (() => {
    const text = readFileSync(path.resolve(__dirname, 'fixtures/denver-ii-jimma-table3.tsv'), 'utf8');
    const num = (cell: string) => Number(cell.replace(/[a-z,]+$/, '').replace('.,', '.').replace(',', '.'));
    const table = new Map<string, number[]>();
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const cells = line.split('\t');
      for (const off of [0, 6]) {
        const code = cells[off];
        if (code && /^(PS|FM|LA|GM)\d+$/.test(code)) table.set(code, cells.slice(off + 2, off + 6).map(num));
      }
    }
    return table;
  })();

  it('fixture 讀得到 Table 3 全部 126 項', () => {
    expect(jimma.size).toBe(26 + 29 + 39 + 32);
    expect(jimma.get('LA16')).toEqual([13.5, 15.6, 17.7, 19.8]); // 原文「13,5」
    expect(jimma.get('PS4')).toEqual([1.6, 1.8, 3.2, 4.1]); // 原文「1.,8e」
  });

  it('denver 題的四個月齡逐格對 Jimma Table 3，而且由小到大', () => {
    const rows = T1_PASS_RATES.filter(r => r.source === 'denver');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect([r.questionId, [...r.ages]]).toEqual([r.questionId, jimma.get(r.code)]);
      for (let i = 1; i < 4; i++) expect(r.ages[i]).toBeGreaterThan(r.ages[i - 1]);
    }
  });

  it('denver 題在 Table 3 的月齡上，機率就是那一欄的百分比（落在年齡段裡的那幾格）', () => {
    let checked = 0;
    for (const r of T1_PASS_RATES) {
      if (r.source !== 'denver') continue;
      const band = questions.find(q => q.id === r.questionId)!.band;
      r.ages.forEach((age, i) => {
        if (age < band.minAge || age > band.maxAge) return;
        expect(passProbability(r.questionId, age)).toBeCloseTo([0.25, 0.5, 0.75, 0.9][i], 10);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('cdc 題在里程碑的月齡上約七成五做得到（落在年齡段裡的）', () => {
    let checked = 0;
    for (const r of T1_PASS_RATES) {
      if (r.source !== 'cdc') continue;
      const band = questions.find(q => q.id === r.questionId)!.band;
      if (r.ageMonths < band.minAge || r.ageMonths > band.maxAge) continue;
      expect(passProbability(r.questionId, r.ageMonths)).toBeCloseTo(0.75, 10);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('ai 題在段頭、段尾就是表上寫的兩個數', () => {
    const row = T1_PASS_RATES.find(r => r.questionId === 't1_d_02');
    expect(row).toMatchObject({ source: 'ai', atMin: 0.55, atMax: 0.9 });
    expect(passProbability('t1_d_02', 72)).toBeCloseTo(0.55, 10);
    expect(passProbability('t1_d_02', 119)).toBeCloseTo(0.9, 10);
    expect(passProbability('t1_d_02', 200)).toBeCloseTo(0.9, 10); // 段外夾回段尾
  });
});
