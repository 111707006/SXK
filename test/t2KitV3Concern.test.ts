import { describe, it, expect } from 'vitest';
import { askedItems, formFor, scoreKitV3, type ConcernScoring, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as ASB } from '../src/t2/kitv3/sxk-asb';
import { BANK as ASR } from '../src/t2/kitv3/sxk-asr';
import { BANK as QOL } from '../src/t2/kitv3/sxk-qol';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * 關切率族（ASB、ASR）與 QOL（T2 v3 題庫規格 §4.2；頁面公式見各配方檔頭）。
 * 期望值照頁面 `stat`（÷ 題數×3）、`levelFor`（p ≤ hi）、倒退 → 最差段；QOL 的 `secScore`／`formScore`、lo／hi 分段。
 */

const scored = (bank: KitV3Bank, ageM: number, ctx: { inSchool?: boolean } = {}) =>
  askedItems(bank, { ageM, ...ctx }).filter(a => a.section !== 'REG').map(a => a.item.key);

/** 計分題的總分剛好是 `sum`（先放 3、再放餘數），倒退全「没有」。 */
function withSum(bank: KitV3Bank, ageM: number, sum: number, over: Record<string, number | null> = {}, ctx: { inSchool?: boolean } = {}): KitV3Answers {
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM, ...ctx })) out[a.item.key] = 0;
  let left = sum;
  for (const k of scored(bank, ageM, ctx)) {
    const v = Math.min(3, left);
    out[k] = v;
    left -= v;
  }
  return { ...out, ...over };
}

/** 讓 ％ 剛好是 target 的總分；做不到回 null。 */
function sumFor(n: number, target: number): number | null {
  for (let s = 0; s <= n * 3; s++) if (Math.round((s / (n * 3)) * 100) === target) return s;
  return null;
}

describe('SXK-ASB', () => {
  it('家長版 63 題；盤點逐月：18 月 46、24 月 49、36 月 61、48 月 63', () => {
    expect([18, 24, 36, 48].map(m => scored(ASB, m).length)).toEqual([46, 49, 61, 63]);
    expect(ASB.forms[0].sections[0].key).toBe('REG');
  });

  it.each([
    [22, 0, 0],
    [23, 1, 1],
    [40, 1, 1],
    [41, 2, 3],
  ])('％ %i → 第 %i 段、0–3 是 %i（切點 22／40）', (pct, band, grade) => {
    const n = scored(ASB, 48).length;
    const s = sumFor(n, pct);
    expect(s, `${pct}`).not.toBeNull();
    const r = scoreKitV3(ASB, withSum(ASB, 48, s!), { ageM: 48 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({ SOC: grade });
  });

  it('能力倒退任一有 → 最差那段（％ 再低也一樣）', () => {
    const r = scoreKitV3(ASB, withSum(ASB, 48, 0, { 'reg.2': 1 }), { ageM: 48 });
    expect(r.total.band).toBe(2);
    expect(r.grade03).toEqual({ SOC: 3 });
    expect(r.flags).toEqual(['regression']);
  });

  it('倒退四項必答', () => {
    const { 'reg.1': _, ...rest } = withSum(ASB, 48, 0);
    expect(scoreKitV3(ASB, rest, { ageM: 48 }).missing).toEqual(['reg.1']);
  });
});

describe('SXK-ASR', () => {
  it('24 題、每題 4 個行為錨點；多一個「不适用」（null）', () => {
    const items = ASR.forms[0].sections.filter(s => s.key !== 'REG').flatMap(s => s.items);
    expect(items).toHaveLength(24);
    expect(items.every(i => i.anchors?.length === 4)).toBe(true);
    expect(ASR.options.main.map(o => o.value)).toEqual([0, 1, 2, 3, null]);
  });

  // 24 題 × 3 ＝ 72，％ 只能是 100/72 的倍數四捨五入：總分 14→19、15→21、27→38、28→39（20 做不到，切點兩側用 19／21）
  it.each([
    [14, 19, 0],
    [15, 21, 1],
    [27, 38, 1],
    [28, 39, 2],
  ])('總分 %i → %i％ → 第 %i 段（切點 20／38）', (sum, pct, band) => {
    const r = scoreKitV3(ASR, withSum(ASR, 60, sum), { ageM: 60 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
  });

  it('「不适用」分子分母都不算', () => {
    const keys = scored(ASR, 60);
    const ans = withSum(ASR, 60, 0, Object.fromEntries(keys.map((k, i) => [k, i < 12 ? null : 3])));
    expect(scoreKitV3(ASR, ans, { ageM: 60 }).total.value).toBe(100);
  });

  it('不适用超過 12 題 → 不給結果（頁面也不給）', () => {
    const keys = scored(ASR, 60);
    const ans = withSum(ASR, 60, 0, Object.fromEntries(keys.slice(0, 13).map(k => [k, null])));
    const r = scoreKitV3(ASR, ans, { ageM: 60 });
    expect(r.grade03).toEqual({});
    expect(r.flags).toEqual(['too_many_na']);
  });

  it('切點來自頁面', () => {
    expect((ASR.scoring as ConcernScoring).levels.map(l => l.max)).toEqual([20, 38, 100]);
    expect((ASB.scoring as ConcernScoring).levels.map(l => l.max)).toEqual([22, 40, 100]);
  });
});

describe('SXK-QOL', () => {
  it('家長版依月齡挑表：24、59→P24；60→P57；96→P812；156、227→P1318', () => {
    expect([24, 59, 60, 96, 156, 227].map(m => formFor(QOL, m).key)).toEqual(['P24', 'P24', 'P57', 'P812', 'P1318', 'P1318']);
  });

  it('每份 29 題；沒上學不出「园所与学校生活」→ 23 題', () => {
    expect(scored(QOL, 36)).toHaveLength(29);
    expect(scored(QOL, 36, { inSchool: false })).toHaveLength(23);
  });

  it.each([
    [28, 0],
    [29, 1],
    [36, 1],
    [37, 2],
    [45, 2],
    [46, 3],
  ])('困擾率 %i → 第 %i 段；不出 0–3', (pct, band) => {
    const s = sumFor(29, pct);
    expect(s, `${pct}`).not.toBeNull();
    const r = scoreKitV3(QOL, withSum(QOL, 36, s!), { ageM: 36 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({});
  });
});
