/**
 * 診斷方向（規格 v2 §4.3）：家長在 T2 入口選填的十選一，加「未告知」。
 *
 * 【問法】
 * 「醫師是否已告知診斷方向」—— 問的是**醫師說了什麼**，不是「你覺得孩子有什麼問題」。
 * 十個選項是醫師會講出口的診斷名，家長只是從裡面挑出醫師講過的那一個。
 *
 * 【為什麼這一檔不進家長用字掃描】
 * 十個標籤本身就是《對照表》的禁字（「脑瘫」「自闭症」「智力障碍」……）。禁字擋的是
 * **系統把孩子說成有病**；這裡是把醫師已經說出口的名稱列出來讓家長對號，主語是醫師，
 * 不是系統，也不是孩子。改寫成「社交發展方向」之類的說法，家長反而對不上醫師講的字。
 * 所以標籤集中在這一檔，`test/parentWording.structure.test.ts` 明寫它不列入掃描；
 * 畫面元件（`T2Entrance.tsx`）只 import、不手抄 —— `test/t2EntranceCopy.structure.test.ts`
 * 釘住這一點，讓「順手在元件裡寫一個『自闭症』」變成一條紅的測試。
 *
 * 【沒填不是缺漏】
 * §4.3：沒填不得阻擋流程，畫面與報告都不得出現「未提供診斷資訊」這種像缺漏的字樣。
 * 「未告知」是一個正常的答案 —— 多數家長的醫師沒有給過方向。
 */

import type { DiagnosisDirection } from './types';

export interface DiagnosisOption {
  value: DiagnosisDirection;
  /** 醫師會講出口的名稱（簡體，與中控台 `DIS` 的十個一致）。 */
  label: string;
}

/** 十選一，順序照規格 §4.3 與附錄 B.2。 */
export const DIAGNOSIS_OPTIONS: ReadonlyArray<DiagnosisOption> = [
  { value: 'cp', label: '脑瘫' },
  { value: 'dd', label: '发展迟缓' },
  { value: 'id', label: '智力障碍' },
  { value: 'ld', label: '学习障碍' },
  { value: 'adhd', label: '多动症' },
  { value: 'lang', label: '语言障碍' },
  { value: 'emo', label: '情绪障碍' },
  { value: 'psych', label: '心理疾病' },
  { value: 'tic', label: '抽动症' },
  { value: 'asd', label: '自闭症' },
];

/** 畫面上的問句（§4.3 原話）。 */
export const DIAGNOSIS_QUESTION = '医生是否已告知诊断方向';

/** 第十一個選項：沒有醫師給過方向。是正常答案，不是「未提供」。 */
export const NO_DIAGNOSIS_LABEL = '未告知';

const VALUES: ReadonlySet<string> = new Set(DIAGNOSIS_OPTIONS.map(o => o.value));

/** 只認十個代號；中文標籤、空字串、`null` 都不是。 */
export function isDiagnosisDirection(x: unknown): x is DiagnosisDirection {
  return typeof x === 'string' && VALUES.has(x);
}

/**
 * 讀 API 進來的診斷方向。
 *
 * 沒帶、`null`、空字串（中控台「未定」那個選項的值）三者都是「沒填」→ `null`，
 * 與 `planT2`／`buildT2Findings` 的讀法一致。十個代號照收。**其餘是錯**，回 `ok: false`
 * 讓呼叫端回 400 —— 不能安靜地當成沒填：家長選了自閉症、前端送錯了字，題量會安靜地
 * 少掉六支，而畫面上看不出來。
 */
export function readDiagnosisDirection(
  raw: unknown,
): { ok: true; value: DiagnosisDirection | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  return isDiagnosisDirection(raw) ? { ok: true, value: raw } : { ok: false };
}
