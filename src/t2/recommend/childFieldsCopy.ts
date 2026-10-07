/**
 * 孩子資料「补充资料」那一區的字（T2 v3 推薦規格 §2.1；只在專案 A 問）。
 *
 * 【為什麼這一檔不進家長用字掃描】
 * 診斷的六個選項是醫師會講出口的名稱（「自闭症」「脑性瘫痪」「学习障碍」……），本身就是《对照表》的禁字。禁字擋的是
 * **系統把孩子說成有病**；這裡是把醫師說過的名稱列出來讓家長對號，主語是醫師（同 2026-09 的 `diagnosisOptions.ts`）。
 * 改寫成別的說法，家長反而對不上醫師講的字。畫面元件（`ChildExtraFields.tsx`）只 import、不手抄，元件本身照常掃描。
 */

import type { DxCode } from './types';

export const EXTRA_TITLE = '补充资料（选填）';
export const EXTRA_SUB = '帮我们挑出更合适的专项问卷；不确定可以先不填，之后在「编辑档案」里补。';

export const DX_QUESTION = '医生有没有告诉过您孩子的诊断？疑似也算，最多选两个';
export const DX_OPTIONS: ReadonlyArray<{ value: Exclude<DxCode, 'NONE'>; label: string }> = [
  { value: 'ASD', label: '自闭症（孤独症谱系）' },
  { value: 'LANG', label: '语言发展障碍' },
  { value: 'GDD', label: '发展迟缓／智力发展迟缓' },
  { value: 'LDADHD', label: '学习障碍／多动症' },
  { value: 'EMO', label: '情绪障碍／心理障碍' },
  { value: 'CP', label: '脑性瘫痪' },
];
export const DX_NONE = '没有／医生没说过';
export const DX_PURPOSE = '只用来挑选专项问卷，不会出现在给孩子的评语里。';

export const SCHOOL_QUESTION = '目前有上托育班、幼儿园或学校吗？';
export const TIC_QUESTION = '最近有没有反复眨眼、清喉咙、耸肩这类自己停不下来的小动作？';
export const HEARING_QUESTION = '做过听力检查吗？';
export const HEARING_OPTIONS: ReadonlyArray<{ value: boolean | null; label: string }> = [
  { value: true, label: '做过' },
  { value: false, label: '没做过' },
  { value: null, label: '不清楚' },
];
export const GESTATION_QUESTION = '出生时怀孕几周？（早产才需要选）';
export const GESTATION_FULL_TERM = '足月（37 周以上）';
export const YES = '有';
export const NO = '没有';
