/**
 * 工具登錄表：22 支（規格 §3 ＋ 附錄 F）。
 *
 * 【這是什麼】
 * 每一支工具「是什麼」的單一事實來源：適用月齡、屬哪個計分族、餵哪個維度、
 * 出不出判定、進不進路由、前置題、固定 caveat。
 *
 * 【哪些欄位不在這裡抄第二次】
 * `tiers`、`preQuestions` 直接取題庫（`src/t2/toolkit/`，#41 從工具包 zip 抽的）。
 * 分段抄第二次的風險是真的 —— 同一支 HTML 裡有三套分級（附錄 D），照著文件手抄
 * 很容易抄到 `postMessage` 那一套 80／60／40。題庫那一份有「從 zip 重跑逐位元一致」
 * 的測試護著，這裡只轉出。
 *
 * 【比中控台窄】
 * `feeds` 照附錄 F，比客戶中控台的 `TOOL2DIM` 少好幾格。中控台把 SXK-ADP 對到
 * 感覺處理、SXK-SOC 對到日常生活、SXK-AB 對到學習 —— 那些格子裡工具**沒有對應
 * 的面向**，照做會讓一個概念理解偏弱的孩子被判「感覺處理需關注」然後拿到感覺
 * 活動。被拿掉的對應與理由列在規格附錄 C。
 */

import { TOOLKIT } from './toolkit';
import type { ToolId } from './toolkit';
import type { Caveat } from './caveats';
import type { DimensionCode, ScoringFamily, ToolFeed, ToolSpec } from './types';

/**
 * 附錄 F：工具 → 維度 ← 面向。`sections` 是題庫的面向 key，`'overall'` 用總分。
 *
 * 例外只有 `sxk-warn`：它的 `i1`–`i4` 是**每個時點內的第幾條**，不是面向 key
 * （warn 的面向是 `m3`、`m6`…… 十一個時點，每個時點四條的欄位相同）。
 * 逐條的位置對應寫在 `itemTags.ts` 的 `WARN_POSITION_FEEDS`。
 */
export const TOOL_FEEDS: Readonly<Record<ToolId, ReadonlyArray<ToolFeed>>> = {
  'sxk-dev': [
    { dimension: 'MOT', sections: ['MOT'] }, { dimension: 'LANG', sections: ['LANG'] },
    { dimension: 'SOC', sections: ['SOC'] }, { dimension: 'ADL', sections: ['ADL'] },
    { dimension: 'COG', sections: ['COG'] },
  ],
  'sxk-warn': [
    { dimension: 'LANG', sections: ['i1'] }, { dimension: 'SOC', sections: ['i2'] },
    { dimension: 'MOT', sections: ['i3', 'i4'] },
  ],
  'mchat-rf': [{ dimension: 'SOC', sections: 'overall' }],
  'sxk-gm': [{ dimension: 'MOT', sections: 'overall' }],
  'sxk-soc': [{ dimension: 'SOC', sections: 'overall' }],
  'sxk-lang': [{ dimension: 'LANG', sections: 'overall' }],
  'sxk-adp': [{ dimension: 'COG', sections: 'overall' }],
  'sxk-voc': [{ dimension: 'LANG', sections: 'overall' }],
  'sxk-asq': [
    { dimension: 'LANG', sections: ['CO'] }, { dimension: 'MOT', sections: ['GM'] },
    { dimension: 'COG', sections: ['PS'] }, { dimension: 'SOC', sections: ['PE'] },
  ],
  'sxk-asb': [{ dimension: 'SOC', sections: 'overall' }],
  'sxk-asr': [{ dimension: 'SOC', sections: 'overall' }],
  'sxk-ab': [{ dimension: 'ATT', sections: 'overall' }],
  'sxk-att': [{ dimension: 'ATT', sections: 'overall' }],
  'snap-iv': [{ dimension: 'ATT', sections: ['IA', 'HI'] }, { dimension: 'EMO', sections: ['OD'] }],
  'chexi': [{ dimension: 'ATT', sections: 'overall' }],            // producesBand=false
  'sxk-spa': [{ dimension: 'SEN', sections: 'overall' }],
  'sxk-spb': [{ dimension: 'SEN', sections: 'overall' }],
  'sxk-adl': [{ dimension: 'ADL', sections: 'overall' }],
  'sxk-ldp': [{ dimension: 'LEARN', sections: 'overall' }],
  'sxk-lds': [{ dimension: 'LEARN', sections: 'overall' }],
  'sxk-tempa': [{ dimension: 'EMO', sections: 'overall' }],        // producesBand=false
  'sxk-tempb': [{ dimension: 'EMO', sections: 'overall' }],        // producesBand=false
};

