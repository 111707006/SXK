import { describe, it, expect } from 'vitest';
import {
  DIM_ROUTES, DIS_ROUTES, candidatesFor, extrasFor, diagnosisToolsFor, functionOrderOf, planT2,
} from '../src/t2/routing';
import { TOOL_SPECS, inWindow, feedsDimension } from '../src/t2/toolSpecs';
import { TOOL_IDS, askedCount } from '../src/t2/toolkit';
import type { ToolId } from '../src/t2/toolkit';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DiagnosisDirection, DimensionCode, PlanItem, T1Flag, T2Plan } from '../src/t2/types';

/**
 * 路由測試（#43，規格 v2 §4、附錄 B）。
 *
 * 【為什麼需要這些】
 * 路由決定一個付了錢的家長要被要求做哪幾份、幾題。錯一格不會有型別錯誤：
 * 星號抄成一支窗口外的工具，結果是三歲的孩子被要求填一份六歲起的量表；
 * 後備漏補一支，結果是某個月齡的孩子被告知「這個年齡沒有工具」，其實有。
 *
 * 下面的表是從規格附錄 B.1／B.2 **重新抄一次**的，不是從 `routing.ts` 讀出來的。
 * 幾處與附錄 B.1 字面不同的地方（`sxk-dev` 恆排末尾、段界那三個月、B.1 列了但附錄 F 說不餵
 * 該維度的三格）在 `SPEC_B1` 上方逐條寫了理由 —— 那些是規格自己前後矛盾，取站得住的那一邊；
 * 全部收在 `docs/specs/t2-v2-errata-2026-09-11.md`。
 */

const GREEN: Record<DimensionCode, T1Flag> = {
  COG: 0, LANG: 0, SOC: 0, EMO: 0, ATT: 0, MOT: 0, SEN: 0, ADL: 0, LEARN: 0,
};

/** 只寫有標記的維度，其餘補綠。 */
function flags(marked: Partial<Record<DimensionCode, T1Flag>>): Record<DimensionCode, T1Flag> {
  return { ...GREEN, ...marked };
}

function ids(items: PlanItem[]): ToolId[] {
  return items.map(i => i.toolId);
}

function allBandItems(plan: T2Plan): PlanItem[] {
  return [...plan.required, ...plan.optional, ...plan.followup];
}

