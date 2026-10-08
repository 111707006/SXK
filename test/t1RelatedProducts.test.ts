import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PRODUCTS_DATA } from '../src/data';
import { findBannedWords } from '../src/utils/parentWording';
import { RELATED_PRODUCTS_COPY, RELATED_PRODUCTS_MAX, pickRelatedProducts } from '../src/t1report/relatedProducts';
import { asModelOutput, t1ReportInputOf, templateT1Report } from '../src/t1report/report';
import { buildT1ReportPrompt } from '../src/t1report/prompt';
import { bandScores } from './helpers/t1Scores';

/**
 * 新版 T1 報告的「相关产品」（使用者 2026-10-08）：照被標記的方面挑、全綠不出現、只在 A 的新版、
 * 產品名不進提示也不進模板寫的字。
 */

const ROOT = path.resolve(__dirname, '..');
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const scoresWith = (m: Record<string, 0 | 1 | 2>, age = 42) => bandScores(age, (d, i) => (d in m ? (i === 0 ? m[d] : m[d] === 0 ? 0 : 2) : 2));

describe('挑法', () => {
  it('全綠：一個都不挑', () => {
    expect(pickRelatedProducts(bandScores(42, () => 2))).toEqual([]);
  });

  it('被標記的方面沒有產品對得上（只有語言）：一個都不挑', () => {
    expect(pickRelatedProducts(scoresWith({ language: 0 }))).toEqual([]);
  });

  it('跟著被標記的方面：只有動作 → 對得上動作的產品，商城順序', () => {
    const picks = pickRelatedProducts(scoresWith({ gross_motor: 1 }));
    expect(picks.map(p => p.product.id)).toEqual(['walking_assist', 'smart_lamp']);
    for (const p of picks) expect(p.product.dimensionsTargeted).toContain('gross_motor');
    expect(picks[0].matched).toEqual(['动作发展']);
  });

  it('紅燈的方面先：注意力紅、動作黃 → 對得上注意力的排前面；同位置對得上兩項的再往前', () => {
    const picks = pickRelatedProducts(scoresWith({ attention: 0, gross_motor: 1 }));
    expect(picks[0].product.id).toBe('smart_lamp');
    expect(picks[0].matched).toEqual(['注意力与执行', '动作发展']);
    expect(picks).toHaveLength(RELATED_PRODUCTS_MAX);
    for (const p of picks) expect(p.product.dimensionsTargeted.some(d => d === 'attention' || d === 'gross_motor')).toBe(true);
  });

  it('每一個挑出來的產品都對得上至少一個被標記的方面', () => {
    for (const dim of ['attention', 'emotion_behavior', 'cognitive', 'gross_motor', 'self_care', 'sensory_processing', 'social_emotional']) {
      for (const p of pickRelatedProducts(scoresWith({ [dim]: 0 }))) expect(p.product.dimensionsTargeted).toContain(dim);
    }
  });

  it('這一塊的字沒有禁字', () => {
    for (const t of [RELATED_PRODUCTS_COPY.title, RELATED_PRODUCTS_COPY.intro, RELATED_PRODUCTS_COPY.where, RELATED_PRODUCTS_COPY.matched(['认知'])]) {
      expect(findBannedWords(t), t).toEqual([]);
    }
  });
});

describe('產品不進評估內容', () => {
  const names = PRODUCTS_DATA.map(p => p.name);
  const inputs = [12, 42, 60, 100, 150].flatMap(age => [
    t1ReportInputOf({ name: '森森', ageMonth: age }, bandScores(age, () => 0)),
    t1ReportInputOf({ name: '森森', ageMonth: age }, bandScores(age, (d, i) => (d === 'attention' && i === 0 ? 1 : 2))),
  ]);

  it('提示裡沒有任何產品名', () => {
    for (const input of inputs) {
      const { system, user } = buildT1ReportPrompt(input);
      for (const n of names) expect(system + user, n).not.toContain(n);
      expect(system + user).not.toMatch(/商城|穿戴/);
    }
  });

  it('模板寫的字裡沒有任何產品名', () => {
    for (const input of inputs) {
      const text = JSON.stringify(asModelOutput(templateT1Report(input)));
      for (const n of names) expect(text, n).not.toContain(n);
    }
  });

  it('提示與模板的原始碼都沒有 import 產品清單', () => {
    for (const rel of ['src/t1report/prompt.ts', 'src/t1report/report.ts', 'src/t1report/rules.ts']) {
      expect(stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')), rel).not.toMatch(/PRODUCTS_DATA|relatedProducts/);
    }
  });
});

describe('畫面：只在 A 的新版、有商城時，放在最底下', () => {
  const body = stripComments(fs.readFileSync(path.join(ROOT, 'src/components/ReportBody.tsx'), 'utf8'));

  it('條件是新版＋商城', () => {
    expect(body).toMatch(/\{real && PRODUCT\.features\.mall && <RelatedProducts scores=\{scores\} \/>\}/);
    expect(body.match(/<RelatedProducts/g)).toHaveLength(1);
  });

  it('在預約插槽之後（報告最底下）', () => {
    expect(body.indexOf('<RelatedProducts')).toBeGreaterThan(body.indexOf('{bookingSlot}'));
  });

  it('專案 B 沒有商城、也不是新版', () => {
    const profile = fs.readFileSync(path.join(ROOT, 'src/productConfig.ts'), 'utf8');
    const t1only = profile.slice(profile.indexOf('t1only: {'));
    expect(t1only).toMatch(/mall:\s*false/);
    expect(t1only).toMatch(/tier2And3:\s*false/);
  });
});
