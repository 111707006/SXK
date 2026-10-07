import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildRecommendInput, correctedAgeMonth, levelOf } from '../src/t2/recommend/input';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import { recommend } from '../src/t2/recommend/engine';
import { T1_AGE_BANDS } from '../src/t1Data';
import { SITE_DIMENSION_ID } from '../src/t2/dimensionMap';
import type { DimensionCode } from '../src/t2/types';

/**
 * 孩子資料＋T1 → 推薦輸入（T2 v3 推薦規格 §2）。
 *
 * 最要緊的是第一條：客規 §8 的關鍵題是用「組＋維度＋題序」指的，我們的 T1 題目照那個位置找得到、而且文字一字不差 ——
 * 位置錯一格，「叫名字没反应」的孩子就不會被推 M-CHAT。題目文字從客規逐字轉錄（同一個 md）讀。
 */

const MD = fs.readFileSync(
  path.join(__dirname, '..', 'docs/reference/client-mockups/森心康_T2量表推荐规则规格书_v1.0-2026-10-06.md'),
  'utf8',
);

const DIM_OF_NAME: Record<string, DimensionCode> = {
  动作发展: 'MOT', 感觉处理: 'SEN', 认知: 'COG', 注意力与执行: 'ATT', 学习能力: 'LEARN',
  语言沟通: 'LANG', 社交互动: 'SOC', 情绪与行为: 'EMO', 生活自理与适应: 'ADL',
};

/** 客規 §8 表格的每一列：組、維度、題序（1 起）、題目。 */
function keyItemRows() {
  const s8 = MD.slice(MD.indexOf('**8　T1 关键题触发**'), MD.indexOf('**9　推荐算法**'));
  return [...s8.matchAll(/^\| ([A-E]) \| ([^|]+) \| (\d) \| ([^|]+) \|/gm)].map(m => ({
    band: m[1],
    dim: DIM_OF_NAME[m[2].trim()],
    no: Number(m[3]),
    text: m[4].trim(),
  }));
}

function questionAt(band: string, dim: DimensionCode, idx: number) {
  const b = T1_AGE_BANDS.find(x => x.id === band)!;
  return b.questions.filter(q => q.dimensionId === SITE_DIMENSION_ID[dim])[idx];
}

describe('客規 §8 關鍵題 ↔ 我們的 T1 題目', () => {
  const rows = keyItemRows();

  it('客規表格 22 列、附錄 A 的 keyItems 22 條，一一對應（組、維度、題序）', () => {
    expect(rows).toHaveLength(22);
    const fromConfig = RECOMMEND_CONFIG.keyItems.map(k => `${k.band}-${k.dim}-${k.idx + 1}`).sort();
    expect(rows.map(r => `${r.band}-${r.dim}-${r.no}`).sort()).toEqual(fromConfig);
  });

  it.each(keyItemRows().map(r => [`${r.band} 組 ${r.dim} 第 ${r.no} 題`, r] as const))('%s 的文字一字不差', (_, r) => {
    expect(questionAt(r.band, r.dim, r.no - 1)?.text).toBe(r.text);
  });

  it('紅旗題（isRedFlag）都在關鍵題裡或是客規說的紅旗維度（A 組注意力第 1 題＝叫名字）', () => {
    expect(questionAt('A', 'ATT', 0)).toMatchObject({ text: '叫名字会回头或有反应', isRedFlag: true });
  });
});

describe('等級與月齡', () => {
  it('客規 §1：8–7 未見明顯、6–5 輕度、4–3 中度、2–0 明顯；紅旗「还不能」至少中度', () => {
    expect([8, 7, 6, 5, 4, 3, 2, 1, 0].map(s => levelOf(s, false))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3]);
    expect([8, 6, 4, 2].map(s => levelOf(s, true))).toEqual([2, 2, 2, 3]);
  });

  it('V12：早產 30 週、實足 20 個月 → 約 18 個月；足月、或滿 24 個月不矯正', () => {
    expect(correctedAgeMonth(20, 30)).toBe(18);
    expect(correctedAgeMonth(20, 38)).toBe(20);
    expect(correctedAgeMonth(20, null)).toBe(20);
    expect(correctedAgeMonth(24, 30)).toBe(24);
  });
});

