/**
 * 分齡發展（dev）、生活自理（adl）、學習障礙（ldp／lds）的規則表（規格 §5.9，#50）。
 *
 * 【為什麼三個計分族放在同一檔】
 * 這四支在計分層（#46）分屬三族 —— 通過率、獨立率、總分 —— 但**判法只差一件事**：
 * 標籤在面向級（dev、ldp、lds）還是逐題級（adl）。band 一律照 `feeds` 算、caveats 一律
 * 是登錄表那幾個，沒有前置題（四支的 `preQuestions` 都是空的）、沒有倒退、沒有任何一條
 * 規則會繞過分數直接改 band。規則表按「判法一不一樣」分檔（#48 起的分法），所以三族一檔。
 *
 * 【四支各自的形狀】
 * - `sxk-dev`：**多維度工具**，每個領域的通過率各餵自己的維度（MOT←MOT、LANG←LANG、
 *   SOC←SOC、ADL←ADL、COG←COG），不用總分。FM 不在 `feeds` 裡 —— 它不出 band，但領域
 *   tier ≥ 2 照樣出 `mot.fine_motor`。一個領域只有 5 題，通過 4 題＝80%＝tier 2；工具包的
 *   報告矩陣就是這樣判的，照做，但登錄表恆帶 `few_items`（§5.4 明寫「一律標」）。
 *   五題全答「不評」→ 分母 0 → `pct`／`tier` 都是 `null`、`scored` 是 false → 那個維度 `null`
 *   （不是 0 分，也不是 clear）。這三層在 #46 就一致了，這裡只是不去蓋掉它。
 * - `sxk-adl`：總獨立率餵 ADL，標籤**逐項**（答 ≤ 4 ＝ 大人動手了，§5.5；5 是「口頭引導」，
 *   大人不碰他）。MO 四項的 `mot.locomotion` 與 CC 前兩項的語言標籤都只出標籤 ——
 *   adl 的 `feeds` 只有 ADL，附錄 C 把中控台那幾格拿掉了。
 * - `sxk-ldp`／`lds`：**總分**（不是百分比）餵 LEARN；各方面用題庫自己那張 0–18 的
 *   `sectionTiers`（#46 已經套好），tier ≥ 2 出該方面的標籤，注意力方面的 `att.inattention`
 *   只出標籤。兩支的題目、分段、對應表完全相同，共用同一個工廠。
 *
 * 【唯一一條不在對應表裡的規則】
 * adl 的括約肌控制領域只有 2 項 → `few_items`（§5.9 點名）。它不寫在登錄表的
 * `fixedCaveats`，因為它講的是**那個領域的題數**，不是這支工具的性質：題庫哪天把括約肌
 * 拆成六題以上，這一條就該自己停掉。dev 與 asq 的 `few_items` 則是無條件的（每個領域
 * 恆為 5／6 題），所以留在登錄表。
 */

import { TOOLKIT } from '../toolkit';
import type { ToolId, ToolkitBank } from '../toolkit';
import type { Caveat } from '../caveats';
import { RULES_VERSION } from '../scoring';
import type { AnswerValue } from '../scoring';
import type { ToolResult, ToolRule } from '../types';
import {
  bandFromFeeds,
  baseCaveats,
  dedupe,
  sectionLevelTags,
  severityTags,
  triggeredItemRules,
} from './shared';

/** 這張票的四支。順序照 §3 的登錄表。 */
export const DEV_ADL_LEARNING_TOOL_IDS: ReadonlyArray<ToolId> = ['sxk-dev', 'sxk-adl', 'sxk-ldp', 'sxk-lds'];

/**
 * 獨立率族的逐題觸發：答 ≤ 4（§5.5「大人動手了」）。
 *
 * 七級的分界就在 4／5 之間：5 是「需要口头引导」——「大人不用动手碰他」，
 * 4 是「需要起头或收尾」——「大人帮忙开始或收尾」。錯一級，一個只是需要提醒的孩子
 * 會拿到一串「要練」的標籤。
 */
export const INDEPENDENCE_ITEM_MAX = 4;

const INDEPENDENCE_ITEM_TRIGGER = (value: AnswerValue): boolean =>
  typeof value === 'number' && value <= INDEPENDENCE_ITEM_MAX;

