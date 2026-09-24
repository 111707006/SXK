import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ACTIVITY_TAGS, REPORT_ONLY_TAGS, FINDING_TAGS, TAG_DIMENSIONS,
  isActivityTag, isFindingTag, tagDimension, tagsOfDimension,
} from '../src/t2/findingTags';
import type { FindingTag, TagDimension } from '../src/t2/findingTags';
import { FINDING_TAG_LABELS } from '../src/admin/findingTagLabels';
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
 * 中文短名（v2.1 S15、附錄 B；客戶 9/21 工作單 #19）。
 *
 * 下面是附錄 B 的原文逐行重抄（44 個 ★ 九列、13 個只能貼 avoidIf 一列），從這段文字解析出
 * 「標籤 → 短名」，不從程式碼讀 —— 兩邊獨立抄，對不上才有意義。
 */
const APPENDIX_B_STARRED = [
  '`lang.comprehension` 听懂、`lang.expression` 表达、`lang.expression_below_comprehension` 听懂多于说出、`lang.vocabulary_size` 词汇量、`lang.articulation` 发音、`lang.pragmatics` 对话轮替',
  '`soc.joint_attention` 共同注意、`soc.eye_contact` 眼神接触、`soc.imitation` 模仿、`soc.social_initiation` 主动发起、`soc.emotion_reciprocity` 情绪来回、`soc.pretend_play` 假装游戏',
  '`att.inattention` 持续注意、`att.hyperactivity` 安坐、`att.impulsivity` 等待与轮流、`att.working_memory` 工作记忆、`att.inhibition` 抑制、`att.organization` 收拾与规划',
  '`mot.postural` 姿势控制、`mot.locomotion` 移动、`mot.balance` 平衡、`mot.ball_skills` 球类、`mot.fine_motor` 精细动作',
  '`sen.tactile` 触觉、`sen.vestibular` 前庭、`sen.body_awareness` 本体觉、`sen.auditory` 听觉、`sen.visual` 视觉、`sen.oral` 口腔、`sen.regulation` 感觉调节',
  '`adl.feeding` 吃饭、`adl.dressing` 穿脱、`adl.toileting` 如厕、`adl.hygiene` 清洁、`adl.routines` 日常流程',
  '`cog.visual_attention` 视觉专注、`cog.problem_solving` 解决问题、`cog.concepts` 概念',
  '`learn.reading` 阅读、`learn.writing` 书写、`learn.number` 数学、`learn.phonological` 语音觉识、`learn.task_persistence` 持续完成',
  '`emo.regulation` 情绪调节',
];
const APPENDIX_B_AVOID_ONLY = [
  '`soc.response_to_name` 叫名字的反应、`soc.stereotyped_behavior` 重复行为、`emo.adaptability_low` 适应变化慢、`emo.intensity_high` 情绪强度大、`emo.mood_negative` 心情底色偏低、`emo.regularity_low` 作息不规律、`emo.slow_to_warm` 慢热、`emo.activity_high` 活动量大、`sen.threshold_low` 反应阈低、`sen.impact_adl` 已影响到日常、`sen.impact_group` 已影响到团体、`sen.impact_play` 已影响到游戏、`severity.severe` 最需要留意',
];

