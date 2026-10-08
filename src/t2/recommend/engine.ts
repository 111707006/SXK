/**
 * T2 量表推薦引擎（客戶《T2 量表推荐规则规格书 v1.0》§6–§10；T2 v3 推薦規格 §3）。純函式。
 *
 * 客規已經是寫給 IT 的規格（偽代碼在 §10），這裡照它的步驟一步一步寫，註解標客規的章節。設定（工具、組上限、
 * 診斷檔案、關鍵題）來自附錄 A（`config.ts`，腳本抽的）；附錄沒有、寫在本文裡的三張表（§6 同級排序、§9.1 首選
 * 順序、§9.2 第 13 步 T3 預告）在這一檔。驗收是客規 §11 的 30 格與 §12 的 10 個案例（`test/t2Recommend*.test.ts`）。
 *
 * 不做的：§13.3 治療師後台增刪（我們沒有治療師在場，`overrides` 不在輸出裡）；T3 照算但上層不用（使用者 2026-10-07）。
 */

import { RECOMMEND_CONFIG } from './config';
import type {
  Alert,
  DxCode,
  KeyTag,
  Level,
  Rater,
  RecommendConfig,
  RecommendInput,
  RecommendedTool,
  Recommendation,
  T1Band,
  ToolClass,
} from './types';
import type { DimensionCode } from '../types';

// ── §9.4 參數 ──
export const MIN_TOOLS = 3;
export const MAX_TOOLS = 5;
export const PARENT_MINUTES_CAP = 90;
export const GLOBAL_DELAY_DIMS = 5;
export const TEACHER_MIN_AGE = 36;
export const SELF_MIN_AGE = 132;

/** 客規的維度中文名（理由與缺口的句子用；家長端另走 `SITE_DIMENSION_NAME`）。 */
export const DIM_NAME: Readonly<Record<DimensionCode, string>> = {
  MOT: '动作发展',
  SEN: '感觉处理',
  COG: '认知',
  ATT: '注意力与执行',
  LEARN: '学习能力',
  LANG: '语言沟通',
  SOC: '社交互动',
  EMO: '情绪与行为',
  ADL: '生活自理与适应',
};

const LEVEL_NAME: Readonly<Record<Level, string>> = { 0: '未见明显', 1: '轻度', 2: '中度', 3: '明显' };

/** 客規 §1：A 12–23／B 24–47／C 48–71／D 72–119／E 120–191（未滿 12 個月沒有 T1，引擎照 A 算）。 */
export function bandOf(ageM: number): T1Band {
  if (ageM < 24) return 'A';
  if (ageM < 48) return 'B';
  if (ageM < 72) return 'C';
  if (ageM < 120) return 'D';
  return 'E';
}

/** 客規 §6「同一層級內的排序」：各年齡段的發展重點（左邊先）。 */
export const AGE_ORDER: Readonly<Record<T1Band, ReadonlyArray<DimensionCode>>> = {
  A: ['LANG', 'SOC', 'MOT', 'COG', 'ADL', 'SEN', 'EMO', 'ATT', 'LEARN'],
  B: ['LANG', 'SOC', 'MOT', 'ATT', 'EMO', 'COG', 'SEN', 'ADL', 'LEARN'],
  C: ['LANG', 'ATT', 'SOC', 'EMO', 'COG', 'SEN', 'MOT', 'ADL', 'LEARN'],
  D: ['LEARN', 'ATT', 'EMO', 'LANG', 'SOC', 'COG', 'SEN', 'MOT', 'ADL'],
  E: ['EMO', 'LEARN', 'ATT', 'SOC', 'LANG', 'COG', 'ADL', 'SEN', 'MOT'],
};

