import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { SAFETY_SENTENCE, SCHOOL_AGE_NO_TOOL_SENTENCE } from '../src/t2/report/sentences';
import { SITE_DIMENSION_NAME } from '../src/t2/dimensionMap';
import { TOOL_SPECS } from '../src/t2/toolSpecs';
import { toSimplified } from '../src/t2/answering';
import { buildT2Findings } from '../src/t2/findings';
import type { DimensionBand, DimensionCode, DimensionFinding, T1Flag, ToolResult } from '../src/t2/types';
import {
  DIMENSION_STATE_LABEL,
  DIMENSION_STATE_SENTENCE,
  RETEST_SENTENCE,
  REVIEW_EMPTY_SENTENCE,
  dimensionStatus,
  gridDimensions,
  redoSentence,
  reviewGroups,
  stripSafetyPrefix,
  toolHeading,
  unstableItems,
} from '../src/t2/reportCopy';

/**
 * 報告頁的句子層（票 #61，規格 §6.3、§6.4）。純函式，元件只排版。
 *
 * 釘四件事：
 * 1. **作答回顧列的是題目原文，而且只列「尚未穩定」的**：達成率族答 0／1、關切率族答 2／3、
 *    獨立率 ≤4（票 #61 的三條），其餘族比照工具包報告的那一段。全答最好的那一支不列。
 * 2. **四種非 band 值與 clear 分得開**（§5.7）：partial／not_assessed／no_tool 各有自己的句子，
 *    沒有一句與 clear 的三級標示相同。
 * 3. **band 的說法來自全站唯一的那一份**（`statusWording.ts`），不在這裡另寫。
 * 4. `safety_concern` 的那一句在畫面上置頂一次，overview 裡的那一份拿掉，不重複。
 */

function score(toolId: ToolId, ageMonth: number, answers: Record<string, AnswerValue>, pre?: Record<string, string | string[] | boolean>): ToolResult {
  const outcome = scoreTool({ toolId, assessedAgeMonth: ageMonth, rater: 'mother', answers, pre, computedAt: '2026-09-12T00:00:00.000Z' });
  if (!outcome.ok) throw new Error(`預期算得出來，卻拒算：${outcome.reason}`);
  return outcome.result;
}

function flat(toolId: ToolId, ageMonth: number, value: AnswerValue): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const a of askedItems(toolId, ageMonth)) out[a.key] = value;
  return out;
}