/** 一段月齡逐月跑。 */
function months(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

// ---------------------------------------------------------------------------
// 附錄 B.1 重抄：維度 × 月齡段 → 有序候選（過濾後）。
//
// 每格是「這一段裡可能出現的工具，依優先順序」；逐月比對時再用登錄表的窗口篩一次，
// 所以同一格在不同月齡會長短不同（B.1 寫「星號隨月齡變」就是這件事）。
//
// 與 B.1 字面的差異，全部集中在這裡說明：
//
// 1. **`sxk-dev` 恆排末尾**（§4.2 第 4 條，本票加的）。B.1 把 LANG 37–72 與 COG 的星號
//    給了 sxk-dev，但同一份規格的 §4.4 例子、§11 階段 3 的固定輸入、票 #43 的驗收
//    都寫「48 個月 LANG 紅 → 必做 sxk-lang 49 題」。dev 每個領域只有 5 題、永遠帶
//    `few_items`；讓它擋在 49 題的專用工具前面當「必做」說不過去。受影響的格：
//    LANG 37–72（星號 dev → lang）、COG 18–72（星號 dev → adp，36 仍是 asq）、
//    MOT 30–42（加測順序 dev 退到 asq／adl 之後）。
// 2. **段界那三個月**：ATT 36、LEARN 72、EMO 72。客戶的段是 0–36／37–72，工具窗口
//    卻從 36／72 起 —— sxk-ab（36＋）、sxk-ldp（72＋）、snap-iv（72＋）在那一個月
//    已經在窗口內，§4.2 第 3 條會把它們補進來。§4.5 的「ATT 12–36 no_tool」是段的
//    標籤，不是逐月的事實；§4.5 自己也寫「snap-iv 的 OD 在 72 個月起」。
// 3. **B.1 有三格列了附錄 F 說不餵該維度的工具**，§4.2 第 2 條會把它們拿掉，取附錄 F：
//    - ADL 37–72 的 sxk-asq：asq 的 CO／GM／PS／PE 四個領域沒有生活自理。
//    - LANG 0–36 的 mchat-rf：mchat 只餵 SOC（自閉症篩查的總分不該推語言的 band）。
//    - MOT 0–84 與 85–216 的 sxk-adl：附錄 F 的 adl 只餵 ADL；附錄 C 明寫「動作 85–216」那格
//      是 ADL 頂 PedsQL 的位置、不採。後果：**MOT 85–216 是 no_tool**，§4.5 的表沒把它列進洞裡。
// 4. **LANG 0–36 與 SOC 37–72 的 sxk-asq**：B.1 沒列，但 asq 的 CO 餵 LANG、PE 餵 SOC，
//    36–42 在窗口內，第 3 條會補進來（LANG 只在 36 那一個月；SOC 37–42 排第四，截掉）。
// 5. **LANG 37–72 加測的 asq／voc 先後**：B.1 寫 asq、voc，附錄 F 的順序是 voc、asq。
//    dev 排末尾後兩支都在三支之內，先後只影響顯示順序，取附錄 F。
// ---------------------------------------------------------------------------
interface SpecCell { dimension: DimensionCode; lo: number; hi: number; order: ToolId[]; removed: ToolId[] }

const SPEC_B1: SpecCell[] = [
  { dimension: 'MOT', lo: 0, hi: 84, order: ['sxk-gm', 'sxk-asq', 'sxk-dev'], removed: ['sxk-spa', 'sxk-adl'] },
  { dimension: 'MOT', lo: 85, hi: 216, order: [], removed: ['sxk-spb', 'sxk-adl'] },

  { dimension: 'COG', lo: 0, hi: 36, order: ['sxk-asq', 'sxk-adp', 'sxk-dev'], removed: ['sxk-voc'] },
  { dimension: 'COG', lo: 37, hi: 72, order: ['sxk-adp', 'sxk-asq', 'sxk-dev'], removed: [] },
  { dimension: 'COG', lo: 73, hi: 216, order: [], removed: ['sxk-spb'] },

  { dimension: 'ATT', lo: 0, hi: 11, order: [], removed: [] },                            // 客戶表「12 以下無路由」
  { dimension: 'ATT', lo: 12, hi: 36, order: ['sxk-ab'], removed: ['sxk-tempa', 'sxk-spa'] },   // ab 只在 36 進來
  { dimension: 'ATT', lo: 37, hi: 72, order: ['sxk-ab', 'sxk-att', 'snap-iv'], removed: ['sxk-tempb', 'sxk-spa'] },   // snap 只在 72 進來
  { dimension: 'ATT', lo: 73, hi: 144, order: ['snap-iv', 'sxk-ab', 'sxk-att'], removed: ['chexi', 'sxk-ldp', 'sxk-spa'] },
  { dimension: 'ATT', lo: 145, hi: 216, order: ['sxk-att', 'snap-iv', 'sxk-ab'], removed: ['sxk-lds', 'chexi', 'sxk-spb'] },

  { dimension: 'LEARN', lo: 0, hi: 36, order: [], removed: [] },                          // 客戶表無此列
  { dimension: 'LEARN', lo: 37, hi: 72, order: ['sxk-ldp'], removed: ['sxk-adp', 'sxk-spa', 'sxk-att'] },   // ldp 只在 72 進來
  { dimension: 'LEARN', lo: 73, hi: 144, order: ['sxk-ldp', 'sxk-lds'], removed: ['chexi', 'sxk-spb', 'sxk-ab', 'snap-iv'] },
  { dimension: 'LEARN', lo: 145, hi: 216, order: ['sxk-lds'], removed: ['chexi', 'sxk-att', 'sxk-ab', 'snap-iv', 'sxk-spb'] },

  { dimension: 'LANG', lo: 0, hi: 36, order: ['sxk-voc', 'sxk-lang', 'sxk-asq', 'sxk-dev'], removed: ['sxk-adl', 'mchat-rf'] },
  { dimension: 'LANG', lo: 37, hi: 72, order: ['sxk-lang', 'sxk-voc', 'sxk-asq', 'sxk-dev'], removed: ['sxk-asb', 'sxk-asr'] },
  { dimension: 'LANG', lo: 73, hi: 144, order: [], removed: ['sxk-dev'] },
  { dimension: 'LANG', lo: 145, hi: 216, order: [], removed: [] },                       // 客戶表無此列

  { dimension: 'ADL', lo: 0, hi: 36, order: ['sxk-adl', 'sxk-dev'], removed: [] },
  { dimension: 'ADL', lo: 37, hi: 72, order: ['sxk-adl', 'sxk-dev'], removed: ['sxk-soc', 'sxk-asq'] },
  { dimension: 'ADL', lo: 73, hi: 216, order: ['sxk-adl'], removed: ['sxk-dev'] },

  { dimension: 'EMO', lo: 0, hi: 36, order: [], removed: ['sxk-tempa', 'sxk-adp', 'sxk-asq', 'mchat-rf'] },
  { dimension: 'EMO', lo: 37, hi: 72, order: ['snap-iv'], removed: ['sxk-adp', 'sxk-tempb', 'sxk-soc', 'sxk-asr', 'sxk-asb', 'sxk-adl'] },   // snap 只在 72 進來
  { dimension: 'EMO', lo: 73, hi: 144, order: ['snap-iv'], removed: ['sxk-spb', 'sxk-ab', 'sxk-adl'] },
  { dimension: 'EMO', lo: 145, hi: 216, order: ['snap-iv'], removed: ['sxk-spb'] },

  { dimension: 'SOC', lo: 0, hi: 36, order: ['mchat-rf', 'sxk-asq', 'sxk-soc', 'sxk-asb', 'sxk-asr', 'sxk-dev'], removed: [] },
  { dimension: 'SOC', lo: 37, hi: 72, order: ['sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-asq', 'sxk-dev'], removed: ['sxk-spa'] },   // asq 37–42 補進來，第四支
  { dimension: 'SOC', lo: 73, hi: 144, order: ['sxk-asb', 'sxk-asr'], removed: ['sxk-spb', 'sxk-adl'] },
  { dimension: 'SOC', lo: 145, hi: 216, order: ['sxk-asb', 'sxk-asr'], removed: ['sxk-spb', 'sxk-adl'] },

  { dimension: 'SEN', lo: 0, hi: 36, order: ['sxk-spa'], removed: ['sxk-adp'] },
  { dimension: 'SEN', lo: 37, hi: 60, order: ['sxk-spa', 'sxk-spb'], removed: [] },       // spb 只在 60 進來
  { dimension: 'SEN', lo: 61, hi: 216, order: ['sxk-spb', 'sxk-spa'], removed: [] },
];

/** B.1 斜體：只出標籤的 extras。 */
const SPEC_B1_EXTRAS: Array<{ dimension: DimensionCode; lo: number; hi: number; order: ToolId[] }> = [
  { dimension: 'ATT', lo: 0, hi: 11, order: [] },
  { dimension: 'ATT', lo: 12, hi: 36, order: ['sxk-tempa'] },
  { dimension: 'ATT', lo: 37, hi: 72, order: ['sxk-tempb', 'chexi'] },
  { dimension: 'ATT', lo: 73, hi: 144, order: ['chexi'] },
  { dimension: 'ATT', lo: 145, hi: 216, order: ['chexi'] },
  // B.1 在 LEARN 37–72 寫了 *chexi*（48＋），但 chexi 不在客戶表的學習 3–6 那格、
  // 附錄 F 也只餵 ATT —— §4.2 沒有任何一條會把它放進來，不抄。
  { dimension: 'LEARN', lo: 0, hi: 36, order: [] },
  { dimension: 'LEARN', lo: 37, hi: 72, order: [] },
  { dimension: 'LEARN', lo: 73, hi: 144, order: ['chexi'] },
  { dimension: 'LEARN', lo: 145, hi: 216, order: ['chexi'] },                             // 客戶表列了，≤155
  { dimension: 'EMO', lo: 0, hi: 36, order: ['sxk-tempa', 'sxk-tempb'] },                // tempb 只在 36 進來（附錄 F 補的）
  { dimension: 'EMO', lo: 37, hi: 72, order: ['sxk-tempb'] },
  { dimension: 'EMO', lo: 73, hi: 216, order: ['sxk-tempb'] },                            // 客戶表沒列，附錄 F 補的，≤84
];

describe('附錄 B.1：候選逐月與規格相符', () => {
  it('每格的候選都在窗口內、feeds 含該維度、producesBand 為真、進路由', () => {
    for (const cell of SPEC_B1) {
      for (const m of months(cell.lo, cell.hi)) {
        for (const id of candidatesFor(cell.dimension, m)) {
          const spec = TOOL_SPECS[id];
          expect({ cell: `${cell.dimension} ${m}`, id, ok: inWindow(id, m) && feedsDimension(id, cell.dimension) && spec.producesBand && spec.routed })
            .toEqual({ cell: `${cell.dimension} ${m}`, id, ok: true });
        }
      }
    }
  });

  it('逐月的有序候選 ＝ 重抄的順序過窗口', () => {
    for (const cell of SPEC_B1) {
      for (const m of months(cell.lo, cell.hi)) {
        const expected = cell.order.filter(id => inWindow(id, m));
        expect({ cell: `${cell.dimension} ${m}`, got: candidatesFor(cell.dimension, m) })
          .toEqual({ cell: `${cell.dimension} ${m}`, got: expected });
      }
    }
  });

  it('被〔〕的工具在那一段一個月都不出現', () => {
    for (const cell of SPEC_B1) {
      for (const m of months(cell.lo, cell.hi)) {
        const got = candidatesFor(cell.dimension, m);
        for (const id of cell.removed) expect({ cell: `${cell.dimension} ${m}`, id, present: got.includes(id) }).toEqual({ cell: `${cell.dimension} ${m}`, id, present: false });
      }
    }
  });

  it('九個維度 × 0–216 每一個月都有一格接住，沒有縫也沒有重疊', () => {
    for (const d of DIMENSION_CODES) {
      for (const m of months(0, 216)) {
        const hits = SPEC_B1.filter(c => c.dimension === d && m >= c.lo && m <= c.hi);
        expect({ d, m, hits: hits.length }).toEqual({ d, m, hits: 1 });
      }
    }
  });

  it('sxk-warn 永遠不在候選裡（§4.6 不路由）', () => {
    for (const d of DIMENSION_CODES) for (const m of months(0, 216)) expect(candidatesFor(d, m)).not.toContain('sxk-warn');
  });

  it('extras：只出標籤的三支，逐月與 B.1 斜體相符', () => {
    for (const cell of SPEC_B1_EXTRAS) {
      for (const m of months(cell.lo, cell.hi)) {
        const expected = cell.order.filter(id => inWindow(id, m));
        expect({ cell: `${cell.dimension} ${m}`, got: extrasFor(cell.dimension, m) })
          .toEqual({ cell: `${cell.dimension} ${m}`, got: expected });
      }
    }
    // 沒被客戶表或附錄 F 點到的維度，一個 extras 都沒有
    for (const d of ['MOT', 'COG', 'LANG', 'ADL', 'SOC', 'SEN'] as DimensionCode[]) {
      for (const m of months(0, 216)) expect({ d, m, got: extrasFor(d, m) }).toEqual({ d, m, got: [] });
    }
  });

  it('extras 只會是 producesBand=false 的那三支', () => {
    for (const d of DIMENSION_CODES) {
      for (const m of months(0, 216)) {
        for (const id of extrasFor(d, m)) expect(TOOL_SPECS[id].producesBand).toBe(false);
      }
    }
  });
});

describe('客戶的原始表（DIM／DIS）抄對了', () => {
  it('DIM 29 列、九個維度都有、段不重疊', () => {
    expect(DIM_ROUTES).toHaveLength(29);
    for (const d of DIMENSION_CODES) {
      const rows = DIM_ROUTES.filter(r => r.dimension === d);
      expect(rows.length).toBeGreaterThan(0);
      for (const m of months(0, 216)) {
        expect(rows.filter(r => m >= r.lo && m <= r.hi).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('DIM 只列 22 支裡的工具，且沒有 sxk-warn', () => {
    for (const r of DIM_ROUTES) {
      for (const id of r.tools) {
        expect(TOOL_IDS).toContain(id);
        expect(id).not.toBe('sxk-warn');
      }
    }
  });

  it('DIS 十種、每種四段、三格是空的', () => {
    const kinds: DiagnosisDirection[] = ['cp', 'dd', 'id', 'ld', 'adhd', 'lang', 'emo', 'psych', 'tic', 'asd'];
    expect(Object.keys(DIS_ROUTES).sort()).toEqual([...kinds].sort());
    for (const k of kinds) {
      expect(DIS_ROUTES[k].cells.map(c => [c.lo, c.hi])).toEqual([[0, 36], [37, 72], [73, 144], [145, 216]]);
      for (const c of DIS_ROUTES[k].cells) {
        expect(c.tools.length).toBeLessThanOrEqual(6);
        for (const id of c.tools) expect(TOOL_IDS).toContain(id);
      }
    }
    const empty = kinds.filter(k => DIS_ROUTES[k].cells[0].tools.length === 0);
    expect(empty.sort()).toEqual(['adhd', 'ld', 'tic']);
  });

  // ---------------------------------------------------------------------------
  // 附錄 B.2 重抄：疾病 × 月齡段。規格用「gm、dev、asq…」的短名，這裡照抄再補 `sxk-` 前綴；
  // 「同學習障礙」「同情緒障礙」那些格，規格是用文字指過去，這裡也照做（引用同一個常數），
  // 但 ld／emo 本身是逐字抄的。`routing.ts` 那份是從中控台的 DIS 抄的，兩份來源不同。
  // ---------------------------------------------------------------------------
  const t = (...xs: string[]): ToolId[] =>
    xs.map(x => (x === 'mchat-rf' || x === 'snap-iv' || x === 'chexi' ? x : `sxk-${x}`) as ToolId);
  const LD = [t(), t('dev', 'chexi', 'ab', 'snap-iv', 'spa', 'soc'), t('ldp', 'chexi', 'ab', 'snap-iv', 'att', 'spb'), t('lds', 'chexi', 'att', 'spb', 'ab', 'snap-iv')];
  const EMO = [t('tempa', 'mchat-rf', 'lang', 'adp', 'soc', 'asq'), t('dev', 'chexi', 'asb', 'asr', 'soc', 'lang'), t('chexi', 'asb', 'asr', 'att', 'ab', 'snap-iv'), t('chexi', 'asr', 'ab', 'att', 'snap-iv', 'spb')];
  const DD_ORDER: DimensionCode[] = ['COG', 'LANG', 'SEN', 'ATT', 'LEARN', 'SOC', 'EMO', 'MOT'];   // 認知›語言›感覺處理›注意力›學習›社交›情緒›動作
  const LD_ORDER: DimensionCode[] = ['LEARN', 'ATT', 'SEN', 'COG', 'LANG', 'SOC', 'EMO', 'MOT'];   // 學習›注意力›感覺處理›認知›語言›社交›情緒›動作
  const EMO_ORDER: DimensionCode[] = ['EMO', 'ATT', 'LANG', 'COG', 'SEN', 'SOC', 'LEARN'];         // 情緒›注意力›語言›認知›感覺處理›社交›學習
  const SPEC_B2: Record<DiagnosisDirection, { order: DimensionCode[]; cells: ToolId[][] }> = {
    cp: { order: ['MOT', 'COG', 'LANG', 'SEN', 'ATT', 'EMO', 'SOC', 'LEARN'],                     // 動作›認知›語言›感覺處理›注意力›情緒›社交›學習
      cells: [t('gm', 'dev', 'asq', 'voc', 'lang', 'adl'), t('gm', 'dev', 'lang', 'spa', 'adl'), t('adl', 'spb', 'ldp'), t('adl', 'spb', 'lds', 'chexi')] },
    dd: { order: DD_ORDER,
      cells: [t('dev', 'asq', 'adp', 'gm', 'voc', 'tempa'), t('dev', 'lang', 'gm', 'chexi', 'spa', 'adl'), t('adl', 'spb', 'ldp', 'chexi'), t('adl', 'spb', 'lds', 'chexi')] },
    id: { order: DD_ORDER,                                                                          // 同發展遲緩
      cells: [t('dev', 'asq', 'voc', 'tempa', 'adl', 'adp'), t('dev', 'lang', 'gm', 'soc', 'adp', 'chexi'), t('ldp', 'chexi', 'spb', 'adl'), t('lds', 'chexi', 'spb', 'adl')] },
    ld: { order: LD_ORDER, cells: LD },
    adhd: { order: ['ATT', 'LEARN', 'SEN', 'COG', 'LANG', 'SOC', 'EMO', 'MOT'], cells: LD },        // 注意力›學習›感覺處理›認知›語言›社交›情緒›動作；同學習障礙
    lang: { order: ['LANG', 'COG', 'LEARN', 'SOC', 'SEN', 'ATT', 'EMO', 'MOT'],                   // 語言›認知›學習›社交›感覺處理›注意力›情緒›動作
      cells: [t('voc', 'lang', 'mchat-rf', 'soc', 'dev', 'adp'), t('lang', 'asb', 'asr', 'soc', 'adp', 'dev'), t('chexi', 'ldp', 'asb', 'asr', 'spb', 'adl'), t('lds', 'chexi', 'asr', 'ab', 'snap-iv', 'spb')] },
    emo: { order: EMO_ORDER, cells: EMO },
    psych: { order: EMO_ORDER, cells: EMO },                                                        // 同情緒障礙
    tic: { order: ['EMO', 'SEN', 'ATT', 'LEARN', 'COG', 'LANG', 'SOC'], cells: LD },                // 情緒›感覺處理›注意力›學習›認知›語言›社交；同學習障礙
    asd: { order: ['SOC', 'EMO', 'LANG', 'COG', 'LEARN', 'SEN', 'ATT', 'MOT'],                    // 社交›情緒›語言›認知›學習›感覺處理›注意力›動作
      cells: [t('mchat-rf', 'voc', 'soc', 'lang', 'adp', 'gm'), t('asb', 'asr', 'lang', 'dev', 'soc', 'adp'), t('asb', 'asr', 'chexi', 'spb', 'ldp', 'adl'), t('asr', 'lds', 'chexi', 'ab', 'snap-iv', 'spb')] },
  };

  it('DIS 十種 × 四段的工具欄與功能處理順序，逐格與附錄 B.2 重抄相符', () => {
    for (const k of Object.keys(SPEC_B2) as DiagnosisDirection[]) {
      expect({ k, order: functionOrderOf(k) }).toEqual({ k, order: SPEC_B2[k].order });
      expect({ k, cells: DIS_ROUTES[k].cells.map(c => [...c.tools]) }).toEqual({ k, cells: SPEC_B2[k].cells });
    }
  });

  it('功能處理順序：每種都有、無重複、只用九碼；沒有一列有 ADL', () => {
    for (const k of Object.keys(DIS_ROUTES) as DiagnosisDirection[]) {
      const order = functionOrderOf(k);
      expect(order.length).toBeGreaterThanOrEqual(7);
      expect(new Set(order).size).toBe(order.length);
      for (const d of order) expect(DIMENSION_CODES).toContain(d);
      expect(order).not.toContain('ADL');
    }
    expect(functionOrderOf('asd')).toEqual(['SOC', 'EMO', 'LANG', 'COG', 'LEARN', 'SEN', 'ATT', 'MOT']);
    expect(functionOrderOf('cp')).toEqual(['MOT', 'COG', 'LANG', 'SEN', 'ATT', 'EMO', 'SOC', 'LEARN']);
  });
});

describe('§4.5：沒有工具的格', () => {
  function noToolFor(d: DimensionCode, m: number): boolean {
    const plan = planT2(flags({ [d]: 2 }), m);
    return plan.noTool.includes(d);
  }

  it('LANG 73＋、COG 73＋、SEN 0–23 與 181＋，逐月 no_tool', () => {
    for (const m of months(73, 216)) {
      expect({ d: 'LANG', m, noTool: noToolFor('LANG', m) }).toEqual({ d: 'LANG', m, noTool: true });
      expect({ d: 'COG', m, noTool: noToolFor('COG', m) }).toEqual({ d: 'COG', m, noTool: true });
    }
    for (const m of [...months(0, 23), ...months(181, 216)]) {
      expect({ d: 'SEN', m, noTool: noToolFor('SEN', m) }).toEqual({ d: 'SEN', m, noTool: true });
    }
  });

  // §4.5 的表沒列這一格（寫「只剩 sxk-adl 的移動與轉位 4 項」），但附錄 F 的 adl 不餵 MOT（檔頭第 3 點）
  it('MOT 73＋逐月 no_tool（gm、dev 到 72，asq 到 42）', () => {
    for (const m of months(73, 216)) expect({ d: 'MOT', m, noTool: noToolFor('MOT', m) }).toEqual({ d: 'MOT', m, noTool: true });
    for (const m of months(0, 72)) expect({ d: 'MOT', m, noTool: noToolFor('MOT', m) }).toEqual({ d: 'MOT', m, noTool: false });
  });

  // 段的標籤是 12–36／37–72／0–72；逐月的事實是 sxk-ab 從 36、sxk-ldp 與 snap-iv 從 72
  // 就在窗口內（見檔頭第 2 點）。0–11 的 ATT 客戶表寫「無路由」，也是 no_tool。
  it('ATT 0–35、LEARN 0–71、EMO 0–71，逐月 no_tool', () => {
    for (const m of months(0, 35)) expect({ d: 'ATT', m, noTool: noToolFor('ATT', m) }).toEqual({ d: 'ATT', m, noTool: true });
    for (const m of months(0, 71)) {
      expect({ d: 'LEARN', m, noTool: noToolFor('LEARN', m) }).toEqual({ d: 'LEARN', m, noTool: true });
      expect({ d: 'EMO', m, noTool: noToolFor('EMO', m) }).toEqual({ d: 'EMO', m, noTool: true });
    }
  });

  it('段界那一個月：工具一到窗口就補進來，不再是 no_tool', () => {
    expect(ids(planT2(flags({ ATT: 2 }), 36).required)).toEqual(['sxk-ab']);
    expect(ids(planT2(flags({ LEARN: 2 }), 72).required)).toEqual(['sxk-ldp']);
    expect(ids(planT2(flags({ EMO: 2 }), 72).required)).toEqual(['snap-iv']);
  });

  it('no_tool 的維度仍可以有 extras（EMO 24 個月：氣質）；no_tool 不因 extras 而消失', () => {
    const plan = planT2(flags({ EMO: 2 }), 24);
    expect(plan.noTool).toEqual(['EMO']);
    expect(plan.required).toEqual([]);
    expect(ids(plan.extras)).toEqual(['sxk-tempa']);
  });

  it('沒被標記的維度不會出現在 noTool；綠的一律不做', () => {
    const plan = planT2(GREEN, 100);
    expect(plan.noTool).toEqual([]);
    expect(allBandItems(plan)).toEqual([]);
    expect(plan.extras).toEqual([]);
  });

  it('noTool 依 DIMENSION_CODES 的順序，不依呼叫端寫物件的順序', () => {
    const plan = planT2({ ...GREEN, LEARN: 2, LANG: 1, COG: 2 }, 100);
    expect(plan.noTool).toEqual(['COG', 'LANG']);        // LEARN 100 個月有 ldp，不在 noTool
  });
});

describe('固定輸入：48 個月、LANG 紅、ATT 紅、SEN 黃（§4.4、§11 階段 3）', () => {
  const plan = planT2(flags({ LANG: 2, ATT: 2, SEN: 1 }), 48);

  it('必做 sxk-lang 49 題＋sxk-ab 41 題', () => {
    expect(plan.required.map(i => [i.toolId, i.askedCount, i.role])).toEqual([
      ['sxk-lang', 49, 'required'],
      ['sxk-ab', 41, 'required'],
    ]);
    expect(plan.required.map(i => i.forDimensions)).toEqual([['LANG'], ['ATT']]);
  });

  it('選做 sxk-spa 75 題', () => {
    expect(plan.optional.map(i => [i.toolId, i.askedCount, i.role, i.forDimensions])).toEqual([
      ['sxk-spa', 75, 'optional', ['SEN']],
    ]);
  });

  it('加測：LANG 的 sxk-dev；ATT 的 sxk-att 60 個月起才有、48 沒有', () => {
    expect(plan.followup.map(i => [i.toolId, i.forDimensions, i.role])).toEqual([
      ['sxk-dev', ['LANG'], 'followup'],
    ]);
  });

  it('extras：ATT 帶進 tempb 與 chexi，恆為 extra', () => {
    expect(plan.extras.map(i => [i.toolId, i.forDimensions, i.role])).toEqual([
      ['sxk-tempb', ['ATT'], 'extra'],
      ['chexi', ['ATT'], 'extra'],
    ]);
  });

  it('題數三組分開算；extras 不算', () => {
    expect(plan.estimatedItems).toEqual({ required: 90, optional: 75, followup: askedCount('sxk-dev', 48) });
    expect(plan.estimatedItems.followup).toBe(30);
  });

  it('沒有 noTool、沒有診斷方向', () => {
    expect(plan.noTool).toEqual([]);
    expect(plan.functionOrder).toBeNull();
    expect(plan.ageMonth).toBe(48);
  });

  it('每筆的 askedCount 就是題庫在那個月齡的題數', () => {
    for (const item of [...allBandItems(plan), ...plan.extras]) {
      expect({ id: item.toolId, n: item.askedCount }).toEqual({ id: item.toolId, n: askedCount(item.toolId, 48) });
    }
  });
});

describe('星號隨月齡變', () => {
  function star(d: DimensionCode, m: number): ToolId | undefined {
    return planT2(flags({ [d]: 2 }), m).required[0]?.toolId;
  }

  it('LANG：0–11 是 sxk-dev，12 起是 sxk-voc，37 起是 sxk-lang', () => {
    for (const m of months(0, 11)) expect({ m, star: star('LANG', m) }).toEqual({ m, star: 'sxk-dev' });
    for (const m of months(12, 36)) expect({ m, star: star('LANG', m) }).toEqual({ m, star: 'sxk-voc' });
    for (const m of months(37, 72)) expect({ m, star: star('LANG', m) }).toEqual({ m, star: 'sxk-lang' });
  });

  // 票的驗收寫「SOC 0–15／16–30／31–35」；sxk-soc 的窗口從 12 起，所以 12–15 的星號是
  // soc 不是 dev —— 那個 0–15 是把 mchat 的起點（16）當成了整格的起點。四段而不是三段。
  it('SOC：0–11 dev、12–15 soc、16–30 mchat-rf、31–35 soc、36 asq', () => {
    for (const m of months(0, 11)) expect({ m, star: star('SOC', m) }).toEqual({ m, star: 'sxk-dev' });
    for (const m of months(12, 15)) expect({ m, star: star('SOC', m) }).toEqual({ m, star: 'sxk-soc' });
    for (const m of months(16, 30)) expect({ m, star: star('SOC', m) }).toEqual({ m, star: 'mchat-rf' });
    for (const m of months(31, 35)) expect({ m, star: star('SOC', m) }).toEqual({ m, star: 'sxk-soc' });
    expect(star('SOC', 36)).toBe('sxk-asq');
    for (const m of months(37, 72)) expect({ m, star: star('SOC', m) }).toEqual({ m, star: 'sxk-asb' });
  });

  it('ADL：0–29 是 sxk-dev，30 起是 sxk-adl', () => {
    for (const m of months(0, 29)) expect({ m, star: star('ADL', m) }).toEqual({ m, star: 'sxk-dev' });
    for (const m of months(30, 180)) expect({ m, star: star('ADL', m) }).toEqual({ m, star: 'sxk-adl' });
  });

  it('COG：0–17 dev、18–35 adp、36 asq、37–72 adp（dev 恆排末尾的結果）', () => {
    for (const m of months(0, 17)) expect({ m, star: star('COG', m) }).toEqual({ m, star: 'sxk-dev' });
    for (const m of months(18, 35)) expect({ m, star: star('COG', m) }).toEqual({ m, star: 'sxk-adp' });
    expect(star('COG', 36)).toBe('sxk-asq');
    for (const m of months(37, 72)) expect({ m, star: star('COG', m) }).toEqual({ m, star: 'sxk-adp' });
  });

  it('SEN：24–59 spa、60 起 spb（60–71 兩支都在，spb 先）', () => {
    for (const m of months(24, 59)) expect({ m, star: star('SEN', m) }).toEqual({ m, star: 'sxk-spa' });
    expect(star('SEN', 60)).toBe('sxk-spa');                 // 60 仍在客戶的 37–60 段，spa 先
    for (const m of months(61, 180)) expect({ m, star: star('SEN', m) }).toEqual({ m, star: 'sxk-spb' });
  });

  it('ATT 73–144：snap-iv 是星號（§10.1 第 4 題：拿掉它星號會落到 sxk-ab）', () => {
    for (const m of months(73, 144)) expect({ m, star: star('ATT', m) }).toEqual({ m, star: 'snap-iv' });
    for (const m of months(145, 180)) expect({ m, star: star('ATT', m) }).toEqual({ m, star: 'sxk-att' });
  });
});

describe('紅必做、黃選做、綠不做；加測最多兩支', () => {
  it('同一支工具：紅是 required、黃是 optional', () => {
    const red = planT2(flags({ SOC: 2 }), 48);
    const yellow = planT2(flags({ SOC: 1 }), 48);
    expect(red.required.map(i => [i.toolId, i.role])).toEqual([['sxk-asb', 'required']]);
    expect(red.optional).toEqual([]);
    expect(yellow.optional.map(i => [i.toolId, i.role])).toEqual([['sxk-asb', 'optional']]);
    expect(yellow.required).toEqual([]);
    // 加測不分紅黃
    expect(ids(red.followup)).toEqual(ids(yellow.followup));
  });

  it('每維度最多三支：SOC 48 個月候選有四支（asb、asr、soc、dev），只留星號＋兩支加測', () => {
    expect(candidatesFor('SOC', 48)).toEqual(['sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-dev']);
    const plan = planT2(flags({ SOC: 2 }), 48);
    expect(ids(plan.required)).toEqual(['sxk-asb']);
    expect(ids(plan.followup)).toEqual(['sxk-asr', 'sxk-soc']);
    expect(allBandItems(plan)).toHaveLength(3);
  });

  it('沒有診斷方向時，任何維度、任何月齡，帶著該維度的工具都 ≤ 3', () => {
    for (const d of DIMENSION_CODES) {
      for (const m of months(0, 216)) {
        const plan = planT2(flags({ [d]: 2 }), m);
        const n = allBandItems(plan).filter(i => i.forDimensions.includes(d)).length;
        expect({ d, m, n: n <= 3 }).toEqual({ d, m, n: true });
      }
    }
  });

  it('extras 不佔名額、恆為 extra、不進題數', () => {
    const plan = planT2(flags({ ATT: 2, EMO: 2 }), 50);
    expect(ids(plan.required)).toEqual(['sxk-ab']);
    expect(plan.extras.map(i => [i.toolId, i.role, i.forDimensions])).toEqual([
      ['sxk-tempb', 'extra', ['EMO', 'ATT']],          // EMO 先跑到（DIMENSION_CODES 的順序），ATT 併進來
      ['chexi', 'extra', ['ATT']],
    ]);
    expect(plan.estimatedItems).toEqual({ required: askedCount('sxk-ab', 50), optional: 0, followup: 0 });
  });
});

describe('診斷方向（§4.3、附錄 B.2）', () => {
  it('自閉症 48 個月：asb、asr、lang、dev、soc、adp 全為必做，功能處理順序回傳', () => {
    const plan = planT2(GREEN, 48, 'asd');
    expect(plan.required.map(i => [i.toolId, i.role])).toEqual([
      ['sxk-asb', 'required'], ['sxk-asr', 'required'], ['sxk-lang', 'required'],
      ['sxk-dev', 'required'], ['sxk-soc', 'required'], ['sxk-adp', 'required'],
    ]);
    expect(plan.optional).toEqual([]);
    expect(plan.followup).toEqual([]);
    expect(plan.functionOrder).toEqual(['SOC', 'EMO', 'LANG', 'COG', 'LEARN', 'SEN', 'ATT', 'MOT']);
    expect(plan.estimatedItems.required).toBe(57 + 15 + 49 + 30 + 36 + 37);
  });

  it('診斷工具的 forDimensions 依附錄 F（dev 五個維度）', () => {
    const plan = planT2(GREEN, 48, 'asd');
    const dev = plan.required.find(i => i.toolId === 'sxk-dev')!;
    expect(dev.forDimensions).toEqual(['MOT', 'LANG', 'SOC', 'ADL', 'COG']);
    const asb = plan.required.find(i => i.toolId === 'sxk-asb')!;
    expect(asb.forDimensions).toEqual(['SOC']);
  });

  it('多動症 24 個月：那一格是空的，選了等於沒選', () => {
    const without = planT2(flags({ LANG: 2, SOC: 1 }), 24);
    const withAdhd = planT2(flags({ LANG: 2, SOC: 1 }), 24, 'adhd');
    expect(withAdhd).toEqual(without);
    expect(withAdhd.functionOrder).toBeNull();
  });

  it('沒選（undefined 或 null）、空字串（中控台「未定」）、選了客戶留白的格，四者輸出一樣', () => {
    const a = planT2(flags({ ATT: 2 }), 30);
    expect(planT2(flags({ ATT: 2 }), 30, null)).toEqual(a);
    expect(planT2(flags({ ATT: 2 }), 30, '' as unknown as DiagnosisDirection)).toEqual(a);
    expect(planT2(flags({ ATT: 2 }), 30, 'ld')).toEqual(a);
  });

  it('客戶那格有列工具但全在窗口外（自閉症 4 個月）：沒有必做，但功能處理順序照客戶給的回傳', () => {
    expect(diagnosisToolsFor('asd', 4)).toEqual([]);
    const plan = planT2(flags({ SOC: 2 }), 4, 'asd');
    expect(ids(plan.required)).toEqual(['sxk-dev']);                // 只有 T1 路由來的
    expect(plan.functionOrder).toEqual(['SOC', 'EMO', 'LANG', 'COG', 'LEARN', 'SEN', 'ATT', 'MOT']);
    // 情緒障礙 0–11 也是這種格；學習障礙 0–36 是客戶留白，才是 null
    expect(planT2(GREEN, 8, 'emo').functionOrder).toEqual(['EMO', 'ATT', 'LANG', 'COG', 'SEN', 'SOC', 'LEARN']);
    expect(planT2(GREEN, 8, 'ld').functionOrder).toBeNull();
  });

  it('過窗口：學習障礙 48 個月的 snap-iv（72＋）拿掉；chexi 不出 band，落到 extras 不進必做', () => {
    expect(diagnosisToolsFor('ld', 48)).toEqual(['sxk-dev', 'chexi', 'sxk-ab', 'sxk-spa', 'sxk-soc']);
    const plan = planT2(GREEN, 48, 'ld');
    expect(ids(plan.required)).toEqual(['sxk-dev', 'sxk-ab', 'sxk-spa', 'sxk-soc']);
    expect(plan.extras.map(i => [i.toolId, i.role, i.forDimensions])).toEqual([['chexi', 'extra', ['ATT']]]);
    expect(plan.functionOrder).toEqual(['LEARN', 'ATT', 'SEN', 'COG', 'LANG', 'SOC', 'EMO', 'MOT']);
  });

  it('診斷把 T1 的選做與加測提成必做，同一支只剩一筆', () => {
    // 語言障礙 48：lang、asb、asr、soc、adp、dev。T1 黃了 LANG（lang 選做、dev 加測）
    const plan = planT2(flags({ LANG: 1 }), 48, 'lang');
    expect(ids(plan.optional)).toEqual([]);
    expect(ids(plan.followup)).toEqual([]);
    expect(ids(plan.required).sort()).toEqual(['sxk-adp', 'sxk-asb', 'sxk-asr', 'sxk-dev', 'sxk-lang', 'sxk-soc'].sort());
    const lang = plan.required.find(i => i.toolId === 'sxk-lang')!;
    expect(lang.forDimensions).toEqual(['LANG']);
    expect(plan.required.filter(i => i.toolId === 'sxk-lang')).toHaveLength(1);
  });

  it('十種在 0–216 每一個月都算得出來，工具都在窗口內且進路由', () => {
    for (const k of Object.keys(DIS_ROUTES) as DiagnosisDirection[]) {
      for (const m of months(0, 216)) {
        for (const id of diagnosisToolsFor(k, m)) {
          expect({ k, m, id, ok: inWindow(id, m) && TOOL_SPECS[id].routed }).toEqual({ k, m, id, ok: true });
        }
      }
    }
  });
});

describe('去重：同一支工具落在多個維度', () => {
  it('sxk-dev 是 LANG 的加測也是 ADL 的星號（20 個月）→ 一筆、required、維度聯集', () => {
    const plan = planT2(flags({ LANG: 2, ADL: 2 }), 20);
    expect(candidatesFor('LANG', 20)).toEqual(['sxk-voc', 'sxk-lang', 'sxk-dev']);
    expect(candidatesFor('ADL', 20)).toEqual(['sxk-dev']);
    const devs = allBandItems(plan).filter(i => i.toolId === 'sxk-dev');
    expect(devs).toHaveLength(1);
    expect(devs[0].role).toBe('required');
    expect(devs[0].forDimensions).toEqual(['LANG', 'ADL']);
    expect(ids(plan.followup)).toEqual(['sxk-lang']);
  });

  it('都是加測 → 仍是 followup，維度依 DIMENSION_CODES 的順序聯集（40 個月的 sxk-asq）', () => {
    // COG 紅 → adp 必做、asq／dev 加測；LANG 紅 → lang 必做、voc／asq 加測；MOT 黃 → gm 選做、asq／adl 加測
    const plan = planT2(flags({ COG: 2, MOT: 1, LANG: 2 }), 40);
    const asq = allBandItems(plan).filter(i => i.toolId === 'sxk-asq');
    expect(asq).toHaveLength(1);
    expect(asq[0].role).toBe('followup');
    expect(asq[0].forDimensions).toEqual(['COG', 'LANG', 'MOT']);
  });

  it('兩個維度的加測 → 一筆 followup（32 個月的 sxk-dev）', () => {
    // SOC 紅 → soc 必做、asb／asr 加測（dev 第四，截掉）；ADL 黃 → adl 選做、dev 加測；LANG 黃 → voc 選做、lang／dev 加測
    const plan = planT2(flags({ SOC: 2, ADL: 1, LANG: 1 }), 32);
    const dev = allBandItems(plan).filter(i => i.toolId === 'sxk-dev');
    expect(dev).toHaveLength(1);
    expect(dev[0].role).toBe('followup');
    expect(dev[0].forDimensions).toEqual(['LANG', 'ADL']);
  });

  it('role 取最強：加測撞上必做 → 必做，且不再留在加測那一組（14 個月的 sxk-dev）', () => {
    // LANG 黃 → voc 選做、lang／dev 加測；SOC 紅 → soc 必做、dev 加測；ADL 紅 → dev 必做
    const plan = planT2(flags({ LANG: 1, SOC: 2, ADL: 2 }), 14);
    const dev = allBandItems(plan).filter(i => i.toolId === 'sxk-dev');
    expect(dev).toHaveLength(1);
    expect(dev[0].role).toBe('required');
    expect(dev[0].forDimensions).toEqual(['LANG', 'SOC', 'ADL']);
    expect(ids(plan.followup)).not.toContain('sxk-dev');
    expect(ids(plan.required)).toContain('sxk-dev');
  });

  it('role 取最強：加測撞上選做 → 選做，並從加測那一組移走（14 個月的 sxk-dev）', () => {
    // LANG 紅 → voc 必做、lang／dev 加測（mchat 16 起才進來）；ADL 黃 → 只有 dev（adl 30 起）→ 選做
    const plan = planT2(flags({ LANG: 2, ADL: 1 }), 14);
    const dev = allBandItems(plan).filter(i => i.toolId === 'sxk-dev');
    expect(dev).toHaveLength(1);
    expect(dev[0].role).toBe('optional');
    expect(dev[0].forDimensions).toEqual(['LANG', 'ADL']);
    expect(ids(plan.optional)).toEqual(['sxk-dev']);
    expect(ids(plan.followup)).toEqual(['sxk-lang']);
  });

  it('三組加 extras 之間沒有同一支出現兩次；required／optional／followup 裡的 role 與所在組一致', () => {
    for (const m of [10, 20, 36, 48, 72, 100, 150, 200]) {
      for (const dx of [undefined, 'asd', 'ld', 'cp'] as Array<DiagnosisDirection | undefined>) {
        const plan = planT2({ COG: 2, LANG: 1, SOC: 2, EMO: 1, ATT: 2, MOT: 1, SEN: 2, ADL: 1, LEARN: 2 }, m, dx);
        const all = [...allBandItems(plan), ...plan.extras];
        expect(new Set(ids(all)).size).toBe(all.length);
        for (const i of plan.required) expect(i.role).toBe('required');
        for (const i of plan.optional) expect(i.role).toBe('optional');
        for (const i of plan.followup) expect(i.role).toBe('followup');
        for (const i of plan.extras) expect(i.role).toBe('extra');
        const sum = (xs: PlanItem[]) => xs.reduce((n, i) => n + i.askedCount, 0);
        expect(plan.estimatedItems).toEqual({ required: sum(plan.required), optional: sum(plan.optional), followup: sum(plan.followup) });
      }
    }
  });
});

describe('輸入守衛', () => {
  it('月齡不是非負整數就丟錯，不安靜地回一份空計畫', () => {
    expect(() => planT2(GREEN, Number.NaN)).toThrow(/月齡/);
    expect(() => planT2(GREEN, -1)).toThrow(/月齡/);
    expect(() => planT2(GREEN, Number.POSITIVE_INFINITY)).toThrow(/月齡/);
    // 36.5 會掉進客戶表 0–36 與 37–72 之間的縫，只剩後備 —— 不能讓它安靜地過
    expect(() => planT2(GREEN, 36.5)).toThrow(/整數/);
    expect(() => planT2(GREEN, 0)).not.toThrow();
  });

  it('t1Flags 不是物件就丟清楚的錯，不是 TypeError', () => {
    expect(() => planT2(undefined as unknown as Record<DimensionCode, T1Flag>, 48)).toThrow(/t1Flags/);
    expect(() => planT2(null as unknown as Record<DimensionCode, T1Flag>, 48)).toThrow(/t1Flags/);
  });

  it('T1 標記不是 0／1／2 就丟錯：JSON 進來的字串 "2" 不能安靜地變成綠', () => {
    expect(() => planT2({ ...GREEN, LANG: '2' as unknown as T1Flag }, 48)).toThrow(/LANG.*T1 標記/);
    expect(() => planT2({ ...GREEN, ATT: 3 as unknown as T1Flag }, 48)).toThrow(/ATT/);
    expect(() => planT2({ ...GREEN, SOC: undefined as unknown as T1Flag }, 48)).toThrow(/SOC/);
  });

  it('不認得的診斷方向丟清楚的錯，不是 TypeError', () => {
    expect(() => planT2(GREEN, 48, '自閉症' as unknown as DiagnosisDirection)).toThrow(/診斷方向/);
    expect(() => functionOrderOf('ASD' as unknown as DiagnosisDirection)).toThrow(/診斷方向/);
    expect(() => diagnosisToolsFor('toString' as unknown as DiagnosisDirection, 48)).toThrow(/診斷方向/);
  });

  it('216 以上不丟錯：所有被標記的維度都是 no_tool', () => {
    const plan = planT2({ COG: 2, LANG: 2, SOC: 2, EMO: 2, ATT: 2, MOT: 2, SEN: 2, ADL: 2, LEARN: 2 }, 240);
    expect(plan.noTool).toEqual([...DIMENSION_CODES]);
    expect(allBandItems(plan)).toEqual([]);
  });

  it('回傳的陣列是新的，改它不會動到表', () => {
    const a = planT2(flags({ SOC: 2 }), 48);
    a.required.length = 0;
    a.followup[0].forDimensions.push('EMO');
    const b = planT2(flags({ SOC: 2 }), 48);
    expect(ids(b.required)).toEqual(['sxk-asb']);
    expect(b.followup[0].forDimensions).toEqual(['SOC']);
    expect(candidatesFor('SOC', 48)).toEqual(['sxk-asb', 'sxk-asr', 'sxk-soc', 'sxk-dev']);
  });
});
