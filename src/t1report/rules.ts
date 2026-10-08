/**
 * 新版 T1 報告的用字規則與字數（`report.ts` 的驗證器與 `prompt.ts` 的提示共用同一份，不各抄一次）。
 * 理由見 `report.ts` 檔頭「驗證器擋什麼」。
 */

import { findBannedWords } from '../utils/parentWording';
import {
  DIAGNOSIS_NAMES, INSTRUMENT_AND_TREATMENT_NAMES, REPLACED_SCALE_NAMES,
} from '../t2/report/blacklist';

/** 字數（去空白的碼位數，同 T2 的 `charCount`）與條數。**暫採**：T1 報告沒有規格定字數，取擋得住空字串與整份塞一欄的寬界。 */
export const T1_REPORT_LIMITS = {
  summary: { min: 30, max: 240 },
  note: { min: 20, max: 200 },
  listItem: { min: 10, max: 150 },
  nextSteps: { min: 30, max: 240 },
  rehabCount: { min: 3, max: 4 },
  homeCount: { min: 3, max: 4 },
} as const;

/** 編出來的比較與預測。T1 是客戶自建、對照標準的篩查，沒有常模；報告也沒有依據預言未來。 */
export const FABRICATED_CLAIM_WORDS: ReadonlyArray<string> = [
  '百分位', '百分比', '%', '％', '常模', '排名', '同龄前', '超过了', '预测', '预判', '预计', '回归', '保证', '一定会',
];

/** 腦神經術語。T1 問的是日常做得到什麼，寫腦內部的運作超出它能說的範圍。 */
export const NEURO_JARGON_WORDS: ReadonlyArray<string> = [
  '神经', '突触', '前额叶', '脑区', '脑网络', '环路', '皮层', '皮质', '可塑', '胼胝体', '杏仁核', '小脑', '脑干', '脑波', '脑电',
];

/** 手列的字表（拉丁字母不分大小寫）。《用语对照表》禁字另走 `findBannedWords`。 */
export const T1_REPORT_BLACKLIST: ReadonlyArray<string> = [
  ...REPLACED_SCALE_NAMES,
  ...DIAGNOSIS_NAMES,
  ...INSTRUMENT_AND_TREATMENT_NAMES,
  ...FABRICATED_CLAIM_WORDS,
  ...NEURO_JARGON_WORDS,
];

/** `text` 裡違規的字，附前後文。題目原文先挖掉。 */
export function findT1ReportViolations(text: string, questionTexts: ReadonlyArray<string> = []): string[] {
  let scrubbed = text;
  for (const q of questionTexts) scrubbed = scrubbed.split(q).join('');
  const lower = scrubbed.toLowerCase();
  const hits: string[] = [];
  for (const word of T1_REPORT_BLACKLIST) {
    const needle = word.toLowerCase();
    let from = 0;
    while (true) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      hits.push(`「${word}」 …${scrubbed.slice(Math.max(0, at - 12), at + word.length + 12).replace(/\s+/g, ' ')}…`);
      from = at + needle.length;
    }
  }
  return [...hits, ...findBannedWords(scrubbed)];
}