describe('作答回顧：尚未穩定的項目', () => {
  it('sxk-lang 有兩題答「偶尔会」→ 列出那兩題的原文與所答的選項', () => {
    const answers = flat('sxk-lang', 48, 2);
    const asked = askedItems('sxk-lang', 48);
    answers[asked[0].key] = 1;
    answers[asked[5].key] = 0;
    const items = unstableItems(score('sxk-lang', 48, answers));
    expect(items.map(i => i.text)).toEqual([asked[0].item.text, asked[5].item.text]);
    expect(items.map(i => i.answer)).toEqual(['偶尔会', '还不会']);
    expect(items[0].sectionName).toBe(TOOLKIT['sxk-lang'].sections[0].name);
  });

  it('全答「已经会」→ 一題都不列', () => {
    expect(unstableItems(score('sxk-lang', 48, flat('sxk-lang', 48, 2)))).toEqual([]);
  });

  it('關切率族只列「经常／总是」；獨立率只列 ≤4', () => {
    const asb = flat('sxk-asb', 48, 0);
    const asbAsked = askedItems('sxk-asb', 48);
    asb[asbAsked[0].key] = 1;
    asb[asbAsked[1].key] = 2;
    asb[asbAsked[2].key] = 3;
    const asbItems = unstableItems(score('sxk-asb', 48, asb, { regression: 'none' }));
    expect(asbItems.map(i => i.text)).toEqual([asbAsked[1].item.text, asbAsked[2].item.text]);
    expect(asbItems.map(i => i.answer)).toEqual(['经常', '总是']);

    const adl = flat('sxk-adl', 48, 7);
    const adlAsked = askedItems('sxk-adl', 48);
    adl[adlAsked[0].key] = 5;
    adl[adlAsked[1].key] = 4;
    adl[adlAsked[2].key] = 1;
    const adlItems = unstableItems(score('sxk-adl', 48, adl));
    expect(adlItems.map(i => i.text)).toEqual([adlAsked[1].item.text, adlAsked[2].item.text]);
  });

  it('M-CHAT 的題目原文經簡體轉換；答成風險方向的才列', () => {
    const answers = flat('mchat-rf', 24, 'yes');
    const asked = askedItems('mchat-rf', 24);
    // 題 2、5、12 是答「是」算風險，其餘答「否」算風險 —— 全答「是」時剛好只有那三題。
    const items = unstableItems(score('mchat-rf', 24, answers, { concern: 'no' }));
    expect(items.map(i => i.no)).toEqual([2, 5, 12]);
    expect(items[0].text).toBe(toSimplified(asked[1].item.text));
    expect(items[0].text).not.toBe(asked[1].item.text);
  });

  it('氣質量表不列（沒有「尚未穩定」這回事）', () => {
    expect(unstableItems(score('sxk-tempb', 48, flat('sxk-tempb', 48, 5)))).toEqual([]);
  });

  it('reviewGroups：依快照裡的工具分組，沒有項目的那一支不出現', () => {
    const answers = flat('sxk-lang', 48, 2);
    answers[askedItems('sxk-lang', 48)[0].key] = 1;
    const findings = t2FindingsFixture({}, {
      toolResults: [score('sxk-gm', 48, flat('sxk-gm', 48, 2)), score('sxk-lang', 48, answers)],
    });
    const groups = reviewGroups(findings);
    expect(groups.map(g => g.toolId)).toEqual(['sxk-lang']);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].heading).toBe(toolHeading('sxk-lang'));
  });

  it('工具的標題是維度名加代號，不是工具包的量表名（那些名字對家長沒有意義，還帶著禁字）', () => {
    expect(toolHeading('sxk-lang')).toBe('语言沟通 · SXK-LANG');
    expect(toolHeading('sxk-asq')).toBe('认知、语言沟通、社交互动、动作发展 · SXK-ASQ');
    for (const id of TOOL_IDS) expect(findBannedWords(toolHeading(id)), id).toEqual([]);
  });

  it('給了測評月齡只列那時生效的 feed（v2.1 §4.3）；一條都不生效就照全部列', () => {
    const n = SITE_DIMENSION_NAME;
    expect(toolHeading('sxk-adl', 48)).toBe(`${n.ADL} · SXK-ADL`);
    expect(toolHeading('sxk-adl', 96)).toBe(`${n.MOT}、${n.ADL} · SXK-ADL`);          // 加上移动与转位 → 動作
    expect(toolHeading('sxk-ldp', 72)).toBe(`${n.LEARN} · SXK-LDP`);                  // 语言处理 73 起
    expect(toolHeading('sxk-ldp', 100)).toBe(`${n.LANG}、${n.LEARN} · SXK-LDP`);
    expect(toolHeading('sxk-tempa', 24)).toBe(`${n.EMO}、${n.ATT} · ${TOOL_SPECS['sxk-tempa'].code}`);
    expect(toolHeading('sxk-tempa', 36)).toBe(`${n.EMO} · ${TOOL_SPECS['sxk-tempa'].code}`);   // 注意力到 35
    expect(toolHeading('sxk-tempb', 72)).toBe(toolHeading('sxk-tempb'));                  // 段外只出標籤，照全部列
  });

  it('reviewGroups 的標題看那一筆自己的測評月齡', () => {
    const answers = flat('sxk-adl', 48, 7);
    answers[askedItems('sxk-adl', 48)[0].key] = 1;
    const groups = reviewGroups(t2FindingsFixture({}, { toolResults: [score('sxk-adl', 48, answers)] }));
    expect(groups.map(g => g.heading)).toEqual([toolHeading('sxk-adl', 48)]);
  });
});