/** 客規 §9.1 每個維度的首選量表順序（有條件的照條件挑一列）。 */
export function preferenceOf(dim: DimensionCode, ageM: number, tags: ReadonlySet<KeyTag>, dx: ReadonlyArray<DxCode>): string[] {
  switch (dim) {
    case 'LANG':
      if (tags.has('NONVERBAL') && ageM <= 42) return ['SXK-PLC', 'SXK-VOC', 'SXK-LQ'];
      if (ageM <= 72) return ['SXK-LQ', 'SXK-LANG', 'SXK-VOC'];
      if (ageM <= 144) return ['SXK-LANG', 'SXK-ASR'];
      return ['SXK-ASR', 'SXK-LDS'];
    case 'SOC':
      return tags.has('ASD_SIG') || dx.includes('ASD')
        ? ['M-CHAT-R/F', 'SXK-ASB', 'SXK-SOC', 'SXK-ASR']
        : ['SXK-SOC', 'SXK-ASR', 'SXK-ASB'];
    case 'ATT':
      if (ageM < 48) return ['SXK-AB'];
      if (ageM < 72) return ['SXK-AB', 'CHEXI', 'SXK-ATT'];
      return ['SNAP-IV', 'SXK-ATT', 'CHEXI', 'SXK-AB'];
    case 'LEARN':
      if (ageM < 72) return ['SXK-ADP'];
      if (ageM < 144) return ['SXK-LDP'];
      return ['SXK-LDS', 'SXK-LDP'];
    case 'MOT':
      return ['SXK-GM', 'SXK-ASQ3', 'SXK-ADL'];
    case 'SEN':
      return ['SXK-SP', 'SXK-SPb', 'ITQ/TTS/BSQ'];
    case 'COG':
      return ['SXK-ADP', 'SXK-ASQ3', 'SXK-LDP', 'SXK-LDS'];
    case 'EMO':
      return ['SXK-EMO', 'ITQ/TTS/BSQ', 'SXK-AB', 'SXK-QOL'];
    case 'ADL':
      return ['SXK-ADL', 'SXK-ADP', 'SXK-ASQ3', 'SXK-QOL'];
  }
}

/** 分齡發育綜合評估涵蓋的四個維度（合併規則看這四個的 T1 顏色）。 */
export const ASQ3_MERGE_DIMS: ReadonlyArray<DimensionCode> = ['MOT', 'LANG', 'COG', 'SOC'];

/** 合併規則的條件：四個裡 3 個以上被標記（黃或紅），而且沒有紅。年齡窗口由 `usable` 再擋。 */
export function asq3Merge(colors: Partial<Record<DimensionCode, 0 | 1 | 2>> | undefined): boolean {
  if (!colors) return false;
  const flagged = ASQ3_MERGE_DIMS.filter(d => (colors[d] ?? 0) >= 1);
  return flagged.length >= 3 && flagged.every(d => colors[d] === 1);
}

/** 客規 §9.2 第 11 步的補足順序。 */
const FILL = ['SXK-QOL', 'SXK-ASQ3', 'SXK-ADP', 'SXK-ADL'];

/** 第 12 步：先移除的在前。規則、診斷必選、P1 不移除。 */
const DROP_ORDER: ReadonlyArray<ToolClass> = ['fill', 'base', 'P5', 'P4', 'depth', 'P3', 'P2'];
/** 第 14 步：輸出順序。 */
const OUTPUT_ORDER: ReadonlyArray<ToolClass> = ['rule', 'dx', 'P1', 'P2', 'P3', 'depth', 'P4', 'P5', 'base', 'fill'];

interface Chosen {
  code: string;
  cls: ToolClass;
  dim: DimensionCode | null;
  reason: string;
}

/** 客規 §8：掃逐題作答加標籤。`items` 鍵 `${維度}_${題序 0 起}`，值 0／1／2。 */
export function scanKeyItems(band: T1Band, items: Readonly<Record<string, 0 | 1 | 2>>, config: RecommendConfig = RECOMMEND_CONFIG): KeyTag[] {
  const out: KeyTag[] = [];
  for (const k of config.keyItems) {
    if (k.band !== band) continue;
    const v = items[`${k.dim}_${k.idx}`];
    if (v === undefined) continue;
    const hit = k.cond === '==2' ? v === 2 : v >= 1;
    if (hit && !out.includes(k.tag)) out.push(k.tag);
  }
  return out;
}

