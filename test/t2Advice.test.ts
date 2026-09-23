import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { TOOLKIT, TOOLKIT_VERSION, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId, ToolkitAdvice } from '../src/t2/toolkit';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { buildT2Findings } from '../src/t2/findings';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, SectionStat, T1Flag, T2Findings, Tier, ToolResult } from '../src/t2/types';
import { dimensionAdvice, toolkitAdvice } from '../src/t2/advice';
import type { AdviceSource } from '../src/t2/advice';
import { ADVICE_HEADING, ADVICE_LEAD_SENTENCE, ADVICE_RANK_LABEL } from '../src/t2/reportCopy';
import { NO_ADVICE_SECTIONS_RULE, buildProsePrompt } from '../src/t2/report/prompt';

/**
 * CONSEQ／PLAN 的取句規則（規格 v2.1 §6.3，S09）。
 *
 * 正式資料現在是空的（22 份題庫都沒有 `advice`），所以規則全部用**假資料**測：`dimensionAdvice`
 * 的第三個參數換成一張手寫的表，句子是「GM-P1-輕微」這種一看就知道取到哪一格的字。
 * 快照（`T2Findings`）也是手捏的 —— 這裡測的是「從快照取句」，不是「從作答算到 tier」，
 * 後者是計分與規則表測試的事。
 */

const at = '2026-09-23T00:00:00.000Z';

function stat(tier: Tier | null, pct: number | null, scored = true): SectionStat {
  return { n: 6, raw: 0, max: 12, pct, tier, scored };
}

function result(toolId: ToolId, sections: Record<string, SectionStat>, ageMonth = 48): ToolResult {
  return {
    toolId,
    toolkitVersion: TOOLKIT_VERSION,
    assessedAgeMonth: ageMonth,
    rater: 'mother',
    askedCount: 0,
    answeredCount: 0,
    pre: {},
    answers: {},
    sections,
    overall: stat(2, 70),
    native: {},
    computedAt: at,
  };
}

/** 一張假的 advice：每一格的字就是它自己的位置，取錯格一眼看得出來。 */
function fakeAdvice(code: string, keys: ReadonlyArray<string>): ToolkitAdvice {
  const consequences: ToolkitAdvice['consequences'] = {};
  const plans: ToolkitAdvice['plans'] = {};
  for (const key of keys) {
    consequences[key] = [`${code}-${key}-輕微`, `${code}-${key}-中度`, `${code}-${key}-明顯`];
    plans[key] = { title: `${code}-${key}-標題`, focus: [`${code}-${key}-重點1`, `${code}-${key}-重點2`] };
  }
  return { consequences, plans };
}

const FAKE: Partial<Record<ToolId, ToolkitAdvice>> = {
  'sxk-gm': fakeAdvice('GM', ['P1', 'P2', 'P3', 'P4', 'P5']),
  'sxk-asq': fakeAdvice('ASQ', ['CO', 'GM', 'FM', 'PS', 'PE']),
  'sxk-asb': fakeAdvice('ASB', ['SE', 'RE', 'BO', 'LA', 'SH']),
  'sxk-ldp': fakeAdvice('LDP', ['read', 'math', 'write', 'attn', 'lang']),
  'sxk-adl': fakeAdvice('ADL', ['SC', 'SP', 'MO', 'CC']),
};

const fake: AdviceSource = id => FAKE[id];

/** 一個維度被某一支推到 `band`，快照裡只有那一筆結果。 */
function snapshot(
  dimension: DimensionCode,
  band: 'clear' | 'watch' | 'refer',
  r: ToolResult,
): T2Findings {
  return t2FindingsFixture({ [dimension]: { band, drivenBy: r.toolId } }, { toolResults: [r] });
}

describe('對象：判定是留意或關注的維度（§6.3 第 1 條）', () => {
  it('動作留意、GM 的 P3 在中度 → 「若持续不处理」取 P3 的第二句（tier 3 − 2 ＝ 1）', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(1, 90), P3: stat(3, 60), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P3-中度']);
  });

  it('關注的維度一樣取；三個等級各取各的那一句（tier 2／3／4 → 輕微／中度／明顯）', () => {
    const r = result('sxk-gm', { P1: stat(2, 80), P2: stat(3, 60), P3: stat(4, 40), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P1-輕微', 'GM-P2-中度', 'GM-P3-明顯']);
  });

  it('穩定的維度沒有這兩段 —— 即使推它的那一支有面向落在 tier ≥ 2（總分判穩定，就不講後果）', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(1, 90), P3: stat(2, 80), P4: stat(1, 88), P5: stat(1, 100) });
    expect(dimensionAdvice(snapshot('MOT', 'clear', r), 'MOT', fake)).toBeNull();
  });

  it('三種「沒有判定」（partial／not_assessed／no_tool）沒有這兩段', () => {
    const r = result('sxk-gm', { P1: stat(4, 20), P2: stat(4, 20), P3: stat(4, 20), P4: stat(4, 20), P5: stat(4, 20) });
    for (const band of ['partial', 'not_assessed', 'no_tool'] as const) {
      // drivenBy 故意留著：就算舊快照或手誤帶了它，沒有判定就是沒有判定。
      const findings = t2FindingsFixture({ MOT: { band, drivenBy: 'sxk-gm' } }, { toolResults: [r] });
      expect(dimensionAdvice(findings, 'MOT', fake), band).toBeNull();
    }
  });
});