/** 一個維度的快照（只有狀態句會讀的那幾格）。`t1Flag` 給 `undefined` 是模擬讀不到這一格的舊資料。 */
function dim(band: DimensionBand, t1Flag: T1Flag | undefined, dimensionId: DimensionCode = 'SEN'): DimensionFinding {
  return { dimensionId, band, drivenBy: null, tags: [], caveats: [], tools: [], t1Flag: t1Flag as T1Flag };
}

describe('維度的狀態句', () => {
  const clear = dimensionStatus(dim('clear', 0), 48);

  it('三級 band 走 statusWording', () => {
    expect(clear).toEqual({ kind: 'band', status: 'normal', label: STATUS_WORDING.normal.label, tag: STATUS_WORDING.normal.tag });
    expect(dimensionStatus(dim('watch', 1), 48).tag).toBe(STATUS_WORDING.borderline.tag);
    expect(dimensionStatus(dim('refer', 2), 48).tag).toBe(STATUS_WORDING.delay.tag);
  });

  it.each([
    ['partial', 2],
    ['not_assessed', 1],
    ['no_tool', 2],
  ] as const)('%s 明寫「還沒做完／沒做／沒有問卷」，與 clear 的顯示不同', (band, flag) => {
    const s = dimensionStatus(dim(band, flag), 48);
    expect(s.kind).toBe('state');
    expect(s.label).not.toBe(clear.label);
    expect(s.tag).not.toBe(clear.tag);
    expect(s.tag).toBe(DIMENSION_STATE_SENTENCE[band]);
    expect(findBannedWords(s.tag)).toEqual([]);
    expect(findBannedWords(s.label)).toEqual([]);
  });

  it('partial 說的是「還沒做完」、not_assessed 是「沒有做」、no_tool 是「沒有問卷」—— 三句互不相同', () => {
    const tags = [dim('partial', 2), dim('not_assessed', 1), dim('no_tool', 2)].map(d => dimensionStatus(d, 48).tag);
    expect(new Set(tags).size).toBe(3);
    expect(tags[0]).toContain('还没做完');
    expect(tags[1]).toContain('没有做');
    expect(tags[2]).toContain('问卷');
  });

  // v2.1 S08：不篩的維度畫面上不出這一格，所以沒有句子；走到這裡是呼叫端沒先過 `gridDimensions`
  it('not_screened 沒有句子：傳進來就丟錯，不安靜地印成某一種「沒有判定」', () => {
    expect(() => dimensionStatus(dim('not_screened', 2), 10)).toThrow(/not_screened/);
  });
});

/**
 * v2.1 S02（§4.2，客戶 9/21 工作單 #2）：沒做的維度帶 T1 的紅／黃，短標籤兩種都是「此次没做」。
 * 顏色看 `t1Flag`，不看 band 名稱；`no_tool` 是「沒得做」不是「沒做」，維持灰。
 */