/**
 * 引擎的選項。`onePerDimension`（ADR-0011）：每個被標記的維度只出一份 —— 不加 R1／R3／R4 的問卷、不跑診斷必選、
 * 社交的首選順序不因警訊換成 M-CHAT、跳過步驟 9（深度）、10（生活質量基線）、11（補足）。預設關：客規逐格測試照舊。
 * 觸發了哪些規則仍看回傳的 `tags`（入口與報告改出提示）。
 */
export interface RecommendOptions {
  onePerDimension?: boolean;
}

/**
 * 每維一份時，家長在 T1 報告上看到的顏色是「這一維有沒有被標記」的準（使用者 2026-10-08）：黃燈至少「轻度」、紅燈至少「中度」。
 * 引擎等級與畫面顏色的切點不同（R-1：7 分畫面黃、引擎「未见明显」），不墊的話，首頁語言卡亮黃燈、寫「进入深测」，
 * 推薦卻沒有語言（展示站實測）。只往上墊、不往下拉：紅旗題讓引擎比畫面重的照舊。舊資料沒有顏色 → 不變。
 */
export function levelsWithScreenColors(
  levels: Readonly<Record<DimensionCode, Level>>,
  colors: RecommendInput['t1Colors'],
): Record<DimensionCode, Level> {
  const out = { ...levels };
  for (const [d, c] of Object.entries(colors ?? {}) as Array<[DimensionCode, 0 | 1 | 2]>) {
    if (c >= 1 && d in out) out[d] = Math.max(out[d], c) as Level;
  }
  return out;
}