/** §5.2 的十族。每支屬於且只屬於一族。 */
const FAMILY: Record<ToolId, ScoringFamily> = {
  'sxk-dev': 'pass',
  'sxk-warn': 'positive',
  'mchat-rf': 'risk',
  'sxk-gm': 'achievement',
  'sxk-soc': 'achievement',
  'sxk-lang': 'achievement',
  'sxk-adp': 'achievement',
  'sxk-voc': 'achievement',
  'sxk-asq': 'achievement',
  'sxk-asb': 'concern',
  'sxk-asr': 'concern',
  'sxk-ab': 'concern',
  'sxk-att': 'concern',
  'snap-iv': 'mean-snap',
  'chexi': 'mean-chexi',
  'sxk-spa': 'concern',
  'sxk-spb': 'concern',
  'sxk-adl': 'independence',
  'sxk-ldp': 'total',
  'sxk-lds': 'total',
  'sxk-tempa': 'profile',
  'sxk-tempb': 'profile',
};

/** §3 的月齡窗口，閉區間，單位是實足月齡（整數月，不進位）。 */
const WINDOW: Record<ToolId, [number, number]> = {
  'sxk-dev': [0, 72],
  'sxk-warn': [3, 84],
  'mchat-rf': [16, 30],
  'sxk-gm': [6, 72],
  'sxk-soc': [12, 72],
  'sxk-lang': [12, 72],
  'sxk-adp': [18, 72],
  'sxk-voc': [12, 42],
  'sxk-asq': [36, 42],
  'sxk-asb': [18, 180],
  'sxk-asr': [24, 180],
  'sxk-ab': [36, 192],
  'sxk-att': [60, 180],
  'snap-iv': [72, 216],
  'chexi': [48, 155],
  'sxk-spa': [24, 71],
  'sxk-spb': [60, 180],
  'sxk-adl': [30, 180],
  'sxk-ldp': [72, 144],
  'sxk-lds': [144, 216],
  'sxk-tempa': [12, 36],
  'sxk-tempb': [36, 84],
};

/**
 * §5.9 右欄裡**無條件**成立的那些。跟著分數或前置題才出現的不在這裡：
 * mchat 的 `follow_up_not_done`（3–7 分）、asb／asr 的 `regression_reported`、
 * asb 的 `safety_concern`、att 的 `recent_onset`、ab 的 `single_setting`、
 * spa／spb 的 `no_functional_impact`、lang／voc 的 `hearing_check_first`、
 * adl 括約肌領域的 `few_items` —— 那些是 #47 規則函式的事。
 *
 * `parent_report` 不在這裡：22 支全部都帶，寫在 `caveats.ts` 的 `UNIVERSAL_CAVEATS`。
 *
 * `few_items` 在 dev 與 asq 是無條件的：dev 每個領域只有 5 題、asq 每個領域 6 題，
 * 永遠 ≤ 6（§5.4「一律標」）。
 *
 * ⚠️ tempa／tempb 帶 `unsourced_threshold` 是照 §5.6 的「18 支自建工具一律帶」——
 * 那個 18 只有把氣質算進去才對得上（22 支扣掉 mchat、snap 這兩支外部工具，
 * 再扣掉非自建的 chexi 與衛健委的 warn，剩下的 18 支就是氣質也在內的那一組）。
 * §5.9 的氣質那一列寫「無」，與 §5.6 矛盾；此處取 §5.6，因為 0.42／1.0 這兩個
 * 切點同樣是客戶自承的參考值，而 §5.9 的「無」比較像是「不出 band 就沒有 caveat」
 * 的順手推論。待客戶覆核。
 */
