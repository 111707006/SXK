import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_TAGS, REPORT_ONLY_TAGS, FINDING_TAGS, TAG_DIMENSIONS,
  isActivityTag, isFindingTag, tagDimension, tagsOfDimension,
} from '../src/t2/findingTags';
import type { FindingTag, TagDimension } from '../src/t2/findingTags';
import { CAVEATS, RETIRED_CAVEATS, UNIVERSAL_CAVEATS, isCaveat } from '../src/t2/caveats';
import {
  SECTION_TAGS, CHEXI_FACTORS, TEMPERAMENT_TAGS, PRE_QUESTION_TAGS,
  EXPRESSION_GAP_RULES, SEVERITY_TAG,
} from '../src/t2/sectionTags';
import { ITEM_TAGS, WARN_POSITION_FEEDS } from '../src/t2/itemTags';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';

/**
 * 發現標籤與 caveat 的受控詞彙測試（#42，規格 v2 §5.5、§5.6）。
 *
 * 【為什麼需要這些】
 * 標籤是一組字串常數，打錯不會有型別錯誤，只會有一個維度永遠配不到活動。
 * 這裡擋兩個方向的漂移：
 *
 * 1. **死字**：定義了標籤，但沒有任何一支工具的規則產得出它 —— 活動庫那邊
 *    照著標籤表貼了標，永遠等不到有人來配。
 * 2. **超編**：一個維度的標籤長到十幾個，家長報告變成一張清單，而活動庫
 *    每多一個標籤就多一批要生產的內容。
 *
 * 下面的表是從規格 §5.5／§5.6 **重新抄一次**的，不是從程式碼讀出來的 ——
 * 兩邊獨立抄，對不上才有意義。
 */

/** §5.5 的表，逐列重抄。★ 的在前，只進報告的在後。 */
const SPEC_TAGS: Record<string, { activity: string[]; reportOnly: string[] }> = {
  lang: {
    activity: ['comprehension', 'expression', 'expression_below_comprehension', 'vocabulary_size', 'articulation', 'pragmatics'],
    reportOnly: [],
  },
  soc: {
    activity: ['joint_attention', 'eye_contact', 'imitation', 'social_initiation', 'emotion_reciprocity', 'pretend_play'],
    reportOnly: ['response_to_name', 'stereotyped_behavior'],
  },
  emo: {
    activity: ['regulation'],
    reportOnly: ['adaptability_low', 'intensity_high', 'mood_negative', 'regularity_low', 'slow_to_warm', 'activity_high'],
  },
  att: {
    activity: ['inattention', 'hyperactivity', 'impulsivity', 'working_memory', 'inhibition', 'organization'],
    reportOnly: [],
  },
  mot: {
    activity: ['postural', 'locomotion', 'balance', 'ball_skills', 'fine_motor'],
    reportOnly: [],
  },
  sen: {
    activity: ['tactile', 'vestibular', 'body_awareness', 'auditory', 'visual', 'oral', 'regulation'],
    reportOnly: ['threshold_low', 'impact_adl', 'impact_group', 'impact_play'],
  },
  adl: {
    activity: ['feeding', 'dressing', 'toileting', 'hygiene', 'routines'],
    reportOnly: [],
  },
  cog: {
    activity: ['visual_attention', 'problem_solving', 'concepts'],
    reportOnly: [],
  },
  learn: {
    activity: ['reading', 'writing', 'number', 'phonological', 'task_persistence'],
    reportOnly: [],
  },
  severity: {
    activity: [],
    reportOnly: ['severe'],
  },
};

