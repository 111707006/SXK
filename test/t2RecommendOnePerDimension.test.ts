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

describe('分齡發育綜合評估合併（使用者 2026-10-08）', () => {
  const LV0 = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
  const base = (over: Partial<RecommendInput>): RecommendInput => ({
    ageM: 40, levels: LV0, rfdims: [], items: {}, dx: [], school: true, done: [], extraTags: [], hearingChecked: true, ...over,
  });
  const yellow3 = { MOT: 1, LANG: 1, COG: 1, SOC: 0 } as const;
  const lv = (m: Partial<Record<DimensionCode, Level>>) => ({ ...LV0, ...m });

  it('四個裡 3 個黃燈、沒有紅燈：一份分齡發育綜合評估涵蓋，不再各推一份', () => {
    const rec = one(base({ levels: lv({ MOT: 1, LANG: 1, COG: 1 }), t1Colors: yellow3 }));
    const codes = rec.tools.map(t => t.code);
    expect(codes).toContain('SXK-ASQ3');
    for (const c of ['SXK-GM', 'SXK-LQ', 'SXK-LANG', 'SXK-ADP', 'SXK-SOC']) expect(codes).not.toContain(c);
  });

  it('有一個紅燈：不合併，照每維一份', () => {
    const rec = one(base({ levels: lv({ MOT: 2, LANG: 1, COG: 1 }), t1Colors: { ...yellow3, MOT: 2 } }));
    expect(rec.tools.find(t => t.cls === 'rule' && t.code === 'SXK-ASQ3')).toBeUndefined();
    expect(rec.tools.map(t => t.code)).toContain('SXK-GM');
  });

  it('只有 2 個黃燈：不合併', () => {
    const rec = one(base({ levels: lv({ MOT: 1, LANG: 1 }), t1Colors: { MOT: 1, LANG: 1, COG: 0, SOC: 0 } }));
    expect(rec.tools.find(t => t.cls === 'rule' && t.code === 'SXK-ASQ3')).toBeUndefined();
  });

  it('66 個月以上（超過分齡發育綜合評估的年齡）：不合併', () => {
    const rec = one(base({ ageM: 70, levels: lv({ MOT: 1, LANG: 1, COG: 1 }), t1Colors: yellow3 }));
    expect(rec.tools.map(t => t.code)).not.toContain('SXK-ASQ3');
  });

  it('客規預設模式不套這一條', () => {
    const rec = recommend(base({ levels: lv({ MOT: 1, LANG: 1, COG: 1 }), t1Colors: yellow3 }));
    expect(rec.tools.find(t => t.reason.startsWith('合并'))).toBeUndefined();
  });
});

describe('畫面顏色是「有沒有被標記」的準（使用者 2026-10-08）', () => {
  const LV0 = Object.fromEntries(DIMENSION_CODES.map(d => [d, 0])) as Record<DimensionCode, Level>;
  const base = (over: Partial<RecommendInput>): RecommendInput => ({
    ageM: 30, levels: LV0, rfdims: [], items: {}, dx: [], school: false, done: [], extraTags: [], hearingChecked: true, ...over,
  });
  const dimsOf = (rec: ReturnType<typeof one>) => new Set(rec.tools.flatMap(t => RECOMMEND_CONFIG.tools[t.code].primary));

  // 展示站實測：語言 7 分，首頁黃燈「进入深测」，引擎「未见明显」→ 推薦裡沒有語言
  it('語言畫面黃、引擎未见明显：每維一份照樣推一份語言', () => {
    const rec = one(base({ levels: { ...LV0, MOT: 2 }, t1Colors: { MOT: 2, LANG: 1 } }));
    expect(dimsOf(rec).has('LANG')).toBe(true);
    expect(dimsOf(rec).has('MOT')).toBe(true);
  });

  it('只往上墊：畫面綠、引擎因紅旗題有等級的照舊推', () => {
    const rec = one(base({ levels: { ...LV0, MOT: 2 }, t1Colors: { MOT: 0 } }));
    expect(dimsOf(rec).has('MOT')).toBe(true);
  });

  it('全綠、引擎也沒有等級 → NO_T2', () => {
    expect(one(base({ t1Colors: { MOT: 0, LANG: 0 } })).status).toBe('NO_T2');
  });

  it('客規預設模式不套（逐格測試照舊）', () => {
    const rec = recommend(base({ levels: { ...LV0, MOT: 2 }, t1Colors: { MOT: 2, LANG: 1 } }));
    expect(rec.dimQueue.map(q => q.dim)).not.toContain('LANG');
  });
});
