import { describe, it, expect } from 'vitest';
import { formV3 } from '../src/t2/answeringV3';
import { KITV3_BANKS } from '../src/t2/kitv3';
import type { KitV3Score } from '../src/t2/kitv3/score';
import { scoreToolV3, type ToolResultV3 } from '../src/t2/kitv3/submit';
import {
  NOTICE_SENTENCE_V3,
  QOL_SENTENCE,
  noticeLinesV3,
  qolSummaryV3,
  reviewGroupsV3,
  temperamentLinesV3,
  toolNameV3,
} from '../src/t2/reportCopyV3';
import { findBannedWords } from './helpers/parentWording';

/**
 * 完整版報告的句子層（題庫規格 §5.3）：最上方提示、生活品質、氣質的偏向、作答回顧挑哪幾題。
 */

const NOW = new Date('2026-10-07T08:00:00Z');

/** 用真的題庫與真的交卷路徑算一筆：每一題都答 `pick(選項)` 挑的那一個。 */
function answered(toolId: string, ageM: number, pick: (values: Array<number | null>) => number | null, child: { inSchool?: boolean; sex?: 'male' | 'female' } = {}): ToolResultV3 {
  const bank = KITV3_BANKS[toolId];
  const form = formV3(bank, { ageM, ...child });
  const answers: Record<string, number | null> = {};
  for (const s of form.sections) for (const it of s.items) answers[it.key] = pick(s.options.map(o => o.value));
  const got = scoreToolV3({ toolId, assessedAgeMonth: ageM, rater: 'mother', answers }, child, NOW);
  if (!got.ok) throw new Error(`${toolId}: ${got.body.error}`);
  return got.result;
}
const best = (vs: Array<number | null>) => vs.find(v => v !== null)!;
const worst = (vs: Array<number | null>) => [...vs].reverse().find(v => v !== null)!;

function fake(toolId: string, score: Partial<KitV3Score>): ToolResultV3 {
  return {
    toolkitVersion: 'kit-20260923',
    toolId,
    assessedAgeMonth: 48,
    rater: 'mother',
    context: { ageM: 48 },
    answers: {},
    score: { code: toolId, form: 'x', facets: [], total: { value: null, band: null, bandName: null }, grade03: {}, missing: [], ...score },
    computedAt: NOW.toISOString(),
  };
}

describe('noticeLinesV3', () => {
  it('量表名稱取推薦設定的客規名稱；同一句只出一次；同一支有 refer 就不再講 priority', () => {
    const lines = noticeLinesV3({
      notices: [
        { toolId: 'SXK-TIC', flag: 'refer' },
        { toolId: 'SXK-TIC', flag: 'priority' },
        { toolId: 'SXK-EMO', flag: 'impact_high' },
        { toolId: 'SXK-EMO', flag: 'impact_high' },
        { toolId: 'SXK-ASQ3', flag: 'unknown_flag' },
      ],
    });
    expect(lines).toEqual([
      NOTICE_SENTENCE_V3.refer.replace('{name}', toolNameV3('SXK-TIC')),
      NOTICE_SENTENCE_V3.impact_high,
    ]);
    expect(toolNameV3('SXK-TIC')).not.toBe('SXK-TIC');
  });

  it('只有 priority 時講 priority', () => {
    expect(noticeLinesV3({ notices: [{ toolId: 'SXK-TIC', flag: 'priority' }] })).toEqual([
      NOTICE_SENTENCE_V3.priority.replace('{name}', toolNameV3('SXK-TIC')),
    ]);
  });

  it('設定裡沒有的代碼退回代碼本身', () => {
    expect(toolNameV3('NOPE')).toBe('NOPE');
  });
});

describe('qolSummaryV3', () => {
  it('都答「很少或没有」：第一句、沒有比較明顯的面向', () => {
    const got = qolSummaryV3(answered('SXK-QOL', 60, best, { inSchool: true }))!;
    expect(got.sentence).toBe(QOL_SENTENCE[0]);
    expect(got.heavier).toEqual([]);
  });

  it('都答「总是」：最後一句、每一面都列', () => {
    const r = answered('SXK-QOL', 60, worst, { inSchool: true });
    const got = qolSummaryV3(r)!;
    expect(got.sentence).toBe(QOL_SENTENCE[3]);
    expect(got.heavier).toEqual(r.score.facets.map(f => f.name));
  });

  it('分段名稱（「明显」「中度」）不出現在家長的句子裡', () => {
    const got = qolSummaryV3(answered('SXK-QOL', 60, worst, { inSchool: true }))!;
    expect(got.sentence).not.toContain('明显的是');
    expect(QOL_SENTENCE.join('')).not.toMatch(/中度|轻微/);
  });
});

