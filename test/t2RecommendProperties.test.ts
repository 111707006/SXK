import { describe, it, expect } from 'vitest';
import { bandOf, recommend } from '../src/t2/recommend/engine';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import type { DxCode, KeyTag, Level, RecommendInput } from '../src/t2/recommend/types';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode } from '../src/t2/types';

/**
 * 客規 §14 驗收清單 V3–V13 寫成性質測試：月齡 12–216 × 抽樣的等級組合 × 診斷 × 上學 × 標籤。
 * V12（早產矯正月齡）在引擎外面算（輸入的 ageM 已經是矯正過的），測在 R1 的輸入組裝。
 */

const DXS: DxCode[][] = [[], ['LDADHD'], ['ASD'], ['GDD'], ['CP'], ['EMO'], ['LANG'], ['ASD', 'LANG']];

/** 決定性的偽亂數（同一組種子每次一樣）。 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function samples(): RecommendInput[] {
  const out: RecommendInput[] = [];
  const r = rng(20261007);
  for (let ageM = 12; ageM <= 216; ageM += 1) {
    for (let k = 0; k < 6; k++) {
      const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, (r() < 0.55 ? 0 : Math.floor(r() * 4)) as Level])) as Record<DimensionCode, Level>;
      const rfdims = DIMENSION_CODES.filter(d => levels[d] >= 2 && r() < 0.2);
      const extraTags: KeyTag[] = r() < 0.15 ? ['TIC'] : [];
      if (r() < 0.1) extraTags.push('SAFETY');
      out.push({
        ageM,
        levels,
        rfdims,
        items: {},
        dx: DXS[Math.floor(r() * DXS.length)],
        school: r() < 0.7,
        done: r() < 0.2 ? ['SXK-QOL', 'SXK-LQ'] : [],
        extraTags,
        hearingChecked: r() < 0.5,
      });
    }
  }
  return out;
}

const SAMPLES = samples();
const T = RECOMMEND_CONFIG.tools;

describe('客規 §14 驗收清單', () => {
  it('V3：每一份量表的月齡都在範圍內；最多 5 份；NO_T2 是 0 份', () => {
    const bad: string[] = [];
    for (const input of SAMPLES) {
      const r = recommend(input);
      if (r.status === 'NO_T2' && r.tools.length !== 0) bad.push(`${input.ageM} NO_T2 有量表`);
      if (r.tools.length > 5) bad.push(`${input.ageM} ${r.tools.length} 份`);
      for (const t of r.tools) if (input.ageM < T[t.code].minM || input.ageM > T[t.code].maxM) bad.push(`${input.ageM} ${t.code}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  // 客規寫「推荐份数 3–5」，但它自己的補足清單只有 QOL／ASQ3／ADP／ADL 四支：近 3 個月做過其中幾支、或年齡過了 84 個月
  // （ASQ3、ADP 都不收）時，照它的演算法就是補不到 3 份。這裡只驗「近 3 個月沒做過量表」的 24 個月以上；其餘列在待問表 R-13。
  it('V3：推薦時（24 個月以上、近 3 個月沒做過量表、84 個月以下）至少 3 份', () => {
    const bad = SAMPLES.filter(i => i.ageM >= 24 && i.ageM <= 84 && i.done.length === 0)
      .map(i => ({ i, r: recommend(i) }))
      .filter(x => x.r.status === 'RECOMMEND' && x.r.tools.length < 3)
      .map(x => `${x.i.ageM} ${x.i.dx.join('+')} → ${x.r.tools.map(t => t.code).join(',')}`);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('V4／V5：沒上學不出只能教師填的、未滿 132 個月不出只能本人填的（每一份都留得下可用的填寫人）', () => {
    for (const input of SAMPLES) {
      for (const t of recommend(input).tools) {
        expect(t.rater.length, `${input.ageM} ${t.code}`).toBeGreaterThan(0);
        if (!input.school || input.ageM < 36) expect(t.rater).not.toContain('T');
        if (input.ageM < 132) expect(t.rater).not.toContain('S');
      }
    }
  });

  it('V6：同組上限（感覺、學習、跨領域非全面落後各 1；語言、注意力 2；社交 2、ASD 3）', () => {
    for (const input of SAMPLES) {
      const r = recommend(input);
      const glob = DIMENSION_CODES.filter(d => input.levels[d] >= 2).length >= 5;
      const count = (g: string) => r.tools.filter(t => T[t.code].group === g).length;
      expect(count('SENG')).toBeLessThanOrEqual(1);
      expect(count('LRNG')).toBeLessThanOrEqual(1);
      expect(count('BROAD')).toBeLessThanOrEqual(glob ? 2 : 1);
      expect(count('LANGG')).toBeLessThanOrEqual(2);
      expect(count('ATTG')).toBeLessThanOrEqual(2);
      expect(count('SOCG')).toBeLessThanOrEqual(input.dx.includes('ASD') ? 3 : 2);
    }
  });

  it('V7：近 3 個月做過的不再出現', () => {
    for (const input of SAMPLES.filter(i => i.done.length > 0)) {
      for (const t of recommend(input).tools) expect(input.done).not.toContain(t.code);
    }
  });

  it('V8：家長端合計 ≤ 90，除非剩下的都不能移除', () => {
    for (const input of SAMPLES) {
      const r = recommend(input);
      if (r.parentMinutes > 90) expect(r.tools.length <= 3 || r.tools.every(t => t.mandatory), `${input.ageM}`).toBe(true);
    }
  });

  it('V9：安全題 → 第一條提示是安全轉介；SXK-EMO 年齡合適時必定出現', () => {
    for (const input of SAMPLES.filter(i => i.extraTags.includes('SAFETY'))) {
      const r = recommend(input);
      expect(r.alerts[0]?.type).toBe('SAFETY');
      if (r.status === 'RECOMMEND' && input.ageM >= 36 && input.ageM <= 155) expect(r.tools.map(t => t.code)).toContain('SXK-EMO');
    }
  });

  it('V10：九項未見明顯而且沒有診斷 → NO_T2', () => {
    const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
    for (const ageM of [12, 30, 60, 100, 180]) {
      expect(recommend({ ageM, levels, rfdims: [], items: {}, dx: [], school: true, done: [], extraTags: [], hearingChecked: null }).status).toBe('NO_T2');
    }
  });

  // 客規寫「仍推荐 3 份（诊断核心＋基线）」，但照它 §9.2 第 9 步，診斷核心的維度都要「深度」第二份 —— 演算法給的會多於 3。
  // 驗「至少 3 份」，差異列在待問表 R-13。
  it('V11：有診斷但 T1 全部正常 → 仍推薦，至少 3 份', () => {
    const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
    for (const dx of ['ASD', 'GDD', 'CP', 'LANG'] as const) {
      const r = recommend({ ageM: 48, levels, rfdims: [], items: {}, dx: [dx], school: true, done: [], extraTags: [], hearingChecked: null });
      expect(r.status, dx).toBe('RECOMMEND');
      expect(r.tools.length, dx).toBeGreaterThanOrEqual(3);
    }
  });

  it('V13：年齡段邊界（23/24、47/48、71/72、119/120）', () => {
    expect([23, 24, 47, 48, 71, 72, 119, 120].map(bandOf)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E']);
  });

  it('V13：量表切換邊界（SP 59／SPb 60、LDP 143／LDS 144 的首選、ASQ3 66/67）', () => {
    const base = (ageM: number, over: Partial<Record<DimensionCode, Level>>): RecommendInput => ({
      ageM,
      levels: { ...(Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>), ...over },
      rfdims: [],
      items: {},
      dx: [],
      school: true,
      done: [],
      extraTags: [],
      hearingChecked: null,
    });
    const codes = (ageM: number, over: Partial<Record<DimensionCode, Level>>) => recommend(base(ageM, over)).tools.map(t => t.code);
    expect(codes(59, { SEN: 2 })).toContain('SXK-SP');
    expect(codes(60, { SEN: 2 })).toContain('SXK-SPb');
    expect(codes(143, { LEARN: 2 })[0]).toBe('SXK-LDP');
    expect(codes(144, { LEARN: 2 })[0]).toBe('SXK-LDS');
    expect(codes(66, { MOT: 2 })).toContain('SXK-GM');
  });
});