const FIXED_CAVEATS: Record<ToolId, Caveat[]> = {
  'sxk-dev': ['unsourced_threshold', 'parent_administered_task', 'few_items'],
  'sxk-warn': [],
  'mchat-rf': [],
  'sxk-gm': ['unsourced_threshold', 'parent_administered_task'],
  'sxk-soc': ['unsourced_threshold', 'parent_administered_task'],
  'sxk-lang': ['unsourced_threshold', 'parent_administered_task'],
  'sxk-adp': ['unsourced_threshold', 'parent_administered_task'],
  'sxk-voc': ['unsourced_threshold'],
  'sxk-asq': ['unsourced_threshold', 'parent_administered_task', 'few_items', 'narrow_window'],
  'sxk-asb': ['unsourced_threshold'],
  'sxk-asr': ['unsourced_threshold', 'rater_role_parent'],
  'sxk-ab': ['unsourced_threshold'],
  'sxk-att': ['unsourced_threshold'],
  'snap-iv': [],
  'chexi': ['descriptive_only'],
  'sxk-spa': ['unsourced_threshold'],
  'sxk-spb': ['unsourced_threshold'],
  'sxk-adl': ['unsourced_threshold', 'rater_not_credentialed'],
  'sxk-ldp': ['unsourced_threshold'],
  'sxk-lds': ['unsourced_threshold'],
  'sxk-tempa': ['unsourced_threshold'],
  'sxk-tempb': ['unsourced_threshold'],
};

/** chexi、tempa、tempb 不出 band（§5.4）。其餘 19 支都出。 */
const NO_BAND: ReadonlyArray<ToolId> = ['chexi', 'sxk-tempa', 'sxk-tempb'];

/** sxk-warn 不進路由 —— 它在 A 裡的位置是 T1，在 T2 重做沒有意義（§4.6）。 */
const NOT_ROUTED: ReadonlyArray<ToolId> = ['sxk-warn'];

/** §5.2：達成率族 3、獨立率 2、其餘 1。 */
function minItemsOf(family: ScoringFamily): number {
  if (family === 'achievement') return 3;
  if (family === 'independence') return 2;
  return 1;
}

function specOf(id: ToolId): ToolSpec {
  const bank = TOOLKIT[id];
  const family = FAMILY[id];
  const [lo, hi] = WINDOW[id];
  return {
    id,
    code: bank.code,
    windowMonths: { lo, hi },
    family,
    minItems: minItemsOf(family),
    // 複本，不是 `TOOL_FEEDS[id]` 本身 —— 兩個都是導出的常數，共用同一個陣列時，
    // 任何一個呼叫端就地 `sort()`／`filter()` 都會把另一個永久改掉，而型別層攔不到
    // 這種「在 process 裡慢慢腐爛」的改動，測試在乾淨的 import 下也照樣綠。
    feeds: TOOL_FEEDS[id].map(f => ({
      dimension: f.dimension,
      sections: f.sections === 'overall' ? 'overall' : [...f.sections],
    })),
    producesBand: !NO_BAND.includes(id),
    parentDoable: true,
    routed: !NOT_ROUTED.includes(id),
    tiers: bank.tiers,
    preQuestions: bank.preQuestions,
    fixedCaveats: FIXED_CAVEATS[id],
    toolkitVersion: 'kit-20260908',
  };
}

/** 22 支，順序照 §3 的登錄表（＝題庫的順序）。 */
export const TOOL_SPECS: Readonly<Record<ToolId, ToolSpec>> = Object.fromEntries(
  (Object.keys(TOOLKIT) as ToolId[]).map(id => [id, specOf(id)]),
) as Record<ToolId, ToolSpec>;

/** 測評月齡在這支工具的窗口內嗎（閉區間）。 */
export function inWindow(id: ToolId, ageMonth: number): boolean {
  const { lo, hi } = TOOL_SPECS[id].windowMonths;
  return ageMonth >= lo && ageMonth <= hi;
}

/** 這支工具餵這個維度嗎。不餵的維度不該收到它的 band（§5.7）。 */
export function feedsDimension(id: ToolId, dimension: DimensionCode): boolean {
  return TOOL_SPECS[id].feeds.some(f => f.dimension === dimension);
}

/** 這個維度在這支工具裡用哪些面向算 band；不餵這個維度時回 `null`。 */
export function sectionsFor(id: ToolId, dimension: DimensionCode): ReadonlyArray<string> | 'overall' | null {
  return TOOL_SPECS[id].feeds.find(f => f.dimension === dimension)?.sections ?? null;
}