describe('temperamentLinesV3', () => {
  const bank = KITV3_BANKS['ITQ/TTS/BSQ'];

  it('偏向哪一端照那一表的 poles：BSQ 與 TTS 的「规律性」方向相反', () => {
    const facets = [{ key: '规律性', name: '规律性', n: 1, value: 1, band: 2 }];
    expect(temperamentLinesV3(fake('ITQ/TTS/BSQ', { form: 'TTS', facets }), bank)).toEqual([{ dimension: '规律性', band: 2, text: '偏向无规律' }]);
    expect(temperamentLinesV3(fake('ITQ/TTS/BSQ', { form: 'BSQ', facets }), bank)).toEqual([{ dimension: '规律性', band: 2, text: '偏向有规律' }]);
  });

  it('低分端、居中；沒答到的向度不出', () => {
    const facets = [
      { key: '活动量', name: '活动量', n: 1, value: 1, band: 0 },
      { key: '坚持度', name: '坚持度', n: 1, value: 1, band: 1 },
      { key: '反应阈', name: '反应阈', n: 1, value: null, band: null },
    ];
    expect(temperamentLinesV3(fake('ITQ/TTS/BSQ', { form: 'TTS', facets }), bank).map(l => l.text)).toEqual(['偏向小', '居中']);
  });

  it('真的作答算出來的九個向度都對得到兩極', () => {
    const r = answered('ITQ/TTS/BSQ', 48, best, { sex: 'male' });
    expect(temperamentLinesV3(r, bank)).toHaveLength(9);
  });
});

describe('reviewGroupsV3', () => {
  it('能力題都答最差：每一題都列，答案是那一檔的字', () => {
    const r = answered('SXK-GM', 24, worst);
    const groups = reviewGroupsV3({ toolResults: [r] }, { 'SXK-GM': KITV3_BANKS['SXK-GM'] });
    const asked = formV3(KITV3_BANKS['SXK-GM'], r.context).sections.flatMap(s => s.items);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe(toolNameV3('SXK-GM'));
    expect(groups[0].items.map(i => i.key)).toEqual(asked.map(i => i.key));
    expect(new Set(groups[0].items.map(i => i.answer))).toEqual(new Set(['还不会']));
  });

  it('都答最好：不出那一組', () => {
    const r = answered('SXK-GM', 24, best);
    expect(reviewGroupsV3({ toolResults: [r] }, { 'SXK-GM': KITV3_BANKS['SXK-GM'] })).toEqual([]);
  });

  it('只有兩檔的（M-CHAT 是／否）不列；氣質、生活品質不列；題庫沒載到的先不列', () => {
    const mchat = answered('M-CHAT-R/F', 20, worst);
    const temp = answered('ITQ/TTS/BSQ', 48, worst, { sex: 'male' });
    const qol = answered('SXK-QOL', 60, worst, { inSchool: true });
    const gm = answered('SXK-GM', 24, worst);
    const banks = { 'M-CHAT-R/F': KITV3_BANKS['M-CHAT-R/F'], 'ITQ/TTS/BSQ': KITV3_BANKS['ITQ/TTS/BSQ'], 'SXK-QOL': KITV3_BANKS['SXK-QOL'] };
    expect(reviewGroupsV3({ toolResults: [mchat, temp, qol, gm] }, banks)).toEqual([]);
  });

  it('「不确定」那類不算一檔', () => {
    const r = answered('SXK-LQ', 36, vs => (vs.includes(null) ? null : best(vs)));
    expect(reviewGroupsV3({ toolResults: [r] }, { 'SXK-LQ': KITV3_BANKS['SXK-LQ'] })).toEqual([]);
  });
});

describe('句子沒有禁字', () => {
  it('提示、生活品質', () => {
    for (const s of [...Object.values(NOTICE_SENTENCE_V3), ...QOL_SENTENCE]) expect(findBannedWords(s), s).toEqual([]);
  });
});