describe('buildRecommendInput', () => {
  /** 某一維四題的作答（A 的方向：2 可以做到、1 有时、0 还不能）。 */
  const score = (site: string, items: number[]) => ({ tierId: 'T1', dimensionId: site, score: items.reduce((a, b) => a + b, 0), items });
  const all2 = Object.values(SITE_DIMENSION_ID).map(site => score(site, [2, 2, 2, 2]));

  it('客規案例 1 的作答（22 個月）→ 社交警訊、無口語、注意力紅旗 → M-CHAT 第一份', () => {
    const t1 = all2.map(s =>
      s.dimensionId === 'attention' ? score('attention', [0, 2, 0, 1]) :
      s.dimensionId === 'language' ? score('language', [1, 0, 2, 1]) :
      s.dimensionId === 'social_emotional' ? score('social_emotional', [2, 1, 1, 0]) : s,
    );
    const { input, itemsMissing } = buildRecommendInput({ ageM: 22, child: { inSchool: true }, t1Scores: t1 });
    expect(itemsMissing).toBe(false);
    // A 組語言第 2 題（除爸妈外还会说几个单词）在我們的 T1 是紅旗題，答「还不能」就是紅旗維度；
    // 客規案例 1 的輸入只寫了注意力 —— 照 T1 題庫自己的紅旗標記（待問表 R-14）
    expect([...input.rfdims].sort()).toEqual(['ATT', 'LANG']);
    expect(input.items).toMatchObject({ ATT_0: 2, ATT_2: 2, LANG_1: 2, LANG_3: 1, SOC_3: 2 });
    expect(input.levels.ATT).toBe(2); // 3 分本來就中度
    const r = recommend(input);
    expect(r.tools[0].code).toBe('M-CHAT-R/F');
    expect(r.tags).toEqual(expect.arrayContaining(['ASD_SIG', 'NONVERBAL']));
  });

  it('舊的 T1（沒有逐題）：沒有標籤、沒有紅旗維度，itemsMissing', () => {
    const t1 = Object.values(SITE_DIMENSION_ID).map(site => ({ tierId: 'T1', dimensionId: site, score: site === 'language' ? 4 : 8 }));
    const { input, itemsMissing } = buildRecommendInput({ ageM: 40, child: {}, t1Scores: t1 });
    expect(itemsMissing).toBe(true);
    expect(input.items).toEqual({});
    expect(input.rfdims).toEqual([]);
    expect(input.levels.LANG).toBe(2);
  });

  it('診斷只認六種、最多兩個；抽動 → TIC；上學、聽力照填；沒填的是預設', () => {
    const { input } = buildRecommendInput({
      ageM: 60,
      child: { diagnoses: ['ASD', 'NOPE' as never, 'LANG', 'GDD'], hasTics: true, inSchool: true, hearingChecked: true },
      t1Scores: all2,
    });
    expect(input.dx).toEqual(['ASD', 'LANG']);
    expect(input.extraTags).toEqual(['TIC']);
    expect(input.school).toBe(true);
    expect(input.hearingChecked).toBe(true);
    const bare = buildRecommendInput({ ageM: 60, child: {}, t1Scores: all2 }).input;
    expect([bare.dx, bare.school, bare.hearingChecked, bare.extraTags]).toEqual([[], false, null, []]);
  });

  it('早產矯正只動月齡，題目照當時出的那一段讀', () => {
    const { input } = buildRecommendInput({ ageM: 20, child: { gestationWeeks: 30 }, t1Scores: all2 });
    expect(input.ageM).toBe(18);
  });
});