export function recommend(input: RecommendInput, config: RecommendConfig = RECOMMEND_CONFIG, options: RecommendOptions = {}): Recommendation {
  const { ageM, school } = input;
  const one = options.onePerDimension === true;
  const levels = one ? levelsWithScreenColors(input.levels, input.t1Colors) : input.levels;
  const band = bandOf(ageM);

  // ── 第 1 步：可用填寫人 ──
  const raters = new Set<Rater>(['P']);
  if (school && ageM >= TEACHER_MIN_AGE) raters.add('T');
  if (ageM >= SELF_MIN_AGE) raters.add('S');

  // ── 第 2 步：標籤 ──
  const tags = new Set<KeyTag>([...scanKeyItems(band, input.items, config), ...input.extraTags]);
  const rfdims = new Set<DimensionCode>(input.rfdims);
  if (band === 'A' && rfdims.has('ATT')) rfdims.add('SOC'); // A 組「叫名字」紅旗同時視為社交紅旗
  if (rfdims.has('SOC')) tags.add('ASD_SIG');

  // ── 第 3 步：診斷過濾 ──
  const alerts: Alert[] = [];
  const declared = one ? [] : input.dx.filter(d => d !== 'NONE');
  const dx = declared.filter(d => ageM >= (config.dxMinAge[d] ?? 0));
  for (const d of declared) {
    if (!dx.includes(d)) {
      alerts.push({ type: 'DX_AGE', text: `${config.dx[d].name}档案适用于 ${config.dxMinAge[d]} 个月以上，此年龄改按 T1 结果推荐。` });
    }
  }
  const profiles = dx.map(d => config.dx[d]);

  // ── 第 4 步：P0 提示 ──
  if (tags.has('SAFETY')) {
    alerts.unshift({ type: 'SAFETY', text: '安全：持续低落／自我否定未通过——先转介心理或精神科，当天告知家长；情绪量表由专业人员陪同填写。' });
  }
  if (tags.has('MED_MOT')) {
    alerts.push({ type: 'MEDICAL', text: '医疗：动作红旗（未独走／步态异常）——同步建议儿童神经科或康复医学科就诊。' });
  }
  if ((tags.has('NONVERBAL') || levels.LANG >= 2) && input.hearingChecked !== true) {
    alerts.push({ type: 'PREREQ', text: '前置条件：语言落后须先确认听力检查结果。' });
  }

  // ── 第 5 步：維度排隊（§6）──
  const tierOf = (d: DimensionCode): number => {
    let t = 9;
    if (rfdims.has(d) || (d === 'SOC' && tags.has('ASD_SIG') && levels.SOC >= 1)) t = Math.min(t, 1);
    if (profiles.some(p => p.core.includes(d))) t = Math.min(t, 2);
    if (levels[d] >= 2) t = Math.min(t, 3);
    if (levels[d] === 1) t = Math.min(t, 4);
    if (levels[d] >= 1 && profiles.some(p => p.rel.includes(d) || p.diff.includes(d))) t = Math.min(t, 5);
    return t;
  };
  const order = AGE_ORDER[band];
  const dims = Object.keys(levels) as DimensionCode[];
  const need = dims
    .filter(d => tierOf(d) < 9)
    .sort((a, b) => tierOf(a) - tierOf(b) || levels[b] - levels[a] || order.indexOf(a) - order.indexOf(b));
  const dimQueue = need.map(d => ({ dim: d, tier: tierOf(d) }));

  const t3 = t3Preview(tags, levels, ageM, config);
  if (need.length === 0 && dx.length === 0) {
    return { status: 'NO_T2', band, alerts, dimQueue, tools: [], t3: [], gaps: [], gapDims: [], removed: [], parentMinutes: 0, tags: [...tags] };
  }

  // ── 第 6 步：全面落後 ──
  const glob = dims.filter(d => levels[d] >= 2).length >= GLOBAL_DELAY_DIMS;
  const groupMax = (g: string) => {
    if (g === 'BROAD' && glob) return 2;
    if (g === 'SOCG' && dx.includes('ASD')) return 3;
    return config.groupMax[g] ?? 1;
  };

  const chosen: Chosen[] = [];
  // 每維一份不套份數上限（同時間上限，暫採 R-35）
  const maxTools = one ? Number.POSITIVE_INFINITY : MAX_TOOLS;
  const done = new Set(input.done);
  const usable = (code: string): boolean => {
    const t = config.tools[code];
    if (!t || t.layer !== 'T2') return false;
    if (chosen.some(c => c.code === code) || done.has(code)) return false;
    if (ageM < t.minM || ageM > t.maxM) return false;
    if (!t.rater.some(r => r !== 'C' && raters.has(r))) return false;
    if (t.group && chosen.filter(c => config.tools[c.code].group === t.group).length >= groupMax(t.group)) return false;
    // 每維一份：會讓某個維度變成兩份主測的，不選（ADR-0011）
    if (one && t.primary.some(d => chosen.some(c => config.tools[c.code].primary.includes(d)))) return false;
    return true;
  };
  const add = (code: string, cls: ToolClass, dim: DimensionCode | null, reason: string): boolean => {
    if (chosen.length >= maxTools || !usable(code)) return false;
    chosen.push({ code, cls, dim, reason });
    return true;
  };
  const firstUsable = (list: ReadonlyArray<string>) => list.find(usable) ?? null;

  // 每維一份時，社交的首選順序不因警訊換成 M-CHAT（ADR-0011）；警訊仍留在 `tags` 給提示用
  const prefTags: ReadonlySet<KeyTag> = one ? new Set([...tags].filter(t => t !== 'ASD_SIG')) : tags;

  // ── 第 7 步：規則必選 ──
  if (!one && tags.has('ASD_SIG')) add('M-CHAT-R/F', 'rule', 'SOC', '规则 R1：16–30 个月出现社交沟通警讯题');
  if (!one && tags.has('SAFETY')) add('SXK-EMO', 'rule', 'EMO', '规则 R3：安全题未通过，由专业人员陪同填写');
  if (!one && tags.has('TIC')) add('SXK-TIC', 'rule', 'EMO', '规则 R4：家长勾选有抽动');
  if (glob) {
    const c = firstUsable(['SXK-ASQ3', 'SXK-ADP']);
    if (c) add(c, 'rule', null, '规则 R5：五项以上中度落后（全面落后模式），先用跨领域量表');
  }
  for (const p of profiles) for (const c of p.must) add(c, 'dx', null, `诊断必选：${p.name}`);

  // 每維一份的合併規則（使用者 2026-10-08，ADR-0011 補充）：66 個月以下，動作／語言／認知／社交有 3 個以上被標記、
  // 而且全是黃燈（家長在 T1 報告上看到的顏色）→ 用一份分齡發育綜合評估涵蓋；有紅燈就不合併、照每維一份。
  if (one && asq3Merge(input.t1Colors)) add('SXK-ASQ3', 'rule', null, '合并：动作／语言／认知／社交多项黄灯，用一份分龄发育综合评估涵盖');

  // ── 第 8 步：覆蓋 ──
  const gaps: string[] = [];
  const gapDims: Recommendation['gapDims'] = [];
  const primaryCount = (d: DimensionCode) => chosen.filter(c => config.tools[c.code].primary.includes(d)).length;
  const tierWhy = (d: DimensionCode, tier: number): string => {
    if (tier === 1) return rfdims.has(d) ? '红旗' : '社交沟通警讯';
    if (tier === 2) return '诊断核心';
    if (tier === 5) return profiles.some(p => p.rel.includes(d)) ? '诊断相关' : '诊断鉴别';
    return `T1 ${LEVEL_NAME[levels[d]]}`;
  };
  for (const d of need) {
    if (chosen.length >= maxTools) break;
    if (primaryCount(d) > 0) continue;
    const tier = tierOf(d);
    const c = firstUsable(preferenceOf(d, ageM, prefTags, dx));
    if (!c) {
      gaps.push(`缺口：${DIM_NAME[d]} 在 ${ageM} 个月没有可用的家长／教师问卷——改为治疗师当面评估。`);
      gapDims.push({ dim: d, kind: 'none' });
      continue;
    }
    add(c, `P${tier}` as ToolClass, d, `P${tier} ${DIM_NAME[d]}（${tierWhy(d, tier)}）`);
    if (!config.tools[c].primary.includes(d)) {
      gaps.push(`缺口：${DIM_NAME[d]} 在 ${ageM} 个月没有主测该维度的问卷，暂以 ${c}（次要涵盖）替代，并建议当面评估。`);
      gapDims.push({ dim: d, kind: 'secondary' });
    }
  }

  // ── 第 9 步：深度 ──
  const deep = (d: DimensionCode) => tierOf(d) <= 2 || levels[d] === 3;
  const target = Math.min(MAX_TOOLS, Math.max(MIN_TOOLS, need.filter(d => tierOf(d) <= 4).length + need.filter(deep).length));
  for (const d of one ? [] : need) {
    if (!deep(d) || chosen.length >= target) continue;
    if (primaryCount(d) >= 2) continue;
    const c = firstUsable(preferenceOf(d, ageM, prefTags, dx));
    if (!c) continue;
    const tier = tierOf(d);
    const why = tier === 1 ? (rfdims.has(d) ? '红旗' : '社交沟通警讯') : tier === 2 ? '诊断核心' : '明显落后';
    add(c, 'depth', d, `深度：${DIM_NAME[d]} 第二份（${why}）`);
  }

  // ── 第 10 步：生活質量基線 ──
  if (!one && (dims.some(d => levels[d] >= 2) || dx.length > 0) && chosen.length < MAX_TOOLS) {
    add('SXK-QOL', 'base', null, '功能基线：疗前疗后对照');
  }

  // ── 第 11 步：補足 ──
  const floor = Math.max(MIN_TOOLS, Math.min(target, 4));
  for (const c of one ? [] : FILL) {
    if (chosen.length >= floor) break;
    add(c, 'fill', null, '补足：保底份数');
  }

  // ── 第 12 步：時間上限 ──
  const minutes = () => chosen.reduce((n, c) => n + config.tools[c.code].minutes, 0);
  const removed: Array<{ code: string; reason: string }> = [];
  // 每維一份不套時間上限：被標記的維度一定有它那一份（ADR-0011，暫採 R-35）
  while (!one && minutes() > PARENT_MINUTES_CAP && chosen.length > MIN_TOOLS) {
    let drop = -1;
    for (const cls of DROP_ORDER) {
      const candidates = chosen.map((c, i) => ({ c, i })).filter(x => x.c.cls === cls);
      if (candidates.length === 0) continue;
      // 同級先移除時間較長的；再同就移除先加入的（客規 §11 ASD 96 個月那一格：P4 的 SPb 與 ADL 都 20 分鐘，移除的是先加入的 SPb）
      candidates.sort((a, b) => config.tools[b.c.code].minutes - config.tools[a.c.code].minutes || a.i - b.i);
      drop = candidates[0].i;
      break;
    }
    if (drop < 0) break;
    const [gone] = chosen.splice(drop, 1);
    removed.push({ code: gone.code, reason: gone.reason });
  }

  // ── 第 14 步：輸出排序 ──
  const sorted = chosen
    .map((c, i) => ({ c, i }))
    .sort((a, b) => OUTPUT_ORDER.indexOf(a.c.cls) - OUTPUT_ORDER.indexOf(b.c.cls) || a.i - b.i)
    .map(x => x.c);
  const tools: RecommendedTool[] = sorted.map((c, i) => {
    const t = config.tools[c.code];
    return {
      order: i + 1,
      code: c.code,
      name: t.name,
      rater: t.rater.filter(r => r !== 'C' && raters.has(r)),
      minutes: t.minutes,
      cls: c.cls,
      dim: c.dim,
      reason: c.reason,
      session: i < 2 ? 1 : 2,
      mandatory: c.cls === 'rule' || c.cls === 'dx' || c.cls === 'P1',
    };
  });

  return { status: 'RECOMMEND', band, alerts, dimQueue, tools, t3, gaps, gapDims, removed, parentMinutes: minutes(), tags: [...tags] };
}