function parseAppendixB(lines: string[]): Array<[string, string]> {
  return lines.flatMap(line => [...line.matchAll(/`([a-z_]+\.[a-z_]+)` ([^、`]+)/g)].map(m => [m[1], m[2]] as [string, string]));
}

describe('發現標籤的中文短名（v2.1 S15，只給後台）', () => {
  const starred = parseAppendixB(APPENDIX_B_STARRED);
  const avoidOnly = parseAppendixB(APPENDIX_B_AVOID_ONLY);

  it('重抄的附錄 B 本身是 44 ＋ 13，而且分法與 ★／只進報告一致', () => {
    expect(starred).toHaveLength(44);
    expect(avoidOnly).toHaveLength(13);
    expect(starred.map(([tag]) => tag).sort()).toEqual([...ACTIVITY_TAGS].sort());
    expect(avoidOnly.map(([tag]) => tag).sort()).toEqual([...REPORT_ONLY_TAGS].sort());
  });

  it('57 個都有、都非空，與附錄 B 逐字相同', () => {
    expect(Object.keys(FINDING_TAG_LABELS).sort()).toEqual([...FINDING_TAGS].sort());
    for (const tag of FINDING_TAGS) {
      expect(FINDING_TAG_LABELS[tag].trim(), tag).not.toBe('');
    }
    expect({ ...FINDING_TAG_LABELS }).toEqual(Object.fromEntries([...starred, ...avoidOnly]));
  });
});

/**
 * 短名只給後台（v2.1 §4.9）：「心情底色偏低」的「偏低」是《对照表》禁字，而家長端的禁字掃描
 * （`test/parentWording.structure.test.ts`）只讀它列出的那幾檔的**字面**，擋不住 import 進來的常數。
 * 所以這裡反過來掃**名字**：`src/`（含 `src/components/` 與家長端 import 的 `src/t2/` 文案檔）
 * 與 `server.ts`，提到 `FINDING_TAG_LABELS` 或 import `findingTagLabels` 的檔案只能是定義它的那一檔與後台活動庫分頁。
 * 常數本身放在 `src/admin/`（後台是 lazy chunk），不放家長端也 import 的 `src/t2/findingTags.ts`，
 * 否則畫面不顯示也會跟著家長端的 bundle 下載。
 *
 * 後台別的分頁要用：加進 `LABEL_USERS`。但 `src/admin/` 不等於「家長看不到」——
 * `ParentReportPrint.tsx` 印的是家長的報告。
 */
const ROOT = path.resolve(__dirname, '..');

const LABEL_USERS = [
  'src/admin/findingTagLabels.ts',
  'src/admin/panels/ActivitiesPanel.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 註解裡提到名字（「這裡不要用 FINDING_TAG_LABELS」）不算用到。 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('中文短名不流到家長端（v2.1 §4.9）', () => {
  const sources = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'server.ts')]
    .map(full => ({ rel: path.relative(ROOT, full).replace(/\\/g, '/'), code: stripComments(fs.readFileSync(full, 'utf8')) }));

  it('提到 FINDING_TAG_LABELS 的只有定義它的檔與後台活動庫分頁', () => {
    const users = sources.filter(s => s.code.includes('FINDING_TAG_LABELS')).map(s => s.rel).sort();
    expect(users).toEqual(LABEL_USERS);
    // 掃描範圍真的涵蓋家長端：元件、每週活動與報告的句子層都在裡面（每週活動的畫面 2026-09-24 起是
    // `src/components/training/`，Keep 票 6）
    const scanned = new Set(sources.map(s => s.rel));
    for (const rel of [
      'src/components/training/ReportEntry.tsx',
      'src/components/T2Report.tsx',
      'src/t2/weeklyCopy.ts',
      'src/t2/trainingCopy.ts',
      'src/t2/reportCopy.ts',
    ]) {
      expect(scanned.has(rel), rel).toBe(true);
    }
  });

  it('import `findingTagLabels` 的只有後台活動庫分頁；家長端也 import 的 findingTags.ts 不含短名', () => {
    const importers = sources.filter(s => /from\s*['"][^'"]*findingTagLabels['"]/.test(s.code)).map(s => s.rel).sort();
    expect(importers).toEqual(['src/admin/panels/ActivitiesPanel.tsx']);
    const tagsFile = sources.find(s => s.rel === 'src/t2/findingTags.ts')!;
    expect(tagsFile.code).not.toContain('心情底色偏低');
  });

  it('沒有檔案整包轉出 findingTagLabels（`export *` 會不提名字就把短名帶出去）', () => {
    const offenders = sources.filter(s => /export\s*\*\s*(?:as\s+\w+\s*)?from\s*['"][^'"]*findingTagLabels['"]/.test(s.code)).map(s => s.rel);
    expect(offenders).toEqual([]);
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
  it('19 個：§5.6 的 17 個逐列相符，加 v2.1 §4.5 的 facet_only、no_star_tool', () => {
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
      'facet_only',
      'no_star_tool',
    ]);
    expect(CAVEATS).toHaveLength(19);
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
