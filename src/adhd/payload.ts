/**
 * 成人 ADHD：檢查 bridge 送上來的那一份個案 JSON（客戶頁面的 `casePayload()`），抄出列表要用的三欄。
 *
 * 伺服器**不重算分數**（設計第 3 節、ADR-0021）：分數與結論是客戶頁面算的，原樣存。這裡只擋形狀 ——
 * 題數、值域、結論的代碼 —— 形狀不對就 400、不落表，免得後台列表讀到一份畫不出來的東西。
 *
 * 形狀出自客戶頁面 20261111 版（`ADHD/`）：`{system:'SXK-ADHD-SCREEN', version, basics, flow, raw:{s1,a18,obs,copm}, data:{…, s2}}`。
 * 前後端共用（後台列表也讀 `conclusionOf`）。
 */

export const ADHD_PAYLOAD_SYSTEM = 'SXK-ADHD-SCREEN';

/** 客戶頁面報告結論的代碼（`APP.d.s2.conclusion.status`）。`incomplete` 不存（bridge 不送、伺服器也不收）。 */
export const ADHD_CONCLUSION_STATUSES = ['followup', 'not-triggered', 'life-impact', 'adult-unknown', 'minor'] as const;
export type AdhdConclusionStatus = (typeof ADHD_CONCLUSION_STATUSES)[number];

/** 一份個案 JSON 的上限（實測一份約 6 KB，五件 COPM 都寫滿也不到 20 KB）。 */
export const ADHD_PAYLOAD_MAX_BYTES = 64 * 1024;

export const CLIENT_CASE_ID = /^[A-Za-z0-9-]{8,100}$/;

export interface AdhdPayloadSummary {
  subjectName: string;
  conclusionStatus: AdhdConclusionStatus;
  conclusionTitle: string;
}

export type AdhdPayloadCheck = { ok: true; summary: AdhdPayloadSummary } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 長度恰好 `n`、每格是 `0..max` 的整數或 `null`（客戶頁面未答是 null）。 */
function answerArray(v: unknown, n: number, max: number): boolean {
  return Array.isArray(v) && v.length === n && v.every(x => x === null || (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max));
}

export function checkAdhdPayload(payload: unknown): AdhdPayloadCheck {
  if (!isObj(payload)) return { ok: false, error: 'payload 不是物件' };
  if (JSON.stringify(payload).length > ADHD_PAYLOAD_MAX_BYTES) return { ok: false, error: 'payload 太大' };
  if (payload.system !== ADHD_PAYLOAD_SYSTEM) return { ok: false, error: 'system 不對' };
  if (typeof payload.version !== 'string' || payload.version.length > 20) return { ok: false, error: 'version 不對' };

  const basics = payload.basics;
  if (!isObj(basics)) return { ok: false, error: 'basics 不對' };
  const name = typeof basics.name === 'string' ? basics.name.trim() : '';
  if (!name || name.length > 100) return { ok: false, error: '姓名不對' };

  const raw = payload.raw;
  if (!isObj(raw)) return { ok: false, error: 'raw 不對' };
  if (!answerArray(raw.s1, 6, 4)) return { ok: false, error: 'ADHD筛查的作答不對' };
  if (!answerArray(raw.a18, 18, 4)) return { ok: false, error: 'ADHD量表的作答不對' };
  if (!isObj(raw.obs) || !answerArray(raw.obs.ans, 30, 3)) return { ok: false, error: '症状量表的作答不對' };

  const data = payload.data;
  if (!isObj(data) || !isObj(data.s2) || !isObj(data.s2.conclusion)) return { ok: false, error: '报告结果不對' };
  const { status, title } = data.s2.conclusion;
  if (!(ADHD_CONCLUSION_STATUSES as readonly unknown[]).includes(status)) return { ok: false, error: '报告结论不對' };
  if (typeof title !== 'string' || !title.trim() || title.length > 100) return { ok: false, error: '报告结论不對' };

  return {
    ok: true,
    summary: { subjectName: name, conclusionStatus: status as AdhdConclusionStatus, conclusionTitle: title.trim() },
  };
}
