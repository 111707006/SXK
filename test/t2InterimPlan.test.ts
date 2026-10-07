import { describe, it, expect } from 'vitest';
import { DIS_ROUTES, planT2, notScreened, routeFor } from '../src/t2/routing';
import { singleFormPlan } from '../src/t2/interimPlan';
import { DIMENSION_CODES, type DimensionCode, type T1Flag } from '../src/t2/types';

/**
 * T2 題量的暫行規則（`src/t2/interimPlan.ts`，使用者 2026-09-29）：客戶「每維度每年齡一個表單」的表來之前，
 * 每個被 T1 標記的維度只列一份（那個維度的星號工具）、全部必做；選做、加測、補充問卷、診斷方向多加的都不出。
 *
 * 用窮舉釘性質，不抄某一格：0–216 個月、十種診斷方向（含沒選）、每種月齡配三組 T1 標記。
 */

const flagsOf = (pick: (d: DimensionCode, i: number) => T1Flag) =>
  Object.fromEntries(DIMENSION_CODES.map((d, i) => [d, pick(d, i)])) as Record<DimensionCode, T1Flag>;
const FLAG_SETS = [
  flagsOf(() => 2),
  flagsOf(() => 1),
  flagsOf((_d, i) => ([0, 1, 2] as const)[i % 3]),
];
// 畫面上的診斷方向 2026-09-29 拿掉了，規則引擎仍收這個參數（客戶的表）；照樣窮舉，證明暫行規則不管它。
const DIAGNOSES = [null, ...(Object.keys(DIS_ROUTES) as Array<keyof typeof DIS_ROUTES>)];

describe('每個被標記的維度一份、全部必做', () => {
  it('窮舉月齡 × 診斷方向 × T1 標記：性質都成立', () => {
    let checked = 0;
    for (let age = 0; age <= 216; age += 1) {
      for (const flags of FLAG_SETS) {
        for (const dx of DIAGNOSES) {
          const full = planT2(flags, age, dx);
          const plan = singleFormPlan(full, flags);
          checked += 1;

          // 只剩必做
          expect(plan.optional).toEqual([]);
          expect(plan.followup).toEqual([]);
          expect(plan.extras).toEqual([]);
          expect(plan.required.every(i => i.role === 'required')).toBe(true);

          // 每個被標記、有評、有星號的維度剛好一份，就是它的星號；沒被標記的維度不出現
          const covered = plan.required.flatMap(i => i.forDimensions);
          expect(new Set(covered).size).toBe(covered.length);
          for (const d of DIMENSION_CODES) {
            const star = flags[d] === 0 || notScreened(d, age) ? null : routeFor(d, age).star;
            const holder = plan.required.find(i => i.forDimensions.includes(d));
            if (star === null) expect(holder).toBeUndefined();
            else expect(holder?.toolId).toBe(star);
          }

          // 其餘照原樣：沒有工具的維度、功能處理順序、題數
          expect(plan.noTool).toEqual(full.noTool);
          expect(plan.functionOrder).toEqual(full.functionOrder);
          expect(plan.estimatedItems).toEqual({
            required: plan.required.reduce((n, i) => n + i.askedCount, 0), optional: 0, followup: 0,
          });
        }
      }
    }
    expect(checked).toBe(217 * FLAG_SETS.length * DIAGNOSES.length);
  }, 30_000); // 窮舉：單跑 2 秒，全套滿載時會超過預設 5 秒

  it('不改傳進來的那一份（規則引擎的結果照舊可以拿去用）', () => {
    const flags = FLAG_SETS[2];
    const full = planT2(flags, 48, 'asd');
    const before = JSON.stringify(full);
    singleFormPlan(full, flags);
    expect(JSON.stringify(full)).toBe(before);
  });
});