/** 客規 §9.2 第 13 步：T3 預告（年齡合適才出）。 */
export function t3Preview(tags: ReadonlySet<KeyTag>, levels: Readonly<Record<DimensionCode, Level>>, ageM: number, config: RecommendConfig = RECOMMEND_CONFIG) {
  const out: Array<{ code: string; reason: string }> = [];
  const fit = (code: string) => {
    const t = config.tools[code];
    return t !== undefined && ageM >= t.minM && ageM <= t.maxM;
  };
  const push = (code: string, reason: string) => {
    if (fit(code) && !out.some(x => x.code === code)) out.push({ code, reason });
  };
  if (tags.has('ARTIC')) push('SXK-ART', '发音清晰度题未通过');
  if (levels.LANG >= 2 && ageM >= 36 && ageM <= 84) push('SXK-PLE', '语言中度以上，当面确认');
  if ((levels.LANG >= 2 && ageM >= 85 && ageM <= 155) || tags.has('NARR')) push('SXK-NAR', '叙事／说一件事的题未通过');
  if (levels.MOT >= 2 || tags.has('WRITE')) push('SXK-SMA', '动作或书写题未通过');
  const glob = (Object.keys(levels) as DimensionCode[]).filter(d => levels[d] >= 2).length >= GLOBAL_DELAY_DIMS;
  if (tags.has('LD_SIG') || (ageM >= 72 && levels.LEARN >= 2) || glob) push('SXK-WISC', '学习／认知落后，需确认整体能力');
  if (ageM >= 72 && levels.COG >= 2) push('SXK-ROCF', '认知中度以上，当面确认');
  return out;
}