describe('只看推判定那一支、餵這個維度的面向（§6.3 第 1 條）', () => {
  it('ASQ 推的動作只看 GM 面向：溝通、解決問題落在中度也不出現在動作那一格', () => {
    const r = result('sxk-asq', { CO: stat(3, 60), GM: stat(2, 80), FM: stat(3, 60), PS: stat(4, 40), PE: stat(1, 100) }, 36);
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.text)).toEqual(['ASQ-GM-輕微']);
  });

  it('同一支、另一個維度（認知 ← PS）取的是另一格', () => {
    const r = result('sxk-asq', { CO: stat(3, 60), GM: stat(2, 80), FM: stat(3, 60), PS: stat(4, 40), PE: stat(1, 100) }, 36);
    const advice = dimensionAdvice(snapshot('COG', 'refer', r), 'COG', fake);
    expect(advice?.consequences.map(c => c.text)).toEqual(['ASQ-PS-明顯']);
  });

  it('推判定的是別支就用別支的：快照裡有 GM 也有 ASQ，動作由 GM 推 → 只取 GM 的句子', () => {
    const gm = result('sxk-gm', { P1: stat(1, 95), P2: stat(1, 90), P3: stat(1, 90), P4: stat(3, 60), P5: stat(1, 100) }, 36);
    const asq = result('sxk-asq', { CO: stat(1, 90), GM: stat(4, 40), FM: stat(1, 90), PS: stat(1, 90), PE: stat(1, 100) }, 36);
    const findings = t2FindingsFixture(
      { MOT: { band: 'watch', drivenBy: 'sxk-gm', tools: ['sxk-gm', 'sxk-asq'] } },
      { toolResults: [gm, asq] },
    );
    const advice = dimensionAdvice(findings, 'MOT', fake);
    expect(advice?.toolId).toBe('sxk-gm');
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P4-中度']);
  });

  it("'overall' 的工具看全部面向，照題庫的面向順序 —— 不照快照裡物件鍵的順序（MySQL 的 JSON 欄位會重排鍵）", () => {
    // 刻意倒著插：存進資料庫再讀回來，鍵的順序就不是寫進去的那個了。
    const r = result('sxk-gm', { P5: stat(2, 80), P4: stat(1, 90), P3: stat(4, 40), P2: stat(1, 90), P1: stat(3, 60) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.sectionKey)).toEqual(['P1', 'P3', 'P5']);
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P1-中度', 'GM-P3-明顯', 'GM-P5-輕微']);
  });

  it('每一句附面向名稱（題庫原文），畫面要讓家長知道這句講的是哪一方面', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(3, 60), P3: stat(1, 90), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake);
    expect(advice?.consequences).toEqual([{ sectionKey: 'P2', sectionName: '坐姿控制', text: 'GM-P2-中度' }]);
  });
});

describe('哪些面向算數', () => {
  it('不單獨判讀的面向（scored=false，題數不到 minItems）不出句子，即使它的 tier 算得出來', () => {
    const r = result('sxk-gm', { P1: stat(4, 0, false), P2: stat(2, 80), P3: stat(1, 90), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.sectionKey)).toEqual(['P2']);
  });

  it('tier 是 null 的面向、快照裡根本沒有的面向，都跳過', () => {
    const r = result('sxk-gm', { P1: stat(null, null), P3: stat(3, 60) });
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.sectionKey)).toEqual(['P3']);
  });

  it('advice 缺某一個面向就是那一個面向不出句子，其餘照出；不丟錯', () => {
    const partial: ToolkitAdvice = {
      consequences: { P3: ['GM-P3-輕微', 'GM-P3-中度', 'GM-P3-明顯'] },
      plans: { P3: { title: 'GM-P3-標題', focus: ['GM-P3-重點1'] } },
    };
    const r = result('sxk-gm', { P1: stat(4, 40), P2: stat(1, 90), P3: stat(3, 60), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', id => (id === 'sxk-gm' ? partial : undefined));
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P3-中度']);
  });
});

