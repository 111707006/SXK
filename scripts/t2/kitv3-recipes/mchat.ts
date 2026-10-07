/**
 * M-CHAT-R/F（T2 v3 題庫規格 §4.2「M-CHAT-R/F」列、R-18）：只做第一階段 20 題。第二階段是訪問者照流程圖問的訪談
 *（5 個流程有「访问者判断」節點），家長自己做不了。
 *
 * 頁面的計分（探針確認）：每題是／否；第 2、5、12 題答「是」是風險，其餘答「否」是風險（`isRisk`）；
 * 總分＝風險答案的題數（`total`）；分段 `BANDS` 低风险 0–2／中等风险 3–7／高风险 8–20（`bandOf`）。
 *
 * 0–3（R-18 暫採）：0–2 → 0、3–7 → 2（中等風險、沒有做第二階段，等同「需要後續」）、8 以上 → 3。
 */

import { h1Title, need, probe, type V3Recipe, type V3Source } from '../kitv3';
import type { KitV3Bank } from '../../../src/t2/kitv3/types';
import type { MchatScoring } from '../../../src/t2/kitv3/score';

function build(src: V3Source): Omit<KitV3Bank<MchatScoring>, 'code' | 'source'> {
  probe(src, 'isRisk', /function isRisk\(q,v\)\{return v===undefined\?false:\(q\.risk==='yes'\?v==='yes':v==='no'\);\}/);
  probe(src, 'total＝風險題數', /function total\(\)\{return risky\(\)\.length;\}/);
  probe(src, 'bandOf', /function bandOf\(n\)\{return BANDS\.find\(b=>n>=b\.lo&&n<=b\.hi\)\|\|BANDS\[2\];\}/);
  const q = need<Array<{ id: number; risk: string; t: string }>>(src, 'Q');
  const bands = need<Array<{ k: string; lo: number; hi: number }>>(src, 'BANDS');
  if (q.length !== 20) throw new Error(`${src.file}：第一階段應有 20 題`);
  if (bands.length !== 3) throw new Error(`${src.file}：BANDS 應有 3 段`);
  return {
    title: h1Title(src),
    family: 'mchat',
    options: { yesno: [{ value: 1, label: '是' }, { value: 0, label: '否' }] },
    forms: [
      {
        key: 'main',
        name: '填表家长',
        sections: [{ key: 'S1', name: '第一阶段', options: 'yesno', items: q.map(x => ({ key: `q${x.id}`, text: x.t })) }],
      },
    ],
    scoring: {
      dim: 'SOC',
      riskIsYes: q.filter(x => x.risk === 'yes').map(x => `q${x.id}`),
      bands: bands.map(b => ({ min: b.lo, max: b.hi, name: b.k })),
      grade: [0, 2, 3],
    },
  };
}

export const MCHAT_RECIPES: V3Recipe[] = [{ code: 'M-CHAT-R/F', slug: 'mchat-rf', file: '森心康_M-CHAT-R-F_完整版.html', build }];
