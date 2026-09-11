import { describe, it, expect } from 'vitest';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { TOOL_SPECS, TOOL_FEEDS, inWindow, feedsDimension, sectionsFor } from '../src/t2/toolSpecs';
import { isCaveat } from '../src/t2/caveats';
import type { DimensionCode, ScoringFamily } from '../src/t2/types';

/**
 * 工具登錄表的結構測試（#42，規格 v2 §3、§5.2、§5.4、§5.9、附錄 F）。
 *
 * 【為什麼需要這些】
 * 登錄表是 22 × 十幾個欄位的一張表。抄錯一格不會有型別錯誤：月齡窗口抄成別支的，
 * 結果是某個年齡的孩子拿到一份他答不出來的量表；`feeds` 多一個維度，結果是一份
 * 感覺量表把認知那一格推紅然後配了一批感覺活動。
 *
 * 下面的表全部是從規格**重新抄一次**的，不是從 `toolSpecs.ts` 讀出來的。
 */

function spec(id: ToolId) {
  return TOOL_SPECS[id];
}

describe('登錄表：22 筆（§3）', () => {
  it('22 支，順序照登錄表，與題庫同一組 id', () => {
    expect(Object.keys(TOOL_SPECS)).toEqual([...TOOL_IDS]);
    expect(Object.keys(TOOL_SPECS)).toHaveLength(22);
    for (const id of TOOL_IDS) expect(spec(id).id).toBe(id);
  });

  it('code 取自題庫，不另抄一次', () => {
    for (const id of TOOL_IDS) expect(spec(id).code).toBe(TOOLKIT[id].code);
  });

  it('22 支全部由家長施測，版本全是 kit-20260908', () => {
    // T2 沒有治療師在場：家長自行施測，程式碼裡的「施測者」就是家長
    for (const id of TOOL_IDS) {
      expect(spec(id).parentDoable).toBe(true);
      expect(spec(id).toolkitVersion).toBe('kit-20260908');
    }
  });
});

describe('登錄表：月齡窗口與 §3 逐支相符', () => {
  /** §3 表格的「月齡」欄，閉區間。 */
  const SPEC_WINDOW: Record<ToolId, [number, number]> = {
    'sxk-dev': [0, 72], 'sxk-warn': [3, 84], 'mchat-rf': [16, 30], 'sxk-gm': [6, 72],
    'sxk-soc': [12, 72], 'sxk-lang': [12, 72], 'sxk-adp': [18, 72], 'sxk-voc': [12, 42],
    'sxk-asq': [36, 42], 'sxk-asb': [18, 180], 'sxk-asr': [24, 180], 'sxk-ab': [36, 192],
    'sxk-att': [60, 180], 'snap-iv': [72, 216], 'chexi': [48, 155], 'sxk-spa': [24, 71],
    'sxk-spb': [60, 180], 'sxk-adl': [30, 180], 'sxk-ldp': [72, 144], 'sxk-lds': [144, 216],
    'sxk-tempa': [12, 36], 'sxk-tempb': [36, 84],
  };

  it('逐支相符', () => {
    for (const id of TOOL_IDS) {
      const [lo, hi] = SPEC_WINDOW[id];
      expect({ id, ...spec(id).windowMonths }).toEqual({ id, lo, hi });
    }
  });

  it('窗口是閉區間，兩端都算在內', () => {
    expect(inWindow('sxk-spa', 24)).toBe(true);
    expect(inWindow('sxk-spa', 71)).toBe(true);
    expect(inWindow('sxk-spa', 23)).toBe(false);
    expect(inWindow('sxk-spa', 72)).toBe(false);
    // spa 到 71、spb 從 60 起，60–71 兩支都在窗口內（§4.2 的候選順序處理重疊）
    expect(inWindow('sxk-spb', 60)).toBe(true);
  });

  it('每支的窗口都合法（lo ≤ hi，且不超過 216 個月）', () => {
    for (const id of TOOL_IDS) {
      const { lo, hi } = spec(id).windowMonths;
      expect(lo).toBeLessThanOrEqual(hi);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(216);
    }
  });
});