describe('「建议后续项目」：tier ≥ 2 裡最差的兩個（§6.3 第 3 條）', () => {
  const ranked = (findings: T2Findings, dimension: DimensionCode) =>
    dimensionAdvice(findings, dimension, fake)?.plans.map(p => `${p.rank}:${p.sectionKey}`);

  it('tier 高者先：P3 明顯 → 主要方向、P5 中度 → 次要方向；P1 輕微排不進前兩個', () => {
    const r = result('sxk-gm', { P1: stat(2, 80), P2: stat(1, 90), P3: stat(4, 40), P4: stat(1, 88), P5: stat(3, 60) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', fake);
    expect(advice?.plans).toEqual([
      { rank: 'primary', sectionKey: 'P3', sectionName: '爬行与站立', title: 'GM-P3-標題', focus: ['GM-P3-重點1', 'GM-P3-重點2'] },
      { rank: 'secondary', sectionKey: 'P5', sectionName: '平衡与协调', title: 'GM-P5-標題', focus: ['GM-P5-重點1', 'GM-P5-重點2'] },
    ]);
  });

  it('只有一個面向 tier ≥ 2 → 只有主要方向', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(1, 90), P3: stat(2, 80), P4: stat(1, 88), P5: stat(1, 100) });
    expect(ranked(snapshot('MOT', 'watch', r), 'MOT')).toEqual(['primary:P3']);
  });

  it('同 tier、達成率族：百分比低者較差（P4 58% 先於 P2 65%，雖然 P2 在前面）', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(3, 65), P3: stat(1, 90), P4: stat(3, 58), P5: stat(1, 100) });
    expect(ranked(snapshot('MOT', 'refer', r), 'MOT')).toEqual(['primary:P4', 'secondary:P2']);
  });

  it('同 tier、獨立率族（ADL）：百分比低者較差', () => {
    const r = result('sxk-adl', { SC: stat(2, 70), SP: stat(2, 60), MO: stat(1, 90), CC: stat(2, 65) });
    expect(ranked(snapshot('ADL', 'watch', r), 'ADL')).toEqual(['primary:SP', 'secondary:CC']);
  });

  it('同 tier、關切率族（ASB）：百分比高者較差 —— 方向與達成率相反', () => {
    const r = result('sxk-asb', { SE: stat(3, 33), RE: stat(3, 38), BO: stat(1, 10), LA: stat(3, 35), SH: stat(1, 0) }, 60);
    expect(ranked(snapshot('SOC', 'refer', r), 'SOC')).toEqual(['primary:RE', 'secondary:LA']);
  });

  it('同 tier、總分族（LDP 的各方面）：百分比高者較差', () => {
    const r = result('sxk-ldp', { read: stat(2, 30), math: stat(2, 40), write: stat(1, 10), attn: stat(2, 35), lang: stat(1, 0) }, 96);
    expect(ranked(snapshot('LEARN', 'watch', r), 'LEARN')).toEqual(['primary:math', 'secondary:attn']);
  });

  it('tier 先於百分比（假資料刻意讓兩把鍵打架：關切率 tier 4 卻只有 20%，仍排在 tier 3 的 38% 前面）', () => {
    const r = result('sxk-asb', { SE: stat(3, 38), RE: stat(4, 20), BO: stat(1, 10), LA: stat(1, 10), SH: stat(1, 0) }, 60);
    expect(ranked(snapshot('SOC', 'refer', r), 'SOC')).toEqual(['primary:RE', 'secondary:SE']);
  });

  it('同 tier 同百分比 → 照面向順序', () => {
    const same = result('sxk-gm', { P1: stat(1, 95), P2: stat(3, 60), P3: stat(1, 90), P4: stat(3, 60), P5: stat(3, 60) });
    expect(ranked(snapshot('MOT', 'refer', same), 'MOT')).toEqual(['primary:P2', 'secondary:P4']);
  });

  it('同 tier、百分比算不出來的排在算得出來的後面（說不出多差，就不搶「主要方向」）；都算不出來照面向順序', () => {
    const unknown = result('sxk-gm', { P1: stat(3, null), P2: stat(3, 65), P3: stat(1, 90), P4: stat(3, 58), P5: stat(1, 100) });
    expect(ranked(snapshot('MOT', 'refer', unknown), 'MOT')).toEqual(['primary:P4', 'secondary:P2']);
    const none = result('sxk-gm', { P1: stat(1, 95), P2: stat(3, null), P3: stat(1, 90), P4: stat(3, null), P5: stat(1, 100) });
    expect(ranked(snapshot('MOT', 'refer', none), 'MOT')).toEqual(['primary:P2', 'secondary:P4']);
  });

  it('「若持续不处理」不跟著排序：照面向順序，每個 tier ≥ 2 的面向都有一句（不只前兩個）', () => {
    const r = result('sxk-gm', { P1: stat(2, 80), P2: stat(3, 65), P3: stat(1, 90), P4: stat(3, 58), P5: stat(4, 30) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', fake);
    expect(advice?.consequences.map(c => c.sectionKey)).toEqual(['P1', 'P2', 'P4', 'P5']);
    expect(advice?.plans.map(p => p.sectionKey)).toEqual(['P5', 'P4']);
  });

  it('最差那一格缺 PLAN：先取最差兩格、再拿掉缺的 —— 剩下的仍標「次要方向」，不升格成主要（照工具包的寫法）', () => {
    const noP5: ToolkitAdvice = {
      consequences: FAKE['sxk-gm']!.consequences,
      plans: { P4: { title: 'GM-P4-標題', focus: ['GM-P4-重點1'] }, P1: { title: 'GM-P1-標題', focus: ['GM-P1-重點1'] } },
    };
    const r = result('sxk-gm', { P1: stat(2, 80), P2: stat(1, 90), P3: stat(1, 90), P4: stat(3, 58), P5: stat(4, 30) });
    const advice = dimensionAdvice(snapshot('MOT', 'refer', r), 'MOT', id => (id === 'sxk-gm' ? noP5 : undefined));
    expect(advice?.plans.map(p => `${p.rank}:${p.sectionKey}`)).toEqual(['secondary:P4']);
  });

  it('回傳的 focus 是複本，改了不會汙染題庫那一份', () => {
    const r = result('sxk-gm', { P1: stat(1, 95), P2: stat(1, 90), P3: stat(2, 80), P4: stat(1, 88), P5: stat(1, 100) });
    const advice = dimensionAdvice(snapshot('MOT', 'watch', r), 'MOT', fake)!;
    advice.plans[0].focus.length = 0;
    expect(FAKE['sxk-gm']!.plans.P3.focus).toHaveLength(2);
  });
});

