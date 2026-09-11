import { describe, it, expect } from 'vitest';
import { TOOLKIT } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import {
  ITEM_TAGS, ASR_ITEM_TAGS, ASR_SECTION_ORDER, asrGlobalNo, itemRule,
  WARN_POSITION_FEEDS, WARN_REGRESSION_FEEDS,
} from '../src/t2/itemTags';
import { SECTION_TAGS, TEMPERAMENT_TAGS, CHEXI_FACTORS } from '../src/t2/sectionTags';
import { isFindingTag } from '../src/t2/findingTags';
import { isCaveat } from '../src/t2/caveats';

/**
 * 逐題標籤表的測試（#42，規格 v2 §5.9）。
 *
 * 【為什麼需要這些】
 * 逐題表是四支工具、110 題的對應。題號抄錯一個不會有型別錯誤 —— 只會有一題
 * 貼錯標籤，家長拿到一批練錯東西的活動。這裡擋兩件事：
 *
 * 1. **題號超出範圍**：`ASB SH 第 11 題` 根本不存在（SH 只有 10 題），
 *    那條規則永遠不會被觸發，而且沒有人會發現。
 * 2. **與 §5.9 不符**：下面的表是照 §5.9 的**原始寫法**（依標籤分組）重抄的，
 *    展開後再與程式碼的逐題表對。兩邊寫法不同，抄錯就對不上。
 */

/** 把 §5.9 的「標籤 → 題號清單」展開成「題號 → 標籤清單」。 */
function expand(byTag: Record<string, number[]>): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [tag, nos] of Object.entries(byTag)) {
    for (const no of nos) (out[no] ??= []).push(tag);
  }
  return out;
}

function actualTags(toolId: ToolId, section: string): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [no, rule] of Object.entries(ITEM_TAGS[toolId]?.[section] ?? {})) {
    if (rule.tags.length > 0) out[Number(no)] = [...rule.tags];
  }
  return out;
}

describe('逐題標籤：mchat-rf 20 題（§5.9）', () => {
  it('20 題逐條與 §5.9 相符', () => {
    // §5.9 的 mchat 那一格，照原始的分組寫法重抄
    const spec = expand({
      'soc.joint_attention': [1, 16, 19, 6, 7, 9, 17],
      'soc.social_initiation': [8, 11],
      'soc.response_to_name': [10],
      'soc.eye_contact': [14],
      'soc.imitation': [15],
      'soc.pretend_play': [3],
      'lang.comprehension': [18, 2],
      'mot.locomotion': [4, 13, 20],
      'sen.visual': [5],
      'sen.auditory': [12],
    });
    expect(actualTags('mchat-rf', 'all')).toEqual(spec);
    expect(Object.keys(spec)).toHaveLength(20);
  });

  it('第 2 題（想過孩子可能是聾的）另外要求先做聽力檢查', () => {
    expect(itemRule('mchat-rf', 'all', 2)?.caveats).toEqual(['hearing_check_first']);
    expect(itemRule('mchat-rf', 'all', 1)?.caveats).toBeUndefined();
  });
});

describe('逐題標籤：sxk-asb 五向度（§5.9）', () => {
  const SPEC: Record<string, Record<string, number[]>> = {
    SE: {
      'sen.auditory': [1, 10, 12],
      'sen.tactile': [2, 5, 8, 9],
      'sen.visual': [3, 6, 7],
      'sen.oral': [4, 11],
    },
    RE: {
      'soc.social_initiation': [1, 6, 7, 10],
      'soc.eye_contact': [2],
      'soc.response_to_name': [3],
      'soc.joint_attention': [4, 8],
      'soc.emotion_reciprocity': [5, 9, 12],
      'soc.imitation': [11],
    },
    BO: {
      // 4、8、9 不出標籤
      'soc.stereotyped_behavior': [1, 2, 3, 5, 6, 10],
      'mot.balance': [7],
      'soc.imitation': [11],
    },
    LA: {
      // 1 與 9 之外「其餘→lang.pragmatics」
      'lang.expression': [1],
      'lang.comprehension': [9],
      'lang.pragmatics': [2, 3, 4, 5, 6, 7, 8, 10, 11, 12],
    },
    SH: {
      // 6 不出標籤；8 只出 caveat
      'emo.adaptability_low': [1, 10],
      'sen.oral': [2],
      'emo.regularity_low': [3],
      'adl.toileting': [4],
      'adl.dressing': [5],
      'emo.regulation': [7],
      'soc.stereotyped_behavior': [9],
    },
  };

  it('五個向度逐條與 §5.9 相符', () => {
    for (const [section, byTag] of Object.entries(SPEC)) {
      expect({ section, tags: actualTags('sxk-asb', section) })
        .toEqual({ section, tags: expand(byTag) });
    }
    expect(Object.keys(SPEC)).toEqual(['SE', 'RE', 'BO', 'LA', 'SH']);
  });

  it('明寫「不出標籤」的那幾題真的沒有標籤', () => {
    for (const no of [4, 8, 9]) expect(itemRule('sxk-asb', 'BO', no)).toBeNull();
    expect(itemRule('sxk-asb', 'SH', 6)).toBeNull();
  });

  it('SH 第 8 項「出现自伤行为」出的是 caveat 不是標籤', () => {
    // 自傷不是拿去配活動的東西，是要立刻讓報告置頂一句話的東西
    expect(TOOLKIT['sxk-asb'].sections.find(s => s.key === 'SH')?.items[7]?.text).toBe('出现自伤行为');
    expect(itemRule('sxk-asb', 'SH', 8)).toEqual({ tags: [], caveats: ['safety_concern'] });
  });
});

