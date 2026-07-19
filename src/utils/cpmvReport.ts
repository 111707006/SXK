// Pure CPMV-20 report computation, extracted from MotionVideoAssessment so it
// can be unit-tested and reused. Depends only on item scores/flags + the scale data.
import { CPMV_ITEMS, CPMV_FLAGS, CPMV_DOMAINS, cpmvGrade } from '../cpmvData';

export type CpmvItemScore = 0 | 1 | 2 | 'nt' | null;

export interface CpmvItemStateLite {
  score: CpmvItemScore;
  flags: Record<string, boolean>;
}

export type CpmvItemStates = Record<number, CpmvItemStateLite>;

export interface CpmvDomainResult {
  key: string;
  name: string;
  items: number[];
  sum: number;
  max: number;
  pct: number | null;
  testedN: number;
}

export interface CpmvCollectResult {
  testedIds: number[];
  ntIds: number[];
  lowItemIds: number[];
  sum: number;
  max: number;
  pct: number;
  domains: CpmvDomainResult[];
  flagStats: Record<string, { n: number; items: number[] }>;
}

const isScored = (s: CpmvItemScore): s is 0 | 1 | 2 => s === 0 || s === 1 || s === 2;

export function collectCpmv(itemStates: CpmvItemStates): CpmvCollectResult {
  const tested = CPMV_ITEMS.filter(it => isScored(itemStates[it.id]?.score));
  const ntList = CPMV_ITEMS.filter(it => itemStates[it.id]?.score === 'nt');
  const lowItems = CPMV_ITEMS.filter(it => {
    const s = itemStates[it.id]?.score;
    return s === 0 || s === 1;
  });
  const sum = tested.reduce((a, it) => a + (itemStates[it.id].score as number), 0);
  const max = tested.length * 2;
  const pct = max ? Math.round((sum / max) * 100) : 0;

  const domains: CpmvDomainResult[] = CPMV_DOMAINS.map(d => {
    const t = d.items.filter(id => isScored(itemStates[id]?.score));
    const s = t.reduce((a, id) => a + (itemStates[id].score as number), 0);
    const m = t.length * 2;
    return { key: d.key, name: d.name, items: d.items, sum: s, max: m, pct: m ? Math.round((s / m) * 100) : null, testedN: t.length };
  });

  const flagStats: Record<string, { n: number; items: number[] }> = {};
  CPMV_FLAGS.forEach(f => { flagStats[f.k] = { n: 0, items: [] }; });
  CPMV_ITEMS.forEach(it => {
    const fl = itemStates[it.id]?.flags || {};
    CPMV_FLAGS.forEach(f => { if (fl[f.k]) { flagStats[f.k].n++; flagStats[f.k].items.push(it.id); } });
  });

  return {
    testedIds: tested.map(it => it.id),
    ntIds: ntList.map(it => it.id),
    lowItemIds: lowItems.map(it => it.id),
    sum, max, pct, domains, flagStats
  };
}

export function buildCpmvSummary(r: CpmvCollectResult): string[] {
  const S: string[] = [];
  const g = cpmvGrade(r.pct);
  S.push(`患儿共完成 ${r.testedIds.length}/20 项（未测 ${r.ntIds.length} 项），实测总分 ${r.sum}/${r.max}，得分率 ${r.pct}%，动作影像评估等级：${g.t}。`);
  const weak = r.domains.filter(d => d.pct !== null && d.pct < 50).map(d => d.name);
  const midw = r.domains.filter(d => d.pct !== null && d.pct >= 50 && d.pct < 75).map(d => d.name);
  if (weak.length) S.push(`「${weak.join('、')}」维度得分率低于 50%，为当前主要受限领域，应作为康复训练与 AI 影像重点采集方向。`);
  if (midw.length) S.push(`「${midw.join('、')}」维度处于 50%–75%，存在中等程度受限。`);
  const fs = r.flagStats;
  if (fs.tremor.n) {
    const hasCoord = fs.tremor.items.some(i => [11, 12].includes(i));
    S.push(`第 ${fs.tremor.items.join('、')} 项观察到震颤 / 抖动${hasCoord ? '，其中出现在指鼻或轮替任务中、接近目标时的抖动提示意向性震颤（共济失调成分）' : ''}，建议结合不随意运动型 / 共济失调型特征进一步鉴别。`);
  }
  if (fs.assoc.n) S.push(`第 ${fs.assoc.items.join('、')} 项出现联合动作（镜像动作），提示运动分离度不足，单侧任务时对侧抑制能力弱。`);
  if (fs.comp.n) S.push(`第 ${fs.comp.items.join('、')} 项存在代偿动作，提示目标肌群力量或关节活动度不足，训练中应先控制代偿再提要求。`);
  const L = fs.worseL.n, R = fs.worseR.n;
  if (L + R > 0) {
    if (L >= 2 && L > R) S.push(`左侧表现较差共 ${L} 项（右侧 ${R} 项），提示左侧偏侧性受累可能，建议对左侧肢体多角度补充拍摄。`);
    else if (R >= 2 && R > L) S.push(`右侧表现较差共 ${R} 项（左侧 ${L} 项），提示右侧偏侧性受累可能，建议对右侧肢体多角度补充拍摄。`);
    else S.push(`左右侧各有较差表现（左 ${L} 项 / 右 ${R} 项），偏侧性不显著，更符合双侧受累模式。`);
  }
  if (r.ntIds.length) S.push(`未测项目：第 ${r.ntIds.join('、')} 项，建议条件允许时补测补拍。`);
  return S;
}

export function buildCpmvSuggest(r: CpmvCollectResult): string[] {
  const S: string[] = [];
  S.push('后续评估：本工具为影像评估参考，建议进入森心康 T3 专业评估——GMFM-88/66（粗大运动）、MACS 手功能分级、改良 Ashworth 肌张力评定、被动关节活动度（ROM）测量。');
  const d = Object.fromEntries(r.domains.map(x => [x.key, x.pct]));
  const dir: string[] = [];
  if (d.hand !== null && (d.hand as number) < 60) dir.push('作业治疗(OT)手功能专项');
  if (d.balance !== null && (d.balance as number) < 60) dir.push('物理治疗(PT)平衡与步态专项');
  if (d.static !== null && (d.static as number) < 60) dir.push('核心稳定与姿势控制训练');
  if (d.trans !== null && (d.trans as number) < 60) dir.push('体位转换与功能性移动训练');
  if (dir.length) S.push(`训练方向：${dir.join('；')}。`);
  if (r.lowItemIds.length) S.push(`AI 数据采集：对得分 0–1 分的项目（第 ${r.lowItemIds.join('、')} 项）按正面+侧面双机位补拍，震颤 / 轮替相关片段使用 60fps。`);
  S.push('复评节奏：建议每 8–12 周以相同机位、相同项目复拍一次，形成纵向对比影像序列。');
  return S;
}
