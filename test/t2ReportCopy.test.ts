import { describe, it, expect } from 'vitest';
import { findBannedWords } from './helpers/parentWording';
import { t2FindingsFixture } from './helpers/t2Fixtures';
import { STATUS_WORDING } from '../src/utils/statusWording';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { askedItems, scoreTool } from '../src/t2/scoring';
import type { AnswerValue } from '../src/t2/scoring';
import { SAFETY_SENTENCE } from '../src/t2/report/sentences';
import { toSimplified } from '../src/t2/answering';
import type { DimensionBand, ToolResult } from '../src/t2/types';
import {
  DIMENSION_STATE_SENTENCE,
  REVIEW_EMPTY_SENTENCE,
  dimensionStatus,
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
});

describe('維度的狀態句', () => {
  const clear = dimensionStatus('clear');

  it('三級 band 走 statusWording', () => {
    expect(dimensionStatus('clear')).toEqual({ kind: 'band', status: 'normal', label: STATUS_WORDING.normal.label, tag: STATUS_WORDING.normal.tag });
    expect(dimensionStatus('watch').tag).toBe(STATUS_WORDING.borderline.tag);
    expect(dimensionStatus('refer').tag).toBe(STATUS_WORDING.delay.tag);
  });

  it.each(['partial', 'not_assessed', 'no_tool'] as const)('%s 明寫「還沒做完／沒做／沒有問卷」，與 clear 的顯示不同', band => {
    const s = dimensionStatus(band);
    expect(s.kind).toBe('state');
    expect(s.label).not.toBe(clear.label);
    expect(s.tag).not.toBe(clear.tag);
    expect(s.tag).toBe(DIMENSION_STATE_SENTENCE[band]);
    expect(findBannedWords(s.tag)).toEqual([]);
    expect(findBannedWords(s.label)).toEqual([]);
  });

  it('partial 說的是「還沒做完」、not_assessed 是「沒有做」、no_tool 是「沒有問卷」—— 三句互不相同', () => {
    const bands: DimensionBand[] = ['partial', 'not_assessed', 'no_tool'];
    const tags = bands.map(b => dimensionStatus(b).tag);
    expect(new Set(tags).size).toBe(3);
    expect(dimensionStatus('partial').tag).toContain('还没做完');
    expect(dimensionStatus('not_assessed').tag).toContain('没有做');
    expect(dimensionStatus('no_tool').tag).toContain('问卷');
  });
});

describe('其餘句子', () => {
  it('safety 那一句從 overview 開頭拿掉；不是以它開頭的原樣回', () => {
    expect(stripSafetyPrefix(`${SAFETY_SENTENCE}这份报告……`)).toBe('这份报告……');
    expect(stripSafetyPrefix('这份报告……')).toBe('这份报告……');
  });

  it('距上次 N 天', () => {
    expect(redoSentence(3)).toBe('距上次填写 3 天');
    expect(redoSentence(0)).toBe('距上次填写 0 天');
  });

  it('句子都過家長用字掃描', () => {
    for (const text of [REVIEW_EMPTY_SENTENCE, redoSentence(5), ...Object.values(DIMENSION_STATE_SENTENCE)]) {
      expect(findBannedWords(text), text).toEqual([]);
    }
  });
});
