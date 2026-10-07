import { describe, it, expect } from 'vitest';
import { askedItems, scoreKitV3, type ConcernScoring, type KitV3Answers } from '../src/t2/kitv3/score';
import { BANK as AB } from '../src/t2/kitv3/sxk-ab';
import { BANK as ATT } from '../src/t2/kitv3/sxk-att';
import type { KitV3Bank } from '../src/t2/kitv3/types';

/**
 * SXK-AB、SXK-ATT（T2 v3 題庫規格 §4.2；頁面公式見 `scripts/t2/kitv3-recipes/attention.ts` 檔頭）。
 * 期望值照頁面 `stat`／`formOverall`（÷ 題數×3）、`levelFor`（p ≤ hi）；功能影響要答、不改分段；ATT 的「无法观察」整段不算。
 */

const mainKeys = (bank: KitV3Bank, ageM: number, skip: string[] = []) => {
  const main = new Set(bank.forms[0].sections.filter(s => s.options === 'main' && !skip.includes(s.key)).map(s => s.key));
  return askedItems(bank, { ageM }).filter(a => main.has(a.section)).map(a => a.item.key);
};

/** 計分題的總分剛好是 `sum`（先放 3、再放餘數），功能影響全 0。 */
function withSum(bank: KitV3Bank, ageM: number, sum: number, over: Record<string, number | null> = {}, skip: string[] = []): KitV3Answers {
  const out: Record<string, number | null> = {};
  for (const a of askedItems(bank, { ageM })) out[a.item.key] = 0;
  let left = sum;
  for (const k of mainKeys(bank, ageM, skip)) {
    const v = Math.min(3, left);
    out[k] = v;
    left -= v;
  }
  return { ...out, ...over };
}

function sumFor(n: number, target: number): number {
  for (let s = 0; s <= n * 3; s++) if (Math.round((s / (n * 3)) * 100) === target) return s;
  throw new Error(`${n} 題湊不出 ${target}％`);
}

describe('SXK-AB', () => {
  it('家長版依月齡：36 月 29 題、48 月 41、60 月 48（盤點逐月）；36–47 月「组织与执行」不出', () => {
    expect([36, 48, 60].map(m => mainKeys(AB, m).length)).toEqual([29, 41, 48]);
    const r = scoreKitV3(AB, withSum(AB, 36, 0), { ageM: 36 });
    expect(r.facets.find(f => f.key === 'EF')).toMatchObject({ n: 0, value: null, band: null });
  });

  it.each([
    [33, 0, 0],
    [34, 1, 1],
    [50, 1, 1],
    [51, 2, 3],
  ])('％ %i → 第 %i 段、0–3 是 %i（切點 33／50）', (pct, band, grade) => {
    const r = scoreKitV3(AB, withSum(AB, 60, sumFor(48, pct)), { ageM: 60 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({ ATT: grade });
  });

  it('功能影響全「严重」也不改分段；但要答', () => {
    const imp = Object.fromEntries([1, 2, 3, 4, 5].map(i => [`imp.${i}`, 3]));
    expect(scoreKitV3(AB, withSum(AB, 60, 0, imp), { ageM: 60 }).grade03).toEqual({ ATT: 0 });
    const { 'imp.3': _, ...rest } = withSum(AB, 60, 0);
    expect(scoreKitV3(AB, rest, { ageM: 60 }).missing).toEqual(['imp.3']);
  });

  it('切點來自頁面', () => {
    expect((AB.scoring as ConcernScoring).levels.map(l => l.max)).toEqual([33, 50, 100]);
  });
});

describe('SXK-ATT', () => {
  it('家長版 6 情境：48–71 月 46 題、≥72 月 48 題（盤點）', () => {
    expect(ATT.forms[0].sections.filter(s => s.options === 'main').map(s => s.key)).toEqual(['CL', 'HW', 'HM', 'IP', 'SM', 'OU']);
    expect([48, 71, 72].map(m => mainKeys(ATT, m).length)).toEqual([46, 46, 48]);
  });

  it('課堂、作業可以勾「无法观察」，未滿 72 月換學前的名稱', () => {
    const [cl, hw] = ATT.forms[0].sections;
    expect([cl.naLabel, hw.naLabel]).toEqual(['这个情境无法观察', '这个情境无法观察']);
    expect(cl.preName).toEqual({ belowM: 72, name: '集体活动情境（幼儿园）' });
    expect(ATT.forms[0].sections.filter(s => s.naLabel)).toHaveLength(2);
  });

  it.each([
    [25, 0, 0],
    [26, 1, 1],
    [42, 1, 1],
    [43, 2, 3],
  ])('％ %i → 第 %i 段、0–3 是 %i（切點 25／42）', (pct, band, grade) => {
    const r = scoreKitV3(ATT, withSum(ATT, 72, sumFor(48, pct)), { ageM: 72 });
    expect([r.total.value, r.total.band]).toEqual([pct, band]);
    expect(r.grade03).toEqual({ ATT: grade });
  });

  it('勾了「无法观察」：那一段不算缺答、分子分母都不算', () => {
    const ans = withSum(ATT, 72, 0, { 'CL.na': 1 }, ['CL']);
    const cl = mainKeys(ATT, 72).filter(k => k.startsWith('CL.'));
    for (const k of cl) delete (ans as Record<string, unknown>)[k];
    const rest = mainKeys(ATT, 72, ['CL']);
    // 其餘 40 題全 3 → 100％；CL 沒答也不缺
    const full = { ...ans, ...Object.fromEntries(rest.map(k => [k, 3])) };
    const r = scoreKitV3(ATT, full, { ageM: 72 });
    expect(r.missing).toEqual([]);
    expect(r.total.value).toBe(100);
    expect(r.facets.map(f => f.key)).not.toContain('CL');
  });

  it('沒勾就不能略過：CL 沒答 → 缺答', () => {
    const ans: Record<string, number | null> = { ...withSum(ATT, 72, 0) };
    delete ans['CL.1'];
    expect(scoreKitV3(ATT, ans, { ageM: 72 }).missing).toEqual(['CL.1']);
  });

  it('「无法观察」只認能勾的段（居家勾了不算）', () => {
    const ans: Record<string, number | null> = { ...withSum(ATT, 72, 0), 'HM.na': 1 };
    delete ans['HM.1'];
    expect(scoreKitV3(ATT, ans, { ageM: 72 }).missing).toEqual(['HM.1']);
  });

  it('切點來自頁面', () => {
    expect((ATT.scoring as ConcernScoring).levels.map(l => l.max)).toEqual([25, 42, 100]);
  });
});