describe('兩段都不出的情形（§6.3 第 4 條與其他）', () => {
  it('推判定的那一支沒有 advice（CHEXI、SNAP-IV、M-CHAT、WARN、氣質……）→ null', () => {
    const snap = result('snap-iv', { IA: stat(3, null), HI: stat(3, null), OD: stat(1, null) }, 96);
    expect(dimensionAdvice(snapshot('ATT', 'refer', snap), 'ATT', fake)).toBeNull();
  });

  it('推判定的那一支在快照裡找不到（舊快照、資料對不上）→ null，不丟錯', () => {
    const findings = t2FindingsFixture({ MOT: { band: 'watch', drivenBy: 'sxk-gm' } }, { toolResults: [] });
    expect(dimensionAdvice(findings, 'MOT', fake)).toBeNull();
  });

  it('drivenBy 是 null → null', () => {
    const findings = t2FindingsFixture({ MOT: { band: 'watch' } });
    expect(dimensionAdvice(findings, 'MOT', fake)).toBeNull();
  });

  it('drivenBy 不餵這個維度（快照與登錄表對不上）→ null', () => {
    const r = result('sxk-gm', { P1: stat(4, 20), P2: stat(4, 20), P3: stat(4, 20), P4: stat(4, 20), P5: stat(4, 20) });
    const findings = t2FindingsFixture({ LANG: { band: 'refer', drivenBy: 'sxk-gm' } }, { toolResults: [r] });
    expect(dimensionAdvice(findings, 'LANG', fake)).toBeNull();
  });

  it('判了關注、但沒有一個面向 tier ≥ 2（例如 SXK-ASB 勾了「能力倒退」直接關注）→ null，不是兩個空段落', () => {
    const r = result('sxk-asb', { SE: stat(1, 10), RE: stat(1, 10), BO: stat(1, 10), LA: stat(1, 10), SH: stat(1, 0) }, 60);
    expect(dimensionAdvice(snapshot('SOC', 'refer', r), 'SOC', fake)).toBeNull();
  });
});

