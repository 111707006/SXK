/**
 * 新版 T1 報告最底下的「相关产品」（使用者 2026-10-08；只在專案 A 的新版、而且有商城時）。
 *
 * 【和評估內容分開】產品**不進提示、不進模型寫的字、不進模板**（`prompt.ts`、`report.ts` 一個產品名都沒有，
 * `test/t1RelatedProducts.test.ts` 盯著）。這一塊是畫面在報告最後另外接上的，標題、底色都與評估分開，
 * 並且明說上面的練習不需要買任何東西。
 *
 * 【怎麼挑】從商城的產品清單（`PRODUCTS_DATA`，商城頁同一份）挑 `dimensionsTargeted` 對得上**被標記方面**的：
 * 1. 被標記的順序照 `flaggedDimensions`（需要较多支持在前）；產品排在它對得上的最前面那一個方面；
 * 2. 同一個位置，對得上的方面多的在前；再同就照商城的順序；
 * 3. 最多 `RELATED_PRODUCTS_MAX` 個。
 * **沒有被標記的方面（全綠）就整塊不出現** —— 不給一般推薦：報告剛說各方面發展穩定，接著推銷產品不對（暫採）。
 * 被標記的方面沒有任何產品對得上（例如只有語言）也不出現。
 */

import { PRODUCTS_DATA } from '../data';
import type { DimensionScore, Product } from '../types';
import { flaggedDimensions, t1AnswersOf } from './answers';

export const RELATED_PRODUCTS_MAX = 2;

export interface RelatedProduct {
  product: Product;
  /** 對得上的被標記方面（名字，照被標記的順序）。 */
  matched: string[];
}

export function pickRelatedProducts(
  scores: ReadonlyArray<DimensionScore> | unknown,
  products: ReadonlyArray<Product> = PRODUCTS_DATA,
  max = RELATED_PRODUCTS_MAX,
): RelatedProduct[] {
  const flagged = flaggedDimensions(t1AnswersOf(scores));
  if (flagged.length === 0) return [];
  const ranked = products
    .map((product, order) => {
      const hits = flagged
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => product.dimensionsTargeted.includes(d.dimensionId));
      return { product, order, hits };
    })
    .filter(r => r.hits.length > 0)
    .sort((x, y) => x.hits[0].i - y.hits[0].i || y.hits.length - x.hits.length || x.order - y.order);
  return ranked.slice(0, max).map(r => ({ product: r.product, matched: r.hits.map(h => h.d.dimensionName) }));
}

/** 這一塊的字（進用字掃描）。 */
export const RELATED_PRODUCTS_COPY = {
  title: '相关产品',
  intro: '以下是商城里和这次需要支持的方面相关的产品，与上面的评估内容分开列出，仅供参考。上面的练习都不需要购买任何东西。',
  matched: (names: string[]) => `相关方面：${names.join('、')}`,
  where: '可在页面上方的「商城」查看详情。',
} as const;
