import { describe, it, expect } from 'vitest';
import { recommend } from '../src/t2/recommend/engine';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import type { DxCode, KeyTag, Level, RecommendInput } from '../src/t2/recommend/types';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode } from '../src/t2/types';

/**
 * 每維一份（ADR-0011，`onePerDimension`）：月齡 12–216 × 抽樣的等級、紅旗、標籤、診斷、上學，逐份檢查。
 * 客規的預設模式另有逐格測試（`t2RecommendGolden`、`t2RecommendCases`、`t2RecommendProperties`），這裡不重複。
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const DXS: DxCode[][] = [[], ['ASD'], ['LDADHD'], ['GDD'], ['ASD', 'LANG']];

function samples(): RecommendInput[] {
  const out: RecommendInput[] = [];
  const r = rng(20261008);
  for (let ageM = 12; ageM <= 216; ageM += 1) {
    for (let k = 0; k < 6; k++) {
      const levels = Object.fromEntries(DIMENSION_CODES.map(d => [d, (r() < 0.55 ? 0 : Math.floor(r() * 4)) as Level])) as Record<DimensionCode, Level>;
      const rfdims = DIMENSION_CODES.filter(d => levels[d] >= 2 && r() < 0.25);
      const extraTags: KeyTag[] = r() < 0.2 ? ['TIC'] : [];
      if (r() < 0.15) extraTags.push('SAFETY');
      if (r() < 0.2) extraTags.push('ASD_SIG');
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
const one = (i: RecommendInput) => recommend(i, RECOMMEND_CONFIG, { onePerDimension: true });

describe('每維一份', () => {
  it('沒有深度、補足、生活質量基線、診斷必選；規則只剩全面落後的跨領域量表', () => {
    for (const input of SAMPLES) {
      for (const t of one(input).tools) {
        expect(['depth', 'fill', 'base', 'dx'], `${input.ageM} ${t.code}`).not.toContain(t.cls);
        if (t.cls === 'rule') expect(['SXK-ASQ3', 'SXK-ADP'], `${input.ageM}`).toContain(t.code);
      }
    }
  });

  it('不推 M-CHAT、抽動量表；社交的那一份照一般首選順序', () => {
    for (const input of SAMPLES) {
      const codes = one(input).tools.map(t => t.code);
      expect(codes).not.toContain('M-CHAT-R/F');
      expect(codes).not.toContain('SXK-TIC');
    }
  });

  it('每個維度最多一份主測它的問卷', () => {
    for (const input of SAMPLES) {
      const tools = one(input).tools;
      for (const d of DIMENSION_CODES) {
        const n = tools.filter(t => RECOMMEND_CONFIG.tools[t.code].primary.includes(d)).length;
        expect(n, `${input.ageM} ${d} ${tools.map(t => t.code).join(',')}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('被標記的維度都有著落：有一份涵蓋它，或列在缺口', () => {
    for (const input of SAMPLES) {
      const rec = one(input);
      if (rec.status === 'NO_T2') continue;
      for (const { dim } of rec.dimQueue) {
        const covered = rec.tools.some(t => t.dim === dim || RECOMMEND_CONFIG.tools[t.code].primary.includes(dim));
        const gap = rec.gapDims.some(g => g.dim === dim);
        expect(covered || gap, `${input.ageM} ${dim}`).toBe(true);
      }
    }
  });

  it('觸發了哪些規則照樣回在 tags（入口與報告改出提示）；診斷一律不算', () => {
    for (const input of SAMPLES) {
      const rec = one(input);
      for (const t of input.extraTags) expect(rec.tags).toContain(t);
      expect(rec.alerts.some(a => a.type === 'DX_AGE')).toBe(false);
    }
  });

  it('預設模式照客規：同一份輸入會推 M-CHAT 的，每維一份就不推', () => {
    const input = SAMPLES.find(i => recommend(i).tools.some(t => t.code === 'M-CHAT-R/F'))!;
    expect(input).toBeDefined();
    expect(one(input).tools.some(t => t.code === 'M-CHAT-R/F')).toBe(false);
  });
});
