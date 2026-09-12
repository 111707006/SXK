/**
 * 報告文字的黑名單（規格 v2 §6.2、§6.4，#55）。
 *
 * 【這一檔是什麼】
 * 一份「出現就整份丟」的字表，加一個掃描函式。AI 回來的 JSON 與模板產出的段落走**同一個**
 * 掃描 —— 模板是退路，退路寫出禁字跟 AI 寫出禁字一樣糟，而且模板是我們自己寫的，更沒有理由
 * 例外。
 *
 * 【五類，各自的出處】
 * 1. **《對照表》禁字**：整份吃 `src/utils/parentWording.ts`（客戶 2026-09-11《家长报告用语
 *    对照表》三級全列）。那一檔的 `ALLOWED_PHRASES` 例外也一起生效 —— 「网络连接异常」的
 *    「异常」說的是連線，不是孩子。
 * 2. **被替換掉的量表名**：v1 的 23 份量表 2026-09-08 換成森心康自建工具包，那些商品名一個都
 *    不能再出現（§6.2 的清單原樣）。不是版權問題而已：報告寫「丹佛量表顯示……」時，這份報告
 *    根本沒有跑過丹佛。
 * 3. **診斷名**：T2 是篩查，不是診斷（§0）。`DiagnosisDirection` 的十個方向是**家長自己選的
 *    就診方向**，可以拿來排順序，不能寫進報告當結論。
 * 4. **儀器、療程、藥物**：§6.2「不可以提任何儀器、療程、藥物」。家長讀到「建議做腦電圖」會
 *    直接去掛號，而這份報告沒有任何依據說得出那句話。
 * 5. **tier 的內部名稱**：從 `TOOLKIT` 的 `tiers`／`sectionTiers` **算出來**，不手抄
 *    （`TIER_NAMES`）。手抄的話，工具包下次改版多一個分段名，黑名單不會知道。
 *
 * 【四支公開工具的官方名稱是可以寫的】
 * §6.2 明寫可以用 M-CHAT-R/F、SNAP-IV、CHEXI、預警徵象篩查表 —— 它們是原文照錄的工具，
 * 名字就是它的名字。掃描前先把這四個名字挖掉（`PUBLIC_TOOL_NAMES`），免得哪天有人往黑名單
 * 加一個字剛好是某個官方名的一部分，整批報告開始被退。
 *
 * 【為什麼 tier 內部名稱連「輕微」「中等」這種單字都擋】
 * 它們是工具包分段表的鍵，是**內部刻度**。報告一寫「落在輕微的那一段」，家長就會去問
 * 「輕微是第幾級、後面還有幾級」—— 而那把尺我們不打算給家長看（§5.3 的分段是客戶自承的
 * 參考帶，`unsourced_threshold`）。代價是模板與 AI 都不能用這幾個形容詞，改寫成「值得多留意」
 * 這類說法；這是刻意的。
 */

import { TOOLKIT, TOOL_IDS } from '../toolkit';
import { findBannedWords } from '../../utils/parentWording';

/**
 * 被替換掉的量表名（§6.2 原樣，加簡繁兩寫）。
 * `ASQ` 特別要擋：自建工具裡有一支 `sxk-asq`，它的代號寫出來就會帶著這三個字母。
 */
export const REPLACED_SCALE_NAMES: ReadonlyArray<string> = [
  'ASQ', '丹佛', 'Denver', 'CARS', 'ABC', 'Conners', 'SPM', 'PedsQL', 'WeeFIM', 'FIM',
  '儿心量表', '兒心量表', 'TTQ', 'TTS', 'MCTQ', 'BSQ', 'CDI',
];

/**
 * 診斷名。`DiagnosisDirection` 的十個方向全在裡面（有幾個已經被《對照表》擋掉，重複列著不礙事
 * —— 這一份要能單獨讀懂「哪十個方向不能寫」）。
 */
export const DIAGNOSIS_NAMES: ReadonlyArray<string> = [
  '脑瘫', '腦麻', '发育迟缓', '智力障碍', '学习障碍', '多动症', '语言障碍', '情绪障碍',
  '心理疾病', '抽动症', '自闭症', '自閉症', '阿斯伯格', '亚斯伯格', '感统失调',
  'ADHD', 'ASD', 'DSM', 'ICD-10', 'ICD-11',
];

/** 儀器、療程、藥物（§6.2）。 */
export const INSTRUMENT_AND_TREATMENT_NAMES: ReadonlyArray<string> = [
  // `CT` 不單獨列：兩個字母會打到任何含 `ct` 的英文字（活動名稱、AI 偶爾夾一個英文詞），
  // 所以列的是它真正會出現的樣子。
  '核磁', '磁共振', 'MRI', 'CT检查', 'CT 检查', '脑电', '脑电图', 'EEG', '诱发电位', '基因检测', '抽血',
  '药物', '用药', '服药', '哌甲酯', '利他林', '专注达', '托莫西汀',
  '疗程', '针灸', '高压氧', '经颅磁', 'rTMS', '生物反馈', '感统训练课',
];

function tierKeys(): string[] {
  const keys = new Set<string>();
  for (const id of TOOL_IDS) {
    const bank = TOOLKIT[id];
    for (const t of [...bank.tiers, ...(bank.sectionTiers ?? [])]) keys.add(t.key);
  }
  return [...keys].sort();
}

/**
 * 工具包分段表的鍵，22 支聯集去重（`tiers` ＋ `sectionTiers`）。
 * 算出來的，不手抄 —— 工具包改版多一個分段名時，黑名單自動跟上。
 */
export const TIER_NAMES: ReadonlyArray<string> = tierKeys();

/**
 * 可以寫的四個官方名稱（§6.2）。前三個對 `TOOLKIT` 的 `code`（`t2ReportProse.test.ts` 盯著），
 * `sxk-warn` 的中文名只在規格 §3 的表裡，工具包沒有，所以這一個是抄的。
 */
export const PUBLIC_TOOL_NAMES: ReadonlyArray<string> = [
  TOOLKIT['mchat-rf'].code,
  TOOLKIT['snap-iv'].code,
  TOOLKIT.chexi.code,
  '预警征象筛查表',
];

/** 黑名單本體：四類手列的加上算出來的 tier 名稱。《對照表》禁字走 `findBannedWords`，不在這裡。 */
export const BLACKLIST: ReadonlyArray<string> = [
  ...REPLACED_SCALE_NAMES,
  ...DIAGNOSIS_NAMES,
  ...INSTRUMENT_AND_TREATMENT_NAMES,
  ...TIER_NAMES,
];

function contextAround(text: string, at: number, length: number): string {
  return text.slice(Math.max(0, at - 12), at + length + 12).replace(/\s+/g, ' ');
}

/**
 * `text` 裡出現的每一個黑名單詞，附前後文（與 `findBannedWords` 同一個形狀，方便合併印出來）。
 *
 * 拉丁字母不分大小寫（`pedsql` 與 `PedsQL` 是同一個東西）；中文沒有大小寫，同一套處理不影響它。
 * 四個官方名稱先挖掉再掃。
 */
export function findBlacklisted(text: string): string[] {
  let scrubbed = text;
  for (const name of PUBLIC_TOOL_NAMES) scrubbed = scrubbed.split(name).join('');

  const hits: string[] = [];
  const lower = scrubbed.toLowerCase();
  for (const word of BLACKLIST) {
    const needle = word.toLowerCase();
    let from = 0;
    while (true) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      hits.push(`「${word}」 …${contextAround(scrubbed, at, word.length)}…`);
      from = at + needle.length;
    }
  }
  return [...hits, ...findBannedWords(scrubbed)];
}
