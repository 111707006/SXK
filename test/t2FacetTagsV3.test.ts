import { describe, expect, it } from 'vitest';
import { childTagsOf, childTagsV3Of } from '../src/t2/childTagsV3';
import { FACET_TAGS_V3, NO_TAG_TOOLS_V3, TEMPERAMENT_CODE_V3, TEMPERAMENT_TAGS_V3 } from '../src/t2/facetTagsV3';
import { FINDING_TAGS, V3_ADDED_ACTIVITY_TAGS, isFindingTag } from '../src/t2/findingTags';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, formFor, scoreKitV3, type ScoreContext } from '../src/t2/kitv3/score';
import type { ToolResultV3 } from '../src/t2/kitv3/submit';
import { TOOLKIT_VERSION_V3 } from '../src/t2/kitv3/types';

/** 照這個月齡出的題，`pick` 決定每一題答什麼，算分後包成一筆結果。 */
function resultOf(toolId: string, ageM: number, pick: (key: string, section: string) => number | null): ToolResultV3 {
  const bank = KITV3_BANKS[toolId];
  const context: ScoreContext = { ageM };
  const answers: Record<string, number | null> = {};
  for (const a of askedItems(bank, context)) answers[a.item.key] = pick(a.item.key, a.section);
  return {
    toolkitVersion: TOOLKIT_VERSION_V3,
    toolId,
    assessedAgeMonth: ageM,
    rater: 'mother',
    context,
    answers,
    score: scoreKitV3(bank, answers, context),
    computedAt: '2026-11-19T00:00:00.000Z',
  } as ToolResultV3;
}

describe('完整版面向對照表（ADR-0018）的形狀', () => {
  it('每一支量表都有交代：有對照、整支不貼、或是氣質', () => {
    for (const code of Object.keys(KITV3_BANKS)) {
      const covered = code in FACET_TAGS_V3 || NO_TAG_TOOLS_V3.includes(code) || code === TEMPERAMENT_CODE_V3;
      expect(covered, code).toBe(true);
    }
    for (const code of Object.keys(FACET_TAGS_V3)) expect(KITV3_BANKS[code], code).toBeDefined();
  });

  it('對照裡的面向、題號、段落都真的存在於那一支題庫', () => {
    for (const [code, rules] of Object.entries(FACET_TAGS_V3)) {
      const bank = KITV3_BANKS[code];
      const sections = new Set(bank.forms.flatMap(f => f.sections.map(s => s.key)));
      const items = new Set(bank.forms.flatMap(f => f.sections.flatMap(s => s.items.map(i => i.key))));
      // CHEXI 的面向是計分的兩個因素，不是題庫的段落
      const facetKeys = code === 'CHEXI' ? new Set((bank.scoring as { factors: Array<{ key: string }> }).factors.map(f => f.key)) : sections;
      for (const key of Object.keys(rules.facets ?? {})) expect(facetKeys.has(key), `${code} ${key}`).toBe(true);
      for (const key of Object.keys(rules.items ?? {})) expect(items.has(key), `${code} ${key}`).toBe(true);
      for (const key of [...Object.keys(rules.anyYes ?? {}), ...Object.keys(rules.sectionGaps ?? {})]) expect(sections.has(key), `${code} ${key}`).toBe(true);
      for (const g of rules.gaps ?? []) expect(sections.has(g.higher) && sections.has(g.lower), code).toBe(true);
    }
  });

  it('每一個細項都在受控詞彙裡；v3 新增的兩個有地方產', () => {
    const used = new Set<string>();
    for (const rules of Object.values(FACET_TAGS_V3)) {
      for (const group of [rules.facets, rules.items, rules.anyYes, rules.sectionGaps]) {
        for (const tags of Object.values(group ?? {})) for (const t of tags) used.add(t);
      }
      for (const g of rules.gaps ?? []) for (const t of g.tags) used.add(t);
    }
    for (const r of Object.values(TEMPERAMENT_TAGS_V3)) for (const t of r.tags) used.add(t);
    for (const t of used) expect(isFindingTag(t), t).toBe(true);
    for (const t of V3_ADDED_ACTIVITY_TAGS) expect(used.has(t), t).toBe(true);
  });

  it('代號一樣、內容換了的那幾格照新內容貼（草稿第 2 點）', () => {
    expect(FACET_TAGS_V3['SXK-SOC'].facets!.S3).toEqual(['soc.joint_attention', 'soc.social_initiation']);
    expect(FACET_TAGS_V3['SXK-SOC'].facets!.S4).toEqual(['soc.imitation']);
    expect(FACET_TAGS_V3['SXK-SOC'].facets!.S5).toEqual(['soc.social_initiation']);
    expect(FACET_TAGS_V3['SXK-ADP'].facets!.A5).toEqual(['att.working_memory']);
    expect(FACET_TAGS_V3['SXK-GM'].facets!.G4).toEqual(['mot.locomotion']);
  });

  it('氣質三個表的兩端名稱都對得上（三個表順序不同，靠名字認）', () => {
    const forms = (KITV3_BANKS[TEMPERAMENT_CODE_V3].scoring as { forms: Record<string, { poles: Record<string, [string, string]> }> }).forms;
    for (const [form, { poles }] of Object.entries(forms)) {
      for (const [dim, rule] of Object.entries(TEMPERAMENT_TAGS_V3)) {
        const hit = poles[dim].filter(p => rule.carePoles.includes(p));
        expect({ form, dim, n: hit.length }).toEqual({ form, dim, n: 1 });
      }
    }
  });
});

