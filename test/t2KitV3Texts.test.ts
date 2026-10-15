import { describe, it, expect } from 'vitest';
import { KITV3_BANKS } from '../src/t2/kitv3';

/**
 * 量表详解的素材（量表详解規格 §3、票 D-1）：客戶網頁裡治療師寫的面向說明與分段建議，抽進題庫的 `texts`。
 * 重跑一致由 `t2KitV3.structure` 盯著；這裡釘住每一支抽到了什麼，客戶換版少了一段會紅。
 */

/** 代碼 → [面向說明幾段, LEVELS 幾段]。LQ、M-CHAT、EMO 頁面沒有面向說明（規格 §4 另外處理）。 */
const COVERAGE: Record<string, [number, number] | null> = {
  'SXK-GM': [7, 4], 'SXK-SOC': [7, 4], 'SXK-ADP': [7, 4], 'SXK-PLC': [7, 4], 'SXK-LANG': [6, 4],
  'SXK-LQ': null, 'M-CHAT-R/F': null, 'SXK-ASQ3': [5, 4], 'SXK-VOC': [3, 0],
  'SXK-ASB': [5, 3], 'SXK-ASR': [5, 0], 'SXK-QOL': [5, 0],
  'SXK-AB': [6, 3], 'SXK-ATT': [7, 3], 'SNAP-IV': [3, 0], 'CHEXI': [4, 0], 'SXK-LDP': [7, 4], 'SXK-LDS': [7, 4],
  'SXK-SP': [9, 3], 'SXK-SPb': [9, 3], 'SXK-ADL': [7, 3], 'SXK-EMO': null, 'SXK-TIC': [2, 4], 'ITQ/TTS/BSQ': [9, 0],
};

/** 面向 key 不是題庫段落 key 的：CHEXI 是副量表、氣質是向度、ATT 的 CA 是頁面另一個情境（家長版不出題，說明照抄）。 */
const NON_SECTION_KEYS: Record<string, string[]> = {
  CHEXI: ['wm', 'pl', 'rg', 'ib'],
  'ITQ/TTS/BSQ': ['活动量', '规律性', '趋避性', '适应度', '反应强度', '情绪本质', '坚持度', '注意力分散度', '反应阈'],
  'SXK-ATT': ['CA'],
};

describe('客戶說明抽進題庫', () => {
  it('24 支都在表上', () => {
    expect(Object.keys(COVERAGE).sort()).toEqual(Object.keys(KITV3_BANKS).sort());
  });

  it.each(Object.entries(COVERAGE))('%s：面向說明與分段建議的段數', (code, want) => {
    const t = KITV3_BANKS[code].texts;
    if (want === null) {
      expect(t).toBeUndefined();
      return;
    }
    expect(Object.keys(t!.facets).length).toBe(want[0]);
    expect(t!.levels?.length ?? 0).toBe(want[1]);
  });

  it.each(Object.keys(COVERAGE).filter(c => COVERAGE[c]))('%s：面向 key 對得到題庫的段落（或列在例外）', code => {
    const b = KITV3_BANKS[code];
    const sections = new Set(b.forms.flatMap(f => f.sections.map(s => s.key)));
    const extra = Object.keys(b.texts!.facets).filter(k => !sections.has(k));
    expect(extra).toEqual(NON_SECTION_KEYS[code] ?? []);
  });

  it('原文只去掉 HTML 標記：沒有角括號、每段 what 都有字、tips 不是空字串', () => {
    for (const [code, b] of Object.entries(KITV3_BANKS)) {
      for (const [key, f] of Object.entries(b.texts?.facets ?? {})) {
        const all = [f.what, ...f.tips, f.poleTips?.hi ?? '', f.poleTips?.lo ?? ''];
        expect(all.join(''), `${code} ${key}`).not.toMatch(/[<>]/);
        expect(f.what.length, `${code} ${key}`).toBeGreaterThan(5);
        expect(f.tips.every(x => x.length > 0), `${code} ${key}`).toBe(true);
      }
      for (const l of b.texts?.levels ?? []) expect(l.txt, code).not.toMatch(/[<>]/);
    }
  });

  it('氣質的練法分偏高／偏低兩頭', () => {
    const f = KITV3_BANKS['ITQ/TTS/BSQ'].texts!.facets['活动量'];
    expect(f.poleTips?.hi).toContain('精力旺盛');
    expect(f.poleTips?.lo).toContain('偏安静');
  });

  it('範例那一面（粗大動作的平衡與球類協調）抽到客戶原文', () => {
    const f = KITV3_BANKS['SXK-GM'].texts!.facets.G7;
    expect(f.what).toContain('单脚站、走直线、接抛球、拍球、骑车');
    expect(f.tips).toHaveLength(4);
  });
});