describe('發現標籤：受控詞彙（§5.5）', () => {
  it('★ 配活動的那一組與 §5.5 逐格相符', () => {
    const expected = Object.entries(SPEC_TAGS)
      .flatMap(([dim, row]) => row.activity.map(t => `${dim}.${t}`));
    expect([...ACTIVITY_TAGS]).toEqual(expected);
  });

  it('只進報告的那一組與 §5.5 逐格相符', () => {
    const expected = Object.entries(SPEC_TAGS)
      .flatMap(([dim, row]) => row.reportOnly.map(t => `${dim}.${t}`));
    expect([...REPORT_ONLY_TAGS]).toEqual(expected);
  });

  it('★ 與只進報告分得開：沒有交集，聯集就是全部 57 個', () => {
    const activity = new Set<string>(ACTIVITY_TAGS);
    for (const tag of REPORT_ONLY_TAGS) expect(activity.has(tag)).toBe(false);
    expect(FINDING_TAGS).toHaveLength(ACTIVITY_TAGS.length + REPORT_ONLY_TAGS.length);
    expect(FINDING_TAGS).toHaveLength(57);
    expect(new Set(FINDING_TAGS).size).toBe(57);
  });

  it('isActivityTag 認得出哪些配活動', () => {
    expect(isActivityTag('soc.eye_contact')).toBe(true);
    // 氣質的「慢熱型」是特質不是缺口，不能拿去挑活動
    expect(isActivityTag('emo.slow_to_warm')).toBe(false);
    expect(isActivityTag('severity.severe')).toBe(false);
  });

  it('格式一律 <維度小寫>.<標的>，前綴只能是九個維度加 severity', () => {
    for (const tag of FINDING_TAGS) {
      expect(tag).toMatch(/^[a-z]+\.[a-z_]+$/);
      expect(TAG_DIMENSIONS).toContain(tagDimension(tag));
    }
  });

  it('isFindingTag 擋得住沒登錄過的字（舊報告裡的字、手打的駝峰）', () => {
    expect(isFindingTag('soc.eye_contact')).toBe(true);
    expect(isFindingTag('soc.eyeContact')).toBe(false);
    expect(isFindingTag('sen.planning')).toBe(false);   // v1 有、v2 拿掉的
    expect(isFindingTag('')).toBe(false);
  });

  it('每個維度不超過 10 個 —— 只有 sen 是 11（規格自己的表就是 11）', () => {
    // 規格 §5.5 與 CONTEXT.md「發現標籤」都寫「每個維度 5–10 個」，但 §5.5 的
    // sen 那一列列了 11 個：七個感覺系統＋反應閾＋三個前置題出的 impact_*。
    // 三個 impact_* 在 §5.1 與 §5.9 都被引用，拿掉任何一個會讓 spa／spb 的前置題
    // 產不出東西，所以照表實作，把差異釘在這裡等客戶覆核。
    for (const dim of TAG_DIMENSIONS) {
      const n = tagsOfDimension(dim).length;
      if (dim === 'sen') {
        expect(n).toBe(11);
        continue;
      }
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('每個維度的標籤數與 §5.5 逐列相符', () => {
    const expected: Record<string, number> = {
      lang: 6, soc: 8, emo: 7, att: 6, mot: 5, sen: 11, adl: 5, cog: 3, learn: 5, severity: 1,
    };
    for (const [dim, n] of Object.entries(expected)) {
      expect({ dim, n: tagsOfDimension(dim as TagDimension).length }).toEqual({ dim, n });
    }
  });
});

/**
 * 每個標籤至少一個來源。
 *
 * 「來源」就是 §5.9 那張表裡任何一條產得出它的規則：某支工具的面向、某一題、
 * chexi 的因素、氣質的向度、前置題，或兩條衍生規則（表達弱於理解、tier 4）。
 */
function tagSources(): Map<FindingTag, string[]> {
  const sources = new Map<FindingTag, string[]>();
  const add = (tag: FindingTag, where: string) => {
    const list = sources.get(tag) ?? [];
    list.push(where);
    sources.set(tag, list);
  };

  for (const [toolId, sections] of Object.entries(SECTION_TAGS)) {
    for (const [section, tags] of Object.entries(sections ?? {})) {
      for (const tag of tags) add(tag, `${toolId} 面向 ${section}`);
    }
  }
  for (const [toolId, sections] of Object.entries(ITEM_TAGS)) {
    for (const [section, items] of Object.entries(sections ?? {})) {
      for (const [no, rule] of Object.entries(items)) {
        for (const tag of rule.tags) add(tag, `${toolId} ${section} 第 ${no} 題`);
      }
    }
  }
  for (const factor of CHEXI_FACTORS) {
    for (const tag of factor.tags) add(tag, `chexi 因素 ${factor.key}`);
    for (const tag of factor.extra.tags) add(tag, `chexi 副量表 ${factor.extra.section}`);
  }
  for (const [dim, sides] of Object.entries(TEMPERAMENT_TAGS)) {
    for (const tag of sides.hi) add(tag, `氣質 ${dim} hi 端`);
    for (const tag of sides.lo) add(tag, `氣質 ${dim} lo 端`);
  }
  for (const [toolId, keys] of Object.entries(PRE_QUESTION_TAGS)) {
    for (const [key, values] of Object.entries(keys ?? {})) {
      for (const [value, tags] of Object.entries(values)) {
        for (const tag of tags) add(tag, `${toolId} 前置題 ${key}=${value}`);
      }
    }
  }
  for (const rule of EXPRESSION_GAP_RULES) {
    add(rule.tag, `${rule.toolId} ${rule.comprehension}−${rule.expression} 差距規則`);
  }
  for (const feed of WARN_POSITION_FEEDS) {
    for (const tag of feed.tags) add(tag, `sxk-warn 第 ${feed.position} 條`);
  }
  add(SEVERITY_TAG, '任何工具的 tier 4');
  return sources;
}

describe('發現標籤：每個標籤至少一個來源（§5.9）', () => {
  const sources = tagSources();

  it('57 個標籤全部產得出來，沒有死字', () => {
    const orphans = FINDING_TAGS.filter(tag => !sources.has(tag));
    expect(orphans).toEqual([]);
  });

  it('規則產出的每一個標籤都在受控詞彙裡', () => {
    for (const tag of sources.keys()) expect(isFindingTag(tag)).toBe(true);
  });

  it('幾個只有單一來源的，來源就是規格說的那一個', () => {
    // 這幾個標籤只要那一條規則被改掉就會變成死字，值得逐一釘住
    expect(sources.get('mot.ball_skills')).toEqual(['sxk-gm P5 第 3 題', 'sxk-gm P5 第 6 題']);
    expect(sources.get('att.working_memory')).toEqual(['chexi 因素 F1']);
    expect(sources.get('att.inhibition')).toEqual(['chexi 因素 F2']);
    expect(sources.get('soc.pretend_play')).toEqual(['mchat-rf all 第 3 題']);
    expect(sources.get('sen.threshold_low')).toEqual(['氣質 D9 hi 端']);
    expect(sources.get('lang.vocabulary_size')).toEqual(['sxk-voc 面向 V3']);
    expect(sources.get('severity.severe')).toEqual(['任何工具的 tier 4']);
  });

  it('lang.expression_below_comprehension 的兩條衍生規則都在', () => {
    expect(sources.get('lang.expression_below_comprehension')).toEqual([
      'sxk-lang RC−EX 差距規則',
      'sxk-voc V1−V2 差距規則',
    ]);
  });

  it('sen 的三個 impact_* 只從 spa／spb 的前置題來', () => {
    for (const tag of ['sen.impact_adl', 'sen.impact_group', 'sen.impact_play'] as const) {
      expect(sources.get(tag)).toEqual([
        `sxk-spa 前置題 impact=${tag.replace('sen.impact_', '')}`,
        `sxk-spb 前置題 impact=${tag.replace('sen.impact_', '')}`,
      ]);
    }
  });
});

/**
 * 每一支工具是靠哪一類規則出標籤的。
 *
 * 「每個標籤至少一個來源」只驗了**標籤 → 規則**這一個方向，反方向沒人看：把
 * `SECTION_TAGS['sxk-att']` 整個五面向刪掉，上面那條照樣綠 —— 因為 att.inattention、
 * impulsivity、organization、learn.task_persistence 在 ab、snap、ldp、chexi、氣質
 * 那邊都另有來源。結果會是做完 SXK-ATT 的孩子一個發現標籤都拿不到，報告看起來
 * 還是完整的，只是配活動那一步安靜地少一批。spa／spb、ldp／lds 這兩對互為備份的
 * 工具同樣中招。
 */
function toolsWithTagRules(): Map<ToolId, string> {
  const out = new Map<ToolId, string>();
  const note = (id: ToolId, how: string) => { if (!out.has(id)) out.set(id, how); };

  for (const [toolId, sections] of Object.entries(SECTION_TAGS)) {
    if (Object.values(sections ?? {}).some(tags => tags.length > 0)) note(toolId as ToolId, '面向級');
  }
  for (const [toolId, sections] of Object.entries(ITEM_TAGS)) {
    const any = Object.values(sections ?? {})
      .some(items => Object.values(items).some(r => r.tags.length > 0 || (r.caveats?.length ?? 0) > 0));
    if (any) note(toolId as ToolId, '逐題');
  }
  if (CHEXI_FACTORS.some(f => f.tags.length > 0)) note('chexi', '因素');
  if (Object.values(TEMPERAMENT_TAGS).some(d => d.hi.length > 0 || d.lo.length > 0)) {
    note('sxk-tempa', '向度偏離');
    note('sxk-tempb', '向度偏離');
  }
  for (const toolId of Object.keys(PRE_QUESTION_TAGS)) note(toolId as ToolId, '前置題');
  for (const rule of EXPRESSION_GAP_RULES) note(rule.toolId, '衍生規則');
  if (WARN_POSITION_FEEDS.some(f => f.tags.length > 0)) note('sxk-warn', '時點內位置');
  return out;
}

describe('發現標籤：反方向 —— 每一支工具都要出得了標籤（§5.9）', () => {
  it('22 支一支都不缺，刪掉任何一支的規則都會紅', () => {
    const rules = toolsWithTagRules();
    const missing = TOOL_IDS.filter(id => !rules.has(id));
    expect(missing).toEqual([]);
    expect(rules.size).toBe(22);
  });

  it('走面向級的那幾支，每個面向都出標籤 —— 唯一的例外是 asq 的 PE', () => {
    // asq 的「个人社会」六題分成生活自理三題與社交三題，整個面向出一組標籤會貼錯一半，
    // 所以它走逐題（見 itemTags.ts）。其餘面向少一個就是那一塊能力永遠不會被指出來。
    const holes: string[] = [];
    for (const [toolId, sections] of Object.entries(SECTION_TAGS)) {
      for (const sec of TOOLKIT[toolId as ToolId].sections) {
        const tags = (sections ?? {})[sec.key];
        if (!tags || tags.length === 0) holes.push(`${toolId} ${sec.key}`);
      }
    }
    expect([...new Set(holes)]).toEqual(['sxk-asq PE']);
  });
});

describe('Caveats：受控值（§5.6）', () => {
  it('17 個，與 §5.6 的表逐列相符', () => {
    expect([...CAVEATS]).toEqual([
      'incomplete',
      'age_out_of_window',
      'unsourced_threshold',
      'parent_report',
      'parent_administered_task',
      'rater_not_credentialed',
      'rater_role_parent',
      'few_items',
      'follow_up_not_done',
      'regression_reported',
      'recent_onset',
      'single_setting',
      'no_functional_impact',
      'descriptive_only',
      'hearing_check_first',
      'narrow_window',
      'safety_concern',
    ]);
    expect(CAVEATS).toHaveLength(17);
  });

  it('不含 v1 拿掉的三個', () => {
    // basal_not_established 依賴 DQ 常模（不存在）、known_scoring_defect_corrected
    // 依賴 23 份量表的稽核（已作廢）、license_pending 的四份版權工具已換掉
    expect(RETIRED_CAVEATS).toEqual([
      'basal_not_established', 'known_scoring_defect_corrected', 'license_pending',
    ]);
    for (const retired of RETIRED_CAVEATS) expect(isCaveat(retired)).toBe(false);
  });

  it('22 支全部都帶的只有 parent_report', () => {
    expect([...UNIVERSAL_CAVEATS]).toEqual(['parent_report']);
  });
});