describe('作答 → 孩子的細項', () => {
  it('語言：全部「已经会」不貼；全部「还不会」貼聽懂與表達', () => {
    expect(childTagsV3Of([resultOf('SXK-LANG', 36, () => 2)])).toEqual([]);
    const tags = childTagsV3Of([resultOf('SXK-LANG', 36, () => 0)]);
    expect(tags).toContain('lang.comprehension');
    expect(tags).toContain('lang.expression');
    expect(tags).not.toContain('lang.expression_below_comprehension');
  });

  it('語言：聽得懂、說不出 → 表達＋听懂多于说出，不貼聽懂', () => {
    const tags = childTagsV3Of([resultOf('SXK-LANG', 36, (_k, sec) => (sec === 'EX' ? 0 : 2))]);
    expect(tags).toContain('lang.expression');
    expect(tags).toContain('lang.expression_below_comprehension');
    expect(tags).not.toContain('lang.comprehension');
  });

  it('M-CHAT 逐題：叫名字沒反應（第 10 題答否）→ 叫名字的反應；其餘答在不是風險的那一邊不貼', () => {
    const riskIsYes = (KITV3_BANKS['M-CHAT-R/F'].scoring as { riskIsYes: string[] }).riskIsYes;
    const safe = (k: string) => (riskIsYes.includes(k) ? 0 : 1);
    expect(childTagsV3Of([resultOf('M-CHAT-R/F', 20, safe)])).toEqual([]);
    expect(childTagsV3Of([resultOf('M-CHAT-R/F', 20, k => (k === 'q10' ? 0 : safe(k)))])).toEqual(['soc.response_to_name']);
  });

  it('感覺：動作計劃那一段分數高 → 動作計劃（v3 新增的細項）', () => {
    const tags = childTagsV3Of([resultOf('SXK-SP', 40, (_k, sec) => (sec === 'PL' ? 3 : 0))]);
    expect(tags).toContain('mot.motor_planning');
    expect(tags).not.toContain('sen.tactile');
  });

  it('情緒：分離焦慮那一段 → 焦慮與擔憂；功能影響那一段不貼', () => {
    const tags = childTagsV3Of([resultOf('SXK-EMO', 96, (_k, sec) => (sec === 'E1' || sec === 'IMP' ? 3 : 0))]);
    expect(tags).toContain('emo.anxiety');
    expect(tags).not.toContain('emo.regulation');
  });

  it('生活品質、抽動整支不貼', () => {
    expect(childTagsV3Of([resultOf('SXK-QOL', 60, () => 3)])).toEqual([]);
    expect(childTagsV3Of([resultOf('SXK-TIC', 96, () => 5)])).toEqual([]);
  });

  it('氣質：照「那一端叫什麼」貼，ITQ 與 BSQ 兩端順序相反也一樣', () => {
    for (const ageM of [6, 60]) {
      const bank = KITV3_BANKS[TEMPERAMENT_CODE_V3];
      const formKey = formFor(bank, ageM).key;
      const s = bank.scoring as { forms: Record<string, { points: number; poles: Record<string, [string, string]>; key: Record<string, Array<{ item: string; forward: boolean }>> }> };
      const f = s.forms[formKey];
      // 規律性推到「无规律」那一端，其餘九個向度放在中間
      const carePole = f.poles['规律性'].indexOf('无规律'); // 0 或 1
      const items = new Map(f.key['规律性'].map(x => [x.item, x.forward] as const));
      const mid = Math.round((1 + f.points) / 2);
      const r = resultOf(TEMPERAMENT_CODE_V3, ageM, key => {
        if (!items.has(key)) return mid;
        const wantHigh = carePole === 1;
        return items.get(key) === wantHigh ? f.points : 1;
      });
      expect({ formKey, tags: childTagsV3Of([r]).filter(t => t === 'emo.regularity_low') }).toEqual({ formKey, tags: ['emo.regularity_low'] });
    }
  });

  it('多支一起：去重、照受控詞彙的順序', () => {
    const tags = childTagsV3Of([resultOf('SXK-LANG', 36, () => 0), resultOf('SXK-LQ', 36, () => 0)]);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toEqual(FINDING_TAGS.filter(t => tags.includes(t)));
  });
});

describe('childTagsOf：任何一種快照', () => {
  it('代填與 9/08 版：收每個維度的 tags，認不得的字丟掉', () => {
    const findings = { toolkitVersion: 'proxy', dimensions: [{ tags: ['lang.expression', 'nope.x'] }, { tags: ['mot.balance'] }, {}] };
    expect(childTagsOf(findings)).toEqual(['lang.expression', 'mot.balance']);
  });

  it('完整版：從快照存的作答算', () => {
    const findings = { toolkitVersion: TOOLKIT_VERSION_V3, dimensions: [], toolResults: [resultOf('SXK-LANG', 36, (_k, sec) => (sec === 'EX' ? 0 : 2))] };
    expect(childTagsOf(findings)).toContain('lang.expression');
  });

  it('讀不懂的回空陣列', () => {
    expect(childTagsOf(null)).toEqual([]);
    expect(childTagsOf({})).toEqual([]);
  });
});