describe('走真的計分與彙整：快照存進資料庫再讀回來也取得到', () => {
  /** GM 36 個月、P2 全「偶尔会」（50%）、P4 全「还不会」（0%）、其餘全「已经会」。 */
  function gmFindings(): T2Findings {
    const answers: Record<string, AnswerValue> = {};
    for (const item of askedItems('sxk-gm', 36)) {
      answers[item.key] = item.sectionKey === 'P4' ? 0 : item.sectionKey === 'P2' ? 1 : 2;
    }
    const outcome = scoreTool({ toolId: 'sxk-gm', assessedAgeMonth: 36, rater: 'mother', answers, computedAt: at });
    if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
    const t1 = Object.fromEntries(DIMENSION_CODES.map(d => [d, d === 'MOT' ? 2 : 0])) as Record<DimensionCode, T1Flag>;
    const findings = buildT2Findings({ results: [outcome.result], t1Flags: t1, assessedAgeMonth: 36, computedAt: at });
    // 快照是存進 MySQL 的 JSON 欄位、再讀回來給畫面的。
    return JSON.parse(JSON.stringify(findings)) as T2Findings;
  }

  it('動作由 GM 推；P2 50%、P4 0% 都落在明顯 → 兩句都取第三句，同 tier 取百分比低的 P4 當主要方向', () => {
    const findings = gmFindings();
    const mot = findings.dimensions.find(d => d.dimensionId === 'MOT')!;
    expect(['watch', 'refer']).toContain(mot.band);
    expect(mot.drivenBy).toBe('sxk-gm');
    const gm = findings.toolResults[0];
    expect([gm.sections.P2.pct, gm.sections.P2.tier, gm.sections.P4.pct, gm.sections.P4.tier]).toEqual([50, 4, 0, 4]);
    const advice = dimensionAdvice(findings, 'MOT', fake);
    expect(advice?.consequences.map(c => c.text)).toEqual(['GM-P2-明顯', 'GM-P4-明顯']);
    expect(advice?.plans.map(p => `${p.rank}:${p.sectionKey}`)).toEqual(['primary:P4', 'secondary:P2']);
  });

  it('同一份快照、正式資料（預設來源）→ null：題庫現在沒有 advice，兩段不出現', () => {
    expect(dimensionAdvice(gmFindings(), 'MOT')).toBeNull();
  });
});

describe('正式資料：現在是空的（S23 之前）', () => {
  it('22 份題庫都沒有 advice —— 內容上線是一個要改這條測試的明確動作，不會跟著重跑抽取悄悄出現', () => {
    for (const id of TOOL_IDS) {
      expect(TOOLKIT[id].advice, id).toBeUndefined();
      expect(toolkitAdvice(id), id).toBeUndefined();
    }
  });

  it('上線條件（S23）：題庫裡每一句 CONSEQ／PLAN 都過《用语对照表》禁字掃描；現在沒有句子，所以恆綠', () => {
    const texts = TOOL_IDS.flatMap(id => {
      const advice = TOOLKIT[id].advice;
      if (!advice) return [];
      return [
        ...Object.values(advice.consequences).flat(),
        ...Object.values(advice.plans).flatMap(p => [p.title, ...p.focus]),
      ].map(text => ({ id, text }));
    });
    for (const { id, text } of texts) expect(findBannedWords(text), `${id}：${text}`).toEqual([]);
  });
});

describe('畫面與 AI 提示', () => {
  it('段名、段首句、主要／次要方向都過《用语对照表》；段名不沿用工具包的「建议治疗项目」', () => {
    const copy = [...Object.values(ADVICE_HEADING), ADVICE_LEAD_SENTENCE, ...Object.values(ADVICE_RANK_LABEL)];
    for (const text of copy) expect(findBannedWords(text), text).toEqual([]);
    expect(ADVICE_HEADING.plans).not.toContain('治疗');
    // 工作單 #10：措辭保留「一般走向，不是对这个孩子的预测」。
    expect(ADVICE_LEAD_SENTENCE).toContain('一般走向');
    expect(ADVICE_LEAD_SENTENCE).toContain('不是对这个孩子的预测');
  });

  it('AI 的系統提示寫明這兩段不歸它寫（「你不可以做的」那一段）', () => {
    const { system } = buildProsePrompt({
      findings: t2FindingsFixture({ MOT: { band: 'watch', drivenBy: 'sxk-gm' } }),
      activities: { picks: [], preparing: [] },
      goals: [],
    });
    const forbidden = system.slice(system.indexOf('【你不可以做的】'), system.indexOf('【禁止出现的词】'));
    expect(forbidden).toContain(NO_ADVICE_SECTIONS_RULE);
    // 段名與畫面同一份字：模型看到的段名就是家長看到的段名。
    expect(NO_ADVICE_SECTIONS_RULE).toContain(ADVICE_HEADING.consequences);
    expect(NO_ADVICE_SECTIONS_RULE).toContain(ADVICE_HEADING.plans);
  });
});