/** §5.6 的 `few_items`：「用來判級的面向適用題數 ≤ 6」。 */
export const FEW_ITEMS_MAX = 6;

/** §5.9 點名的那一個領域：adl 的括約肌控制（膀胱、腸道兩項）。 */
export const ADL_FEW_ITEMS_SECTION = 'SP';

/**
 * adl 的 `few_items`：括約肌控制領域**有被單獨判讀**（`scored`）而題數 ≤ 6 時出。
 *
 * 括約肌領域在窗口內恆為 2 項（兩題的起始月齡都是 30，＝工具窗口的下界），而獨立率族的
 * `minItems` 也是 2 —— 所以現在每一份 adl 都會帶這一條。要求 `scored` 不是多餘的：
 * 題數掉到 2 以下時那個領域根本不單獨判讀，沒有東西需要打折。
 */
function sphincterFewItems(r: ToolResult): Caveat[] {
  const stat = r.sections[ADL_FEW_ITEMS_SECTION];
  if (!stat || !stat.scored || stat.n > FEW_ITEMS_MAX) return [];
  return ['few_items'];
}

/** 四支在對應表之外的差異，一支一列。沒有差異的那三支是空的（不是「忘了寫」）。 */
interface ExtraRules {
  /** 逐題觸發；`undefined` ＝ 這支沒有逐題規則（§5.9 只有 adl 有），規則表不掃逐題。 */
  itemTrigger?: (value: AnswerValue) => boolean;
  /** 跟著面向題數走的 caveat。 */
  caveats?: (r: ToolResult) => Caveat[];
}

const EXTRA_RULES: Readonly<Record<string, ExtraRules>> = {
  'sxk-dev': {},
  'sxk-adl': { itemTrigger: INDEPENDENCE_ITEM_TRIGGER, caveats: sphincterFewItems },
  'sxk-ldp': {},
  'sxk-lds': {},
};

/** ldp／lds 的各方面另有一張 0–18 的分段表，出處是 HTML 的 `domLevel()`，紙本沒有。 */
function sourceOf(bank: ToolkitBank): string {
  const section = bank.sectionTiers ? '＋ domLevel()（各方面 0–18，紙本沒有表）' : '';
  return `${bank.source.file} LEVELS（紙本「分數解讀」）${section}`;
}

function devAdlLearningRule(toolId: ToolId): ToolRule {
  const bank = TOOLKIT[toolId];
  const extra = EXTRA_RULES[toolId];
  if (!extra) throw new Error(`規則表：${toolId} 不在 #50 的四支裡`);

  return {
    toolId,
    rulesVersion: RULES_VERSION,
    // 照 `feeds` 算，沒有例外：dev 五個領域各算各的，adl／ldp／lds 看總分。
    // 不餵的維度（dev 的 SEN、adl 的 MOT、ldp 的 ATT）一律 `null`。
    bandFor: (r, dimension) => bandFromFeeds(r, dimension),
    // 面向級（照題庫面向順序）→ 逐題（只有 adl）→ severe。同一個標籤只出一次：
    // adl 的 SP 兩項與 SC 第 5 項都對 `adl.toileting`、MO 四項都對 `mot.locomotion`；
    // dev 的六個領域 key 在題庫裡出現六次（六個年齡段各一份），`sectionLevelTags` 會
    // 逐個掃到，但每次讀的是 `r.sections` 裡同一筆，去重之後看不出來。
    tags: r => dedupe([
      ...sectionLevelTags(r),
      ...(extra.itemTrigger ? triggeredItemRules(r, extra.itemTrigger).flatMap(rule => rule.tags) : []),
      ...severityTags(r),
    ]),
    // 固定的 → 跟著面向題數走的。
    caveats: r => dedupe([...baseCaveats(r), ...(extra.caveats?.(r) ?? [])]),
    source: sourceOf(bank),
  };
}

/** 四張表，key 是 toolId。 */
export const DEV_ADL_LEARNING_RULES: Readonly<Partial<Record<ToolId, ToolRule>>> = Object.fromEntries(
  DEV_ADL_LEARNING_TOOL_IDS.map(id => [id, devAdlLearningRule(id)]),
);