describe('登錄表：計分族與最少題數（§5.2）', () => {
  /** §5.2 的十族，每族的成員。 */
  const SPEC_FAMILY: Record<ScoringFamily, ToolId[]> = {
    achievement: ['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq'],
    pass: ['sxk-dev'],
    independence: ['sxk-adl'],
    concern: ['sxk-asb', 'sxk-asr', 'sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb'],
    total: ['sxk-ldp', 'sxk-lds'],
    'mean-snap': ['snap-iv'],
    'mean-chexi': ['chexi'],
    risk: ['mchat-rf'],
    positive: ['sxk-warn'],
    profile: ['sxk-tempa', 'sxk-tempb'],
  };

  it('十族，22 支剛好分完，沒有一支跨兩族', () => {
    expect(Object.keys(SPEC_FAMILY)).toHaveLength(10);
    const seen = new Set<ToolId>();
    for (const [family, ids] of Object.entries(SPEC_FAMILY)) {
      for (const id of ids) {
        expect({ id, family: spec(id).family }).toEqual({ id, family });
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(22);
  });

  it('minItems 依族：達成率 3、獨立率 2、其餘 1', () => {
    for (const id of TOOL_IDS) {
      const family = spec(id).family;
      const expected = family === 'achievement' ? 3 : family === 'independence' ? 2 : 1;
      expect({ id, minItems: spec(id).minItems }).toEqual({ id, minItems: expected });
    }
  });

  it('與題庫自己抽出來的 MIN_ITEMS 不衝突', () => {
    // 題庫只有達成率六支與 adl 有這一欄；有的話兩邊必須一致
    for (const id of TOOL_IDS) {
      const fromKit = TOOLKIT[id].minItems;
      if (fromKit !== undefined) expect({ id, fromKit }).toEqual({ id, fromKit: spec(id).minItems });
    }
  });
});

describe('登錄表：feeds 與附錄 F 逐支相符', () => {
  /** 附錄 F 的機器可讀表，重抄一次。 */
  const SPEC_FEEDS: Record<ToolId, Array<{ dimension: DimensionCode; sections: string[] | 'overall' }>> = {
    'sxk-dev': [
      { dimension: 'MOT', sections: ['MOT'] }, { dimension: 'LANG', sections: ['LANG'] },
      { dimension: 'SOC', sections: ['SOC'] }, { dimension: 'ADL', sections: ['ADL'] },
      { dimension: 'COG', sections: ['COG'] },
    ],
    'sxk-warn': [
      { dimension: 'LANG', sections: ['i1'] }, { dimension: 'SOC', sections: ['i2'] },
      { dimension: 'MOT', sections: ['i3', 'i4'] },
    ],
    'mchat-rf': [{ dimension: 'SOC', sections: 'overall' }],
    'sxk-gm': [{ dimension: 'MOT', sections: 'overall' }],
    'sxk-soc': [{ dimension: 'SOC', sections: 'overall' }],
    'sxk-lang': [{ dimension: 'LANG', sections: 'overall' }],
    'sxk-adp': [{ dimension: 'COG', sections: 'overall' }],
    'sxk-voc': [{ dimension: 'LANG', sections: 'overall' }],
    'sxk-asq': [
      { dimension: 'LANG', sections: ['CO'] }, { dimension: 'MOT', sections: ['GM'] },
      { dimension: 'COG', sections: ['PS'] }, { dimension: 'SOC', sections: ['PE'] },
    ],
    'sxk-asb': [{ dimension: 'SOC', sections: 'overall' }],
    'sxk-asr': [{ dimension: 'SOC', sections: 'overall' }],
    'sxk-ab': [{ dimension: 'ATT', sections: 'overall' }],
    'sxk-att': [{ dimension: 'ATT', sections: 'overall' }],
    'snap-iv': [{ dimension: 'ATT', sections: ['IA', 'HI'] }, { dimension: 'EMO', sections: ['OD'] }],
    'chexi': [{ dimension: 'ATT', sections: 'overall' }],
    'sxk-spa': [{ dimension: 'SEN', sections: 'overall' }],
    'sxk-spb': [{ dimension: 'SEN', sections: 'overall' }],
    'sxk-adl': [{ dimension: 'ADL', sections: 'overall' }],
    'sxk-ldp': [{ dimension: 'LEARN', sections: 'overall' }],
    'sxk-lds': [{ dimension: 'LEARN', sections: 'overall' }],
    'sxk-tempa': [{ dimension: 'EMO', sections: 'overall' }],
    'sxk-tempb': [{ dimension: 'EMO', sections: 'overall' }],
  };

  it('逐支相符', () => {
    for (const id of TOOL_IDS) {
      expect({ id, feeds: spec(id).feeds }).toEqual({ id, feeds: SPEC_FEEDS[id] });
    }
    expect(TOOL_FEEDS).toEqual(SPEC_FEEDS);
  });

  it('面向 key 都是題庫真有的（warn 例外：它的 i1–i4 是時點內的位置）', () => {
    for (const id of TOOL_IDS) {
      if (id === 'sxk-warn') continue;
      const known = new Set(TOOLKIT[id].sections.map(s => s.key));
      for (const feed of spec(id).feeds) {
        if (feed.sections === 'overall') continue;
        for (const key of feed.sections) expect({ id, key, known: known.has(key) }).toEqual({ id, key, known: true });
      }
    }
  });

  it('比中控台窄：附錄 C 拿掉的那些對應一個都沒有回流', () => {
    // 這幾格是中控台 TOOL2DIM 有、本規格明確不採的（附錄 C）
    expect(feedsDimension('sxk-adp', 'SEN')).toBe(false);
    expect(feedsDimension('sxk-adp', 'LEARN')).toBe(false);
    expect(feedsDimension('sxk-soc', 'ADL')).toBe(false);
    expect(feedsDimension('sxk-soc', 'EMO')).toBe(false);
    expect(feedsDimension('sxk-asb', 'LANG')).toBe(false);
    expect(feedsDimension('sxk-asb', 'EMO')).toBe(false);
    expect(feedsDimension('sxk-ab', 'LEARN')).toBe(false);
    expect(feedsDimension('sxk-att', 'LEARN')).toBe(false);
    expect(feedsDimension('chexi', 'LEARN')).toBe(false);
    expect(feedsDimension('sxk-ldp', 'ATT')).toBe(false);
    expect(feedsDimension('sxk-asq', 'EMO')).toBe(false);
    expect(feedsDimension('sxk-adl', 'MOT')).toBe(false);
    expect(feedsDimension('sxk-adl', 'EMO')).toBe(false);
    expect(feedsDimension('sxk-adl', 'SOC')).toBe(false);
    expect(feedsDimension('sxk-spa', 'COG')).toBe(false);
    expect(feedsDimension('sxk-spb', 'COG')).toBe(false);
  });

  it('多維度工具的每個維度各拿自己那組面向', () => {
    expect(sectionsFor('snap-iv', 'ATT')).toEqual(['IA', 'HI']);
    expect(sectionsFor('snap-iv', 'EMO')).toEqual(['OD']);
    expect(sectionsFor('sxk-asq', 'COG')).toEqual(['PS']);
    // asq 有 FM 面向，但 FM 不餵任何維度（§5.9「FM 不出 band」）—— 它只出標籤
    const asqSections = TOOL_FEEDS['sxk-asq'].flatMap(f => (f.sections === 'overall' ? [] : f.sections));
    expect(asqSections).toEqual(['CO', 'GM', 'PS', 'PE']);
    expect(asqSections).not.toContain('FM');
    expect(TOOLKIT['sxk-asq'].sections.map(s => s.key)).toContain('FM');
    expect(sectionsFor('sxk-gm', 'MOT')).toBe('overall');
  });

  it('九個維度每個都至少有一支工具餵（§4.5 的洞是月齡上的，不是維度上的）', () => {
    const dims: DimensionCode[] = ['COG', 'LANG', 'SOC', 'EMO', 'ATT', 'MOT', 'SEN', 'ADL', 'LEARN'];
    for (const dim of dims) {
      const fed = TOOL_IDS.filter(id => feedsDimension(id, dim));
      expect({ dim, some: fed.length > 0 }).toEqual({ dim, some: true });
    }
  });
});

describe('登錄表：出不出 band、進不進路由（§5.4、§4.6）', () => {
  it('producesBand 只有 chexi、tempa、tempb 為否', () => {
    const noBand = TOOL_IDS.filter(id => !spec(id).producesBand);
    expect(noBand).toEqual(['chexi', 'sxk-tempa', 'sxk-tempb']);
  });

  it('routed 只有 sxk-warn 為否', () => {
    const notRouted = TOOL_IDS.filter(id => !spec(id).routed);
    expect(notRouted).toEqual(['sxk-warn']);
  });

  it('不出 band 的三支仍然有 feeds —— 標籤要知道歸哪個維度', () => {
    for (const id of ['chexi', 'sxk-tempa', 'sxk-tempb'] as const) {
      expect(spec(id).feeds.length).toBeGreaterThan(0);
    }
  });
});

describe('登錄表：分段與前置題取自題庫（§5.3、§5.1）', () => {
  it('tiers 就是題庫那一份，不是另抄的', () => {
    for (const id of TOOL_IDS) expect(spec(id).tiers).toBe(TOOLKIT[id].tiers);
  });

  it('抽查幾支的切點，確認取到的是報告分段而不是 postMessage 那一套', () => {
    // 附錄 D：報告分段是 85／70／55，postMessage 那一套是 80／70／60／40
    expect(spec('sxk-gm').tiers.map(t => t.min ?? null)).toEqual([85, 70, 55, 0]);
    expect(spec('sxk-adl').tiers.map(t => t.min ?? null)).toEqual([72, 58, 45, 0]);
    expect(spec('sxk-att').tiers.map(t => t.max ?? null)).toEqual([25, 33, 42, 100]);
    expect(spec('snap-iv').tiers.map(t => t.max ?? null)).toEqual([1.2, 1.8, null]);
    const all = JSON.stringify(TOOL_IDS.map(id => spec(id).tiers));
    expect(all).not.toContain('"min":80');
  });

  it('前置題就是題庫那一份，八支有前置題（§5.1 的六列，asb／asr 與 spa／spb 各佔一列）', () => {
    for (const id of TOOL_IDS) expect(spec(id).preQuestions).toBe(TOOLKIT[id].preQuestions);
    const withPre = TOOL_IDS.filter(id => spec(id).preQuestions.length > 0);
    expect(withPre).toEqual(['sxk-warn', 'mchat-rf', 'sxk-asb', 'sxk-asr', 'sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb']);
    expect(spec('sxk-asb').preQuestions[0].key).toBe('regression');
    expect(spec('sxk-att').preQuestions[0].key).toBe('duration');
    expect(spec('sxk-ab').preQuestions[0].key).toBe('settings');
    expect(spec('sxk-spa').preQuestions[0].key).toBe('impact');
    expect(spec('mchat-rf').preQuestions[0].key).toBe('concern');
  });

  it('spa／spb 的「沒有影響」與其餘互斥（§5.1）', () => {
    for (const id of ['sxk-spa', 'sxk-spb'] as const) {
      const impact = spec(id).preQuestions[0];
      expect(impact.options?.find(o => o.value === 'none')?.exclusive).toBe(true);
      expect(impact.options?.filter(o => o.exclusive)).toHaveLength(1);
    }
  });
});

describe('登錄表：固定 caveats（§5.9 右欄）', () => {
  /** §5.9 右欄裡無條件成立的那些，重抄一次。 */
  const SPEC_FIXED: Record<ToolId, string[]> = {
    'sxk-dev': ['unsourced_threshold', 'parent_administered_task', 'few_items'],
    'sxk-warn': [],
    'mchat-rf': [],
    'sxk-gm': ['unsourced_threshold', 'parent_administered_task'],
    'sxk-soc': ['unsourced_threshold', 'parent_administered_task'],
    'sxk-lang': ['unsourced_threshold', 'parent_administered_task'],
    'sxk-adp': ['unsourced_threshold', 'parent_administered_task'],
    'sxk-voc': ['unsourced_threshold'],
    'sxk-asq': ['unsourced_threshold', 'parent_administered_task', 'few_items', 'narrow_window'],
    'sxk-asb': ['unsourced_threshold'],
    'sxk-asr': ['unsourced_threshold', 'rater_role_parent'],
    'sxk-ab': ['unsourced_threshold'],
    'sxk-att': ['unsourced_threshold'],
    'snap-iv': [],
    'chexi': ['descriptive_only'],
    'sxk-spa': ['unsourced_threshold'],
    'sxk-spb': ['unsourced_threshold'],
    'sxk-adl': ['unsourced_threshold', 'rater_not_credentialed'],
    'sxk-ldp': ['unsourced_threshold'],
    'sxk-lds': ['unsourced_threshold'],
    'sxk-tempa': ['unsourced_threshold'],
    'sxk-tempb': ['unsourced_threshold'],
  };

  it('逐支相符，且全部是受控值', () => {
    for (const id of TOOL_IDS) {
      expect({ id, fixed: [...spec(id).fixedCaveats] }).toEqual({ id, fixed: SPEC_FIXED[id] });
      for (const c of spec(id).fixedCaveats) expect(isCaveat(c)).toBe(true);
    }
  });

  it('unsourced_threshold 是 18 支自建工具在帶（§5.6）', () => {
    // 22 支扣掉外部的 mchat-rf 與 snap-iv、非自建的 chexi（Thorell）與衛健委的 warn
    const carrying = TOOL_IDS.filter(id => spec(id).fixedCaveats.includes('unsourced_threshold'));
    expect(carrying).toHaveLength(18);
    const notCarrying = TOOL_IDS.filter(id => !carrying.includes(id));
    expect(notCarrying).toEqual(['sxk-warn', 'mchat-rf', 'snap-iv', 'chexi']);
  });

  it('parent_administered_task 就是 §5.6 說的那七支', () => {
    const carrying = TOOL_IDS.filter(id => spec(id).fixedCaveats.includes('parent_administered_task'));
    expect(carrying).toEqual(['sxk-dev', 'sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-asq']);
    // §5.6 的列舉句把 voc 也算進去，但 §3 的「家長」欄與 §5.9 的 voc 那一列都沒有
    // （§3 只有這六支寫「是＋parent_administered_task」，voc 寫「是」）。兩處對一處，取 §3／§5.9。
    expect(spec('sxk-voc').fixedCaveats).not.toContain('parent_administered_task');
  });

  it('條件式的 caveat 不在固定表裡 —— 那些是規則函式的事（#47）', () => {
    expect(spec('mchat-rf').fixedCaveats).not.toContain('follow_up_not_done');
    expect(spec('sxk-asb').fixedCaveats).not.toContain('regression_reported');
    expect(spec('sxk-asb').fixedCaveats).not.toContain('safety_concern');
    expect(spec('sxk-att').fixedCaveats).not.toContain('recent_onset');
    expect(spec('sxk-ab').fixedCaveats).not.toContain('single_setting');
    expect(spec('sxk-spa').fixedCaveats).not.toContain('no_functional_impact');
    expect(spec('sxk-lang').fixedCaveats).not.toContain('hearing_check_first');
    expect(spec('sxk-adl').fixedCaveats).not.toContain('few_items');
  });

  it('parent_report 不逐支重複 —— 22 支全帶的那一個在 UNIVERSAL_CAVEATS', () => {
    for (const id of TOOL_IDS) expect(spec(id).fixedCaveats).not.toContain('parent_report');
  });
});
