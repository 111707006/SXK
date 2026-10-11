import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import T2PromoCard from '../src/components/T2PromoCard';
import { promoFromV2, promoFromV3, promoSentence, T2_GUIDE_PRICE_FEN } from '../src/t2/entrancePromo';
import { SITE_DIMENSION_NAME } from '../src/t2/dimensionMap';
import type { ParentPlanTool } from '../src/t2/recommend/parentPlan';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, PlanItem } from '../src/t2/types';

const inOrder = (...ds: DimensionCode[]) => DIMENSION_CODES.filter(d => ds.includes(d)).map(d => SITE_DIMENSION_NAME[d]);

/**
 * T1 報告上的 T2 短卡（使用者 2026-10-11）：幾項、哪幾個方面從 plan 數；價錢只在未解鎖時出；逐份清單不在卡上。
 */

const tool = (code: string, dimension: ParentPlanTool['dimension']): ParentPlanTool => ({
  code, name: code, dimension, reason: '', rater: '家长', minutes: 20, session: 1,
});
const item = (toolId: PlanItem['toolId'], forDimensions: PlanItem['forDimensions']): PlanItem => ({
  toolId, forDimensions, askedCount: 10, role: 'required',
});

describe('幾項、哪幾個方面', () => {
  it('完整版：每一份算一項；方面照九碼順序、不重複，綜合問卷（沒有單一維度）不點名', () => {
    const p = promoFromV3({ tools: [tool('SXK-EMO', 'EMO'), tool('SXK-ASQ3', null), tool('SXK-GM', 'MOT')] });
    expect(p.count).toBe(3);
    expect(p.dimensions).toEqual(inOrder('MOT', 'EMO'));
  });

  it('舊題庫：必做那幾份', () => {
    const p = promoFromV2({ required: [item('sxk-gm', ['MOT']), item('sxk-lang', ['LANG', 'SOC'])] });
    expect(p.count).toBe(2);
    expect(p.dimensions).toEqual(inOrder('LANG', 'SOC', 'MOT'));
  });

  it('沒有能點名的方面時，句子不點名', () => {
    expect(promoSentence([])).toEqual({ before: '目前孩子的筛查结果有需要进一步了解的地方，', highlight: null, after: expect.stringContaining('单项深度评估') });
    expect(promoSentence(['动作发展', '情绪行为']).highlight).toBe('“动作发展、情绪行为”');
  });
});

describe('卡', () => {
  const promo = { count: 2, dimensions: ['动作发展', '情绪行为'] };
  const render = (locked: boolean) =>
    renderToStaticMarkup(createElement(T2PromoCard, { promo, locked, priceFen: 1990, onUnlock: () => {}, onStart: () => {} }));

  it('未解鎖：幾項、特惠價（伺服器的 priceFen）、劃掉的指導價、解鎖鈕', () => {
    const html = render(true);
    expect(html).toContain('建议进入 ');
    expect(html).toContain('2 项深度评估');
    expect(html).toContain('19.9');
    expect(html).toMatch(/line-through[^>]*>指导价格 ¥400/);
    expect(T2_GUIDE_PRICE_FEN).toBe(40000);
    expect(html).toContain('t2-promo-unlock-btn');
    expect(html).toContain('“动作发展、情绪行为”');
  });

  it('已解鎖（含免費期間）：不出價錢，只有幾項與開始鈕', () => {
    const html = render(false);
    expect(html).toContain('2 项深度评估');
    expect(html).not.toContain('19.9');
    expect(html).not.toContain('指导价格');
    expect(html).toContain('t2-promo-start-btn');
  });

  it('卡上沒有逐份清單、題量、分鐘', () => {
    const html = render(true);
    expect(html).not.toMatch(/分钟|份问卷|第一次填写/);
  });
});