describe('逐題標籤：sxk-asr 15 項（§5.9）', () => {
  it('15 項逐條與 §5.9 的全域題號相符', () => {
    const spec = expand({
      'soc.social_initiation': [1],
      'soc.imitation': [2],
      'emo.regulation': [3, 13],
      'lang.expression': [4],
      'lang.pragmatics': [4, 5],
      'sen.visual': [6],
      'soc.eye_contact': [6],
      'sen.auditory': [7],
      'sen.tactile': [8],
      'sen.oral': [8],
      'soc.stereotyped_behavior': [9, 10],
      'emo.adaptability_low': [11],
      'emo.activity_high': [12],
      // 14、15 不出標籤
    });
    const actual: Record<number, string[]> = {};
    for (const [no, rule] of Object.entries(ASR_ITEM_TAGS)) actual[Number(no)] = [...rule.tags];
    // 展開後同一題的標籤順序依 §5.9 的分組而定，比對前先排序
    for (const map of [spec, actual]) for (const k of Object.keys(map)) map[Number(k)].sort();
    expect(actual).toEqual(spec);
    expect(Object.keys(ASR_ITEM_TAGS)).toHaveLength(13);   // 15 項扣掉不出標籤的 14、15
  });

  it('全域題號 1–15 對得回四個面向：SC 1–5、SN 6–8、BH 9–12、GN 13–15', () => {
    expect(ASR_SECTION_ORDER.map(s => s.count)).toEqual([5, 3, 4, 3]);
    expect(ASR_SECTION_ORDER.reduce((n, s) => n + s.count, 0)).toBe(15);
    expect(asrGlobalNo('SC', 1)).toBe(1);
    expect(asrGlobalNo('SN', 1)).toBe(6);
    expect(asrGlobalNo('BH', 1)).toBe(9);
    expect(asrGlobalNo('GN', 1)).toBe(13);
    expect(asrGlobalNo('GN', 3)).toBe(15);
    expect(asrGlobalNo('GN', 4)).toBeNull();
    expect(asrGlobalNo('ZZ', 1)).toBeNull();
  });

  it('面向順序與題數就是題庫那一份', () => {
    const kit = TOOLKIT['sxk-asr'].sections.map(s => ({ key: s.key, count: s.items.length }));
    expect(kit).toEqual([...ASR_SECTION_ORDER]);
  });

  it('§4.6 說的那兩項（能力發展的均勻度、整體印象）不出標籤', () => {
    expect(asrGlobalNo('GN', 2)).toBe(14);
    expect(ASR_ITEM_TAGS[14]).toBeUndefined();
    expect(ASR_ITEM_TAGS[15]).toBeUndefined();
    expect(itemRule('sxk-asr', 'GN', 2)).toBeNull();
  });

  it('換算成面向內題號之後對得上：第 6 項就是 SN 的第 1 題', () => {
    expect(itemRule('sxk-asr', 'SN', 1)?.tags).toEqual(['sen.visual', 'soc.eye_contact']);
    expect(itemRule('sxk-asr', 'BH', 4)?.tags).toEqual(['emo.activity_high']);
  });
});

describe('逐題標籤：sxk-adl 18 項（§5.9）', () => {
  const SPEC: Record<string, Record<string, number[]>> = {
    SC: {
      'adl.feeding': [1],
      'adl.dressing': [2, 3],
      'adl.hygiene': [4, 6],
      'adl.toileting': [5],
    },
    SP: { 'adl.toileting': [1, 2] },
    MO: { 'mot.locomotion': [1, 2, 3, 4] },
    CC: {
      // 3、4、5 不出標籤
      'lang.comprehension': [1],
      'lang.expression': [2],
      'adl.routines': [6],
    },
  };

  it('四個領域逐項與 §5.9 相符', () => {
    for (const [section, byTag] of Object.entries(SPEC)) {
      expect({ section, tags: actualTags('sxk-adl', section) })
        .toEqual({ section, tags: expand(byTag) });
    }
  });

  it('18 項裡有 15 項出標籤，CC 的 3、4、5 不出', () => {
    const total = Object.values(ITEM_TAGS['sxk-adl'] ?? {}).reduce((n, sec) => n + Object.keys(sec).length, 0);
    expect(total).toBe(15);
    for (const no of [3, 4, 5]) expect(itemRule('sxk-adl', 'CC', no)).toBeNull();
  });
});