describe('沒做的維度帶 T1 顏色（v2.1 S02）', () => {
  it('partial（T1 紅）→ 紅的那一組；not_assessed（T1 黃）→ 黃的那一組；短標籤都是「此次没做」', () => {
    expect(dimensionStatus(dim('partial', 2), 48)).toMatchObject({ kind: 'state', tone: 'delay', label: '此次没做' });
    expect(dimensionStatus(dim('not_assessed', 1), 48)).toMatchObject({ kind: 'state', tone: 'borderline', label: '此次没做' });
  });

  it('整句不變：仍分「还没做完」與「这次没有做问卷」兩種說法', () => {
    expect(dimensionStatus(dim('partial', 2), 48).tag).toBe('这一项的问卷还没做完，这次没有它的结果');
    expect(dimensionStatus(dim('not_assessed', 1), 48).tag).toBe('这一项这次没有做问卷，先照第一层的结果看');
  });

  it('顏色依 t1Flag，不依 band 名稱推', () => {
    expect(dimensionStatus(dim('partial', 1), 48)).toMatchObject({ tone: 'borderline' });
    expect(dimensionStatus(dim('not_assessed', 2), 48)).toMatchObject({ tone: 'delay' });
  });

  it.each([2, 1] as const)('no_tool 維持灰（T1 標 %i 也一樣）：它是「沒得做」，短標籤不是「此次没做」', flag => {
    const s = dimensionStatus(dim('no_tool', flag), 48);
    expect(s).toMatchObject({ kind: 'state', tone: 'state', label: '暂无问卷' });
  });

  // v2.1 §10：舊快照不可變、照存的樣子讀。讀不到 t1Flag（或值對不上）時不猜一個顏色，退回灰，不丟錯
  it.each([
    ['沒有 t1Flag', undefined],
    ['t1Flag 是 0', 0],
  ] as const)('舊快照 %s：不丟錯、退回灰，字照舊', (_label, flag) => {
    const s = dimensionStatus(dim('partial', flag), 48);
    expect(s).toMatchObject({ kind: 'state', tone: 'state', label: '此次没做', tag: DIMENSION_STATE_SENTENCE.partial });
  });

  it('紅黃仍不是綠：沒有一種「沒有判定」的顏色等於 clear', () => {
    for (const d of [dim('partial', 2), dim('not_assessed', 1), dim('no_tool', 2)]) {
      const s = dimensionStatus(d, 48);
      expect(s.kind === 'state' ? s.tone : s.status, d.band).not.toBe('normal');
    }
  });
});

/**
 * v2.1 S05（§4.6，客戶 9/21 工作單 #6）：認知、語言、動作，測評月齡 ≥73、這個維度沒有星號 → 狀態句換成客戶的
 * 固定句（原樣）。九宮格那一格與 no_tool 段的標題都走 `dimensionStatus`，所以兩處一起換。
 * 其他 no_tool（感覺 0–23、學習 37–71、情緒 0–11）長大後確實有工具，句子不變。
 */
describe('6 歲以上的認知、語言、動作（v2.1 S05）', () => {
  const FIXED = '6 岁以上的认知、语言、动作目前没有家长自填工具，建议到院做专业评估';

  it('80 個月語言紅、什麼都沒做（走真的 buildT2Findings）→ no_tool，狀態句是固定句；標籤仍是「暂无问卷」', () => {
    const findings = buildT2Findings({
      results: [],
      t1Flags: { COG: 0, LANG: 2, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0 },
      assessedAgeMonth: 80,
      computedAt: '2026-09-24T00:00:00.000Z',
    });
    const lang = findings.dimensions.find(d => d.dimensionId === 'LANG')!;
    expect(lang.band).toBe('no_tool');
    expect(dimensionStatus(lang, 80)).toEqual({ kind: 'state', tone: 'state', label: '暂无问卷', tag: FIXED });
    expect(SCHOOL_AGE_NO_TOOL_SENTENCE).toBe(FIXED);
  });

  it.each([
    ['COG', 73], ['LANG', 73], ['MOT', 73], ['COG', 216], ['LANG', 144], ['MOT', 200],
  ] as const)('%s %i 個月的 no_tool → 固定句', (d, month) => {
    expect(dimensionStatus(dim('no_tool', 2, d), month).tag).toBe(FIXED);
    expect(dimensionStatus(dim('no_tool', 1, d), month).tag).toBe(FIXED);
  });

  it.each([
    ['SEN', 12], ['LEARN', 48], ['EMO', 6], ['SEN', 190], ['ADL', 190],
    ['LANG', 72],   // 72 個月以下不是這一句（那時語言有 sxk-lang；快照若寫著 no_tool 也不改說法）
  ] as const)('其他 no_tool 句子不變：%s %i 個月', (d, month) => {
    expect(dimensionStatus(dim('no_tool', 2, d), month).tag).toBe(DIMENSION_STATE_SENTENCE.no_tool);
  });

  it('只換 no_tool 那一句：同一格若是 partial／not_assessed 或三級 band，說法照舊', () => {
    expect(dimensionStatus(dim('partial', 2, 'LANG'), 96).tag).toBe(DIMENSION_STATE_SENTENCE.partial);
    expect(dimensionStatus(dim('refer', 2, 'LANG'), 96).tag).toBe(STATUS_WORDING.delay.tag);
  });

  it('固定句過家長用字掃描（「建议」與「评估」不相連）', () => {
    expect(findBannedWords(FIXED)).toEqual([]);
  });
});

