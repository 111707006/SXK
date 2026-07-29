import { describe, it, expect } from 'vitest';
import { DIMENSIONS_DATA, PRODUCTS_DATA } from '../src/data';
import { T1_AGE_BANDS } from '../src/t1Data';
import { SPECIALIZED_TEMPLATES } from '../src/utils/reportUtils';
import {
  DIMENSION_DETAILS,
  BRAIN_NODES,
  BRAIN_NODE_UNCOVERED_DIMS,
  REHAB_SUGGESTIONS,
} from '../src/dimensionContent';

/**
 * 九大維度的 ID 散落在六張以字串為 key 的表裡，TypeScript 擋不住任何一張漏改
 * （全是 Record<string, …>）。2026-07 的維度正名就是這樣讓 emotion_behavior
 * 從腦區拓樸圖裡消失而 29 個測試全過。這組測試把「六張表一致」變成 CI 擋得住的事。
 *
 * 階段 3 之後 dimension_id 會成為 unlocks 表的主鍵之一 —— 屆時漏一個維度
 * 等於收了錢開不了權益，所以這個保護要在收費前就位。
 */

const DIMENSION_IDS = DIMENSIONS_DATA.map(d => d.id);
const ID_SET = new Set(DIMENSION_IDS);

describe('維度 ID 的唯一來源', () => {
  it('DIMENSIONS_DATA 剛好九個維度且 ID 不重複', () => {
    expect(DIMENSION_IDS).toHaveLength(9);
    expect(ID_SET.size).toBe(9);
  });
});

describe('依 dimensionId 索引的表必須與 DIMENSIONS_DATA 一致', () => {
  it.each([
    ['DIMENSION_DETAILS（報告的標記領域說明）', DIMENSION_DETAILS],
    ['SPECIALIZED_TEMPLATES（深度評估報告模板）', SPECIALIZED_TEMPLATES],
    ['REHAB_SUGGESTIONS（備援報告的康復建議）', REHAB_SUGGESTIONS],
  ])('%s 的 key 集合不多不少', (_label, table) => {
    expect(Object.keys(table as Record<string, unknown>).sort()).toEqual([...DIMENSION_IDS].sort());
  });
});

describe('篩查題庫', () => {
  it('每一題的 dimensionId 都是已知維度', () => {
    const unknown = T1_AGE_BANDS.flatMap(band =>
      band.questions
        .filter(q => !ID_SET.has(q.dimensionId))
        .map(q => `${q.id}: ${q.dimensionId}`)
    );
    expect(unknown).toEqual([]);
  });

  it('每一題的 dimensionName 與 DIMENSIONS_DATA 的正式名稱相符', () => {
    const nameById = new Map(DIMENSIONS_DATA.map(d => [d.id, d.name]));
    const mismatched = T1_AGE_BANDS.flatMap(band =>
      band.questions
        .filter(q => nameById.get(q.dimensionId) !== q.dimensionName)
        .map(q => `${q.id}: ${q.dimensionName} ≠ ${nameById.get(q.dimensionId)}`)
    );
    expect(mismatched).toEqual([]);
  });

  it('每個年齡段都涵蓋全部九個維度', () => {
    for (const band of T1_AGE_BANDS) {
      const covered = new Set(band.questions.map(q => q.dimensionId));
      expect([...covered].sort(), `年齡段 ${band.id}`).toEqual([...DIMENSION_IDS].sort());
    }
  });
});

describe('腦區拓樸圖', () => {
  it('節點的 relatedDims 只引用已知維度', () => {
    const unknown = BRAIN_NODES.flatMap(n =>
      n.relatedDims.filter(d => !ID_SET.has(d)).map(d => `${n.id}: ${d}`)
    );
    expect(unknown).toEqual([]);
  });

  // 這條就是會擋下 emotion_behavior 從圖上消失的那條。
  it('每個維度不是被某個節點涵蓋，就是列在刻意排除清單裡', () => {
    const covered = new Set(BRAIN_NODES.flatMap(n => n.relatedDims));
    const orphaned = DIMENSION_IDS.filter(
      id => !covered.has(id) && !BRAIN_NODE_UNCOVERED_DIMS.includes(id)
    );
    expect(orphaned).toEqual([]);
  });

  it('刻意排除清單本身有效：只列已知維度，且沒有列了又被涵蓋的', () => {
    const covered = new Set(BRAIN_NODES.flatMap(n => n.relatedDims));
    expect(BRAIN_NODE_UNCOVERED_DIMS.filter(d => !ID_SET.has(d))).toEqual([]);
    expect(BRAIN_NODE_UNCOVERED_DIMS.filter(d => covered.has(d))).toEqual([]);
  });
});

describe('商城商品', () => {
  // 只擋得住「維度不存在」，擋不住「維度存在但標錯」—— 後者只能靠人看。
  it('dimensionsTargeted 只引用已知維度', () => {
    const unknown = PRODUCTS_DATA.flatMap(p =>
      p.dimensionsTargeted.filter(d => !ID_SET.has(d)).map(d => `${p.id}: ${d}`)
    );
    expect(unknown).toEqual([]);
  });
});
