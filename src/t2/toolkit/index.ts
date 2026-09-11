/**
 * T2 題庫的入口：22 支工具、版本號、依月齡挑題。
 *
 * 22 份 `<id>.ts` 由 `scripts/t2-extract-toolkit.ts` 從工具包 zip 產生；這一檔是手寫的，
 * 只做三件事 —— 把 22 份收成一張表、釘住版本號、提供「這個月齡要問幾題」。
 * 計分、分級、路由都不在這裡（#42 起）。
 */

import type { ToolId, ToolkitBank, ToolkitItem, ToolkitSection } from './types';
import { SXK_DEV } from './sxk-dev';
import { SXK_WARN } from './sxk-warn';
import { MCHAT_RF } from './mchat-rf';
import { SXK_GM } from './sxk-gm';
import { SXK_SOC } from './sxk-soc';
import { SXK_LANG } from './sxk-lang';
import { SXK_ADP } from './sxk-adp';
import { SXK_VOC } from './sxk-voc';
import { SXK_ASQ } from './sxk-asq';
import { SXK_ASB } from './sxk-asb';
import { SXK_ASR } from './sxk-asr';
import { SXK_AB } from './sxk-ab';
import { SXK_ATT } from './sxk-att';
import { SNAP_IV } from './snap-iv';
import { CHEXI } from './chexi';
import { SXK_SPA } from './sxk-spa';
import { SXK_SPB } from './sxk-spb';
import { SXK_ADL } from './sxk-adl';
import { SXK_LDP } from './sxk-ldp';
import { SXK_LDS } from './sxk-lds';
import { SXK_TEMPA } from './sxk-tempa';
import { SXK_TEMPB } from './sxk-tempb';

export type * from './types';

/**
 * 題庫的版本：2026-09-08 的工具包。
 * 存進 `ToolResult` 之後，日後題目換版時才知道一筆作答是對著哪一版的題目答的。
 */
export const TOOLKIT_VERSION = 'kit-20260908' as const;

/** 22 支，順序照規格 §3 的登錄表。 */
export const TOOLKIT: Readonly<Record<ToolId, ToolkitBank>> = {
  'sxk-dev': SXK_DEV,
  'sxk-warn': SXK_WARN,
  'mchat-rf': MCHAT_RF,
  'sxk-gm': SXK_GM,
  'sxk-soc': SXK_SOC,
  'sxk-lang': SXK_LANG,
  'sxk-adp': SXK_ADP,
  'sxk-voc': SXK_VOC,
  'sxk-asq': SXK_ASQ,
  'sxk-asb': SXK_ASB,
  'sxk-asr': SXK_ASR,
  'sxk-ab': SXK_AB,
  'sxk-att': SXK_ATT,
  'snap-iv': SNAP_IV,
  'chexi': CHEXI,
  'sxk-spa': SXK_SPA,
  'sxk-spb': SXK_SPB,
  'sxk-adl': SXK_ADL,
  'sxk-ldp': SXK_LDP,
  'sxk-lds': SXK_LDS,
  'sxk-tempa': SXK_TEMPA,
  'sxk-tempb': SXK_TEMPB,
};

export const TOOL_IDS: ReadonlyArray<ToolId> = Object.keys(TOOLKIT) as ToolId[];

/**
 * 這個月齡會出的題，依面向分組（§5.1 出題規則，只看題庫）：
 * - 有 `ageBand` 的面向（dev、warn）：只出 `lo ≤ 月齡 ≤ hi` 的那些面向，整段都出。
 * - 其餘面向：只出 `startMonth ≤ 月齡` 的題；`startMonth` 是 `null` 的題一律出。
 *
 * 沒有適用題目的面向仍會回傳（`items` 為空），畫面上要顯示「本月齡暫無適用題目」
 * 得靠它。工具的月齡窗口**不在這裡檢查** —— 那是登錄表（#42）與路由（#43）的事；
 * 窗口外的月齡在這裡只是題數少或為零。
 */
export function askedSections(bank: ToolkitBank, ageMonth: number): ToolkitSection[] {
  const out: ToolkitSection[] = [];
  for (const s of bank.sections) {
    if (s.ageBand) {
      if (ageMonth < s.ageBand.lo || ageMonth > s.ageBand.hi) continue;
      out.push(s);
      continue;
    }
    const items: ToolkitItem[] = s.items.filter(it => it.startMonth === null || it.startMonth <= ageMonth);
    out.push({ ...s, items });
  }
  return out;
}

/** §4.4：這個月齡要答幾題。是題量預估與後續測試的地基，只依賴題庫。 */
export function askedCount(tool: ToolId | ToolkitBank, ageMonth: number): number {
  const bank = typeof tool === 'string' ? TOOLKIT[tool] : tool;
  return askedSections(bank, ageMonth).reduce((n, s) => n + s.items.length, 0);
}