describe('九宮格出哪幾格（v2.1 S08）', () => {
  /** 10 個月、學習與注意力紅、語言紅：走真的 `buildT2Findings`。 */
  const tenMonths = buildT2Findings({
    results: [],
    t1Flags: { COG: 0, LANG: 2, SOC: 0, EMO: 0, ATT: 2, MOT: 0, SEN: 0, ADL: 0, LEARN: 2 },
    assessedAgeMonth: 10,
    computedAt: '2026-09-24T00:00:00.000Z',
  });

  it('10 個月的個案只有七格：學習、注意力不出（findings 本身仍是九筆）', () => {
    expect(tenMonths.dimensions).toHaveLength(9);
    const grid = gridDimensions(tenMonths);
    expect(grid.map(d => d.dimensionId)).toEqual(['COG', 'LANG', 'SOC', 'EMO', 'MOT', 'SEN', 'ADL']);
    for (const d of grid) expect(() => dimensionStatus(d, 10)).not.toThrow();
  });

  it('學習 37 個月、注意力 12 個月起回到九格', () => {
    const at = (m: number) => gridDimensions(buildT2Findings({
      results: [], t1Flags: tenMonths.t1, assessedAgeMonth: m, computedAt: '2026-09-24T00:00:00.000Z',
    })).map(d => d.dimensionId);
    expect(at(12)).toHaveLength(8);
    expect(at(12)).not.toContain('LEARN');
    expect(at(37)).toHaveLength(9);
  });

  // v2.1 §10：舊快照不可變、照存的樣子顯示。那時 10 個月的學習、注意力是 no_tool，九格照舊
  it('舊快照沒有 not_screened：九格照存的樣子出', () => {
    const old = t2FindingsFixture(
      { LEARN: { band: 'no_tool', t1Flag: 2 }, ATT: { band: 'no_tool', t1Flag: 2 } },
      { child: { assessedAgeMonth: 10 }, rulesVersion: 'v2-2026-09-11' },
    );
    expect(gridDimensions(old).map(d => [d.dimensionId, d.band])).toEqual(old.dimensions.map(d => [d.dimensionId, d.band]));
    for (const d of gridDimensions(old)) expect(() => dimensionStatus(d, old.child.assessedAgeMonth)).not.toThrow();
  });
});

describe('其餘句子', () => {
  it('safety 那一句從 overview 開頭拿掉；不是以它開頭的原樣回', () => {
    expect(stripSafetyPrefix(`${SAFETY_SENTENCE}这份报告……`)).toBe('这份报告……');
    expect(stripSafetyPrefix('这份报告……')).toBe('这份报告……');
  });

  it('距上次 N 天', () => {
    expect(redoSentence(3)).toBe('距上次填写 3 天');
    expect(redoSentence(0)).toBe('今天已经填过一次');
  });

  // v2.1 §4.10（S14，客戶 9/21 工作單 #18 沒打卡那一半）：句子是規格的暫採，原樣
  it('三个月后重评：規格暫採的那一句，原樣', () => {
    expect(RETEST_SENTENCE).toBe('三个月后重评一次，看看这段时间练下来的变化。');
  });

  it('句子都過家長用字掃描', () => {
    for (const text of [
      REVIEW_EMPTY_SENTENCE, redoSentence(5), RETEST_SENTENCE,
      ...Object.values(DIMENSION_STATE_SENTENCE), ...Object.values(DIMENSION_STATE_LABEL),
    ]) {
      expect(findBannedWords(text), text).toEqual([]);
    }
  });
});