describe('逐題標籤：另外三支的幾條規則（§5.9）', () => {
  it('gm 的球類兩題：P5 第 3、6 項另加 mot.ball_skills', () => {
    const p5 = TOOLKIT['sxk-gm'].sections.find(s => s.key === 'P5');
    expect(p5?.items[2]?.text).toBe('能踢固定的球');
    expect(p5?.items[5]?.text).toBe('能接住抛来的大球');
    expect(itemRule('sxk-gm', 'P5', 3)?.tags).toEqual(['mot.ball_skills']);
    expect(itemRule('sxk-gm', 'P5', 6)?.tags).toEqual(['mot.ball_skills']);
    expect(itemRule('sxk-gm', 'P5', 4)).toBeNull();
    // P5 整個面向還是出 mot.balance，球類是額外加的
    expect(SECTION_TAGS['sxk-gm']?.P5).toEqual(['mot.balance']);
  });

  it('asq 的「个人社会」前三項是生活自理、後三項是社交', () => {
    expect(actualTags('sxk-asq', 'PE')).toEqual({
      1: ['adl.feeding'], 2: ['adl.toileting'], 3: ['adl.dressing'],
      4: ['soc.social_initiation'], 5: ['soc.social_initiation'], 6: ['soc.social_initiation'],
    });
    // PE 沒有面向級的標籤 —— 六題分成兩組，整個面向出一組標籤會貼錯一半
    expect(SECTION_TAGS['sxk-asq']?.PE).toBeUndefined();
  });

  it('warn 每個時點的四條：語言、社交、精細動作、粗大動作', () => {
    expect(WARN_POSITION_FEEDS.map(f => f.dimension)).toEqual(['LANG', 'SOC', 'MOT', 'MOT']);
    expect(WARN_POSITION_FEEDS.map(f => f.tags)).toEqual([[], [], ['mot.fine_motor'], ['mot.locomotion']]);
    // 十一個時點每個都是四條，所以記位置就夠
    for (const s of TOOLKIT['sxk-warn'].sections) expect(s.items).toHaveLength(4);
    expect(TOOLKIT['sxk-warn'].sections).toHaveLength(11);
  });

  it('warn 的兩個倒退勾各指一個維度', () => {
    expect(WARN_REGRESSION_FEEDS).toEqual({ language: 'LANG', social: 'SOC' });
  });
});

describe('逐題與面向標籤：結構護欄', () => {
  it('逐題表的面向 key 都是題庫真有的，題號都在該面向的範圍內', () => {
    for (const [toolId, sections] of Object.entries(ITEM_TAGS)) {
      const kit = TOOLKIT[toolId as ToolId];
      for (const [key, items] of Object.entries(sections ?? {})) {
        const section = kit.sections.find(s => s.key === key);
        expect({ toolId, key, found: Boolean(section) }).toEqual({ toolId, key, found: true });
        for (const no of Object.keys(items)) {
          const n = Number(no);
          expect({ toolId, key, no: n, ok: n >= 1 && n <= (section?.items.length ?? 0) })
            .toEqual({ toolId, key, no: n, ok: true });
        }
      }
    }
  });

  it('面向級標籤的 key 也都是題庫真有的', () => {
    for (const [toolId, sections] of Object.entries(SECTION_TAGS)) {
      const known = new Set(TOOLKIT[toolId as ToolId].sections.map(s => s.key));
      for (const key of Object.keys(sections ?? {})) {
        expect({ toolId, key, known: known.has(key) }).toEqual({ toolId, key, known: true });
      }
    }
  });

  it('氣質九向度與 chexi 四副量表的 key 都對得上題庫', () => {
    for (const id of ['sxk-tempa', 'sxk-tempb'] as const) {
      const known = new Set(TOOLKIT[id].sections.map(s => s.key));
      for (const key of Object.keys(TEMPERAMENT_TAGS)) expect(known.has(key)).toBe(true);
      expect(Object.keys(TEMPERAMENT_TAGS)).toHaveLength(9);
    }
    const chexiKeys = new Set(TOOLKIT['chexi'].sections.map(s => s.key));
    const used = CHEXI_FACTORS.flatMap(f => f.sections);
    expect(used).toEqual(['wm', 'pl', 'ib', 'rg']);
    for (const key of used) expect(chexiKeys.has(key)).toBe(true);
    for (const f of CHEXI_FACTORS) expect(f.sections).toContain(f.extra.section);
  });

  it('每一條規則產出的標籤與 caveat 都是受控值', () => {
    for (const sections of Object.values(ITEM_TAGS)) {
      for (const items of Object.values(sections ?? {})) {
        for (const rule of Object.values(items)) {
          for (const tag of rule.tags) expect(isFindingTag(tag)).toBe(true);
          for (const c of rule.caveats ?? []) expect(isCaveat(c)).toBe(true);
        }
      }
    }
    for (const sections of Object.values(SECTION_TAGS)) {
      for (const tags of Object.values(sections ?? {})) {
        for (const tag of tags) expect(isFindingTag(tag)).toBe(true);
      }
    }
  });

  it('走逐題的四支不重複走面向級 —— 同一題不會被貼兩次', () => {
    for (const id of ['mchat-rf', 'sxk-asb', 'sxk-asr', 'sxk-adl'] as const) {
      expect(SECTION_TAGS[id]).toBeUndefined();
    }
  });
});
