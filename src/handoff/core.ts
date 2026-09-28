/**
 * B→A 交接（ADR-0009、docs/specs/b-to-a-handoff.md）的純函式：產碼、雜湊、設定、兩端之間那一包資料的形狀。
 * 伺服器專用（用到 node 的 crypto），前端不 import。
 *
 * 名詞：發出端＝專案 B（產生交接碼、兌換時交出資料）；接收端＝專案 A（拿碼換資料、發 A 的登入狀態）。
 */
import crypto from 'crypto';
import type { AssessmentRecord, DimensionScore } from '../types';
import { latestT1ReportFor } from '../utils/reportResume';

export type HandoffKind = 'button' | 'sms';
export const HANDOFF_KINDS: ReadonlyArray<HandoffKind> = ['button', 'sms'];

/** 時效（秒）：按鈕是家長正在看、按下就走，2 分鐘；簡訊是事後觸達，72 小時（第二期）。 */
export const HANDOFF_TTL_SEC: Readonly<Record<HandoffKind, number>> = { button: 120, sms: 72 * 3600 };

/** 家長按下時看到的同意文字版本。改了同意文字就改這個（或設 HANDOFF_CONSENT_VERSION）。 */
export const DEFAULT_CONSENT_VERSION = '2026-09-28';

// ── 交接碼 ────────────────────────────────────────────────────────

/** 32 位元組亂數，base64url 43 字。回傳明碼（只給家長的瀏覽器）與雜湊（只進資料庫）。 */
export function generateHandoffCode(): { code: string; hash: string } {
  const code = crypto.randomBytes(32).toString('base64url');
  return { code, hash: hashHandoffCode(code) };
}

/**
 * 交接碼的 SHA-256（hex）。不用 bcrypt：碼本身是 256 位元亂數，猜不到，也就不需要慢雜湊；
 * 而兌換時要**用雜湊去查那一列**，bcrypt 的鹽讓它查不了。
 */
export function hashHandoffCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function isHandoffCodeShape(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** 內部端點的密鑰比對：常數時間，長度不同也不提早回（先各自雜湊再比）。 */
export function secretMatches(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** 「138****8000」。第二期的簡訊確認頁用：看得出是不是自己，又不把整支號碼亮給拿到轉發連結的人。 */
export function maskPhone(phone: string): string {
  return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(7)}` : '****';
}

// ── 設定 ──────────────────────────────────────────────────────────

export interface HandoffSourceConfig {
  secret: string;
  /** A 的對外網址（`https://sxkscreen.com`）：交接連結指去那裡。 */
  targetOrigin: string;
  consentVersion: string;
}

export interface HandoffTargetConfig {
  secret: string;
  /** B 的內部網址（`http://127.0.0.1:5001`）：A 從這裡兌換，不經公網。 */
  sourceOrigin: string;
}

const MIN_SECRET_LENGTH = 32;

function readSecret(raw: string | undefined): string | null {
  const secret = raw?.trim();
  if (!secret) return null;
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`HANDOFF_SECRET 至少 ${MIN_SECRET_LENGTH} 个字元（它是 A、B 之间唯一的一道锁）。`);
  }
  return secret;
}

/** 只收「協定＋主機（＋埠）」；`allowHttp` 時本機與內網位址可以是 http。 */
function readOrigin(name: string, raw: string | undefined, allowHttpLocal: boolean): string {
  const value = raw?.trim();
  if (!value) throw new Error(`设了 HANDOFF_SECRET 就要设 ${name}（交接功能缺一半等于没开，而画面上会看到一颗按不动的按钮）。`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} 不是一个网址：${JSON.stringify(value)}`);
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(allowHttpLocal && url.protocol === 'http:' && local)) {
    throw new Error(`${name} 必须是 https://${allowHttpLocal ? '（本机的 http://127.0.0.1 也可以）' : ''}：${JSON.stringify(value)}`);
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error(`${name} 只写协定与主机：${JSON.stringify(value)}`);
  }
  return url.origin;
}

/** 發出端（B）。沒設密鑰＝功能關閉（`null`）；設了一半或設錯就丟錯讓程序起不來。 */
export function resolveHandoffSourceConfig(env: NodeJS.ProcessEnv): HandoffSourceConfig | null {
  const secret = readSecret(env.HANDOFF_SECRET);
  if (!secret) return null;
  return {
    secret,
    targetOrigin: readOrigin('HANDOFF_TARGET_ORIGIN', env.HANDOFF_TARGET_ORIGIN, true),
    consentVersion: env.HANDOFF_CONSENT_VERSION?.trim() || DEFAULT_CONSENT_VERSION,
  };
}

/** 接收端（A）。同上。 */
export function resolveHandoffTargetConfig(env: NodeJS.ProcessEnv): HandoffTargetConfig | null {
  const secret = readSecret(env.HANDOFF_SECRET);
  if (!secret) return null;
  return { secret, sourceOrigin: readOrigin('HANDOFF_SOURCE_ORIGIN', env.HANDOFF_SOURCE_ORIGIN, true) };
}

/** 交接連結：碼放在網址片段，不送到伺服器、不進 nginx 日誌、不隨 Referer 外流。 */
export function handoffUrl(targetOrigin: string, code: string): string {
  return `${targetOrigin}/handoff#code=${code}`;
}

// ── 兩端之間那一包 ────────────────────────────────────────────────

export interface HandoffSource {
  companyId: number;
  slug: string;
  name: string;
}

/** 發出端兌換成功時交出的資料（規格 §1：只有這些）。 */
export interface HandoffPayload {
  phone: string;
  sourceUserId: number;
  /** 家長的歸屬；未歸屬（森心康直屬、沒帶進站識別碼）是 `null`。 */
  source: HandoffSource | null;
  child: Record<string, unknown>;
  completedScores: DimensionScore[];
  /** 與這組成績相符的最新一份 T1 報告；沒有就是 `null`（A 那邊家長會看到「一键生成」）。 */
  t1Report: AssessmentRecord | null;
  kind: HandoffKind;
  consentVersion: string | null;
}

/** 發出端組那一包：成績只收 T1，報告只收對得上這組成績的那一份。 */
export function buildHandoffPayload(input: {
  phone: string;
  sourceUserId: number;
  source: HandoffSource | null;
  child: Record<string, unknown>;
  completedScores: DimensionScore[];
  reportHistory: AssessmentRecord[];
  kind: HandoffKind;
  consentVersion: string | null;
}): HandoffPayload {
  const t1Scores = input.completedScores.filter(s => s.tierId === 'T1');
  return {
    phone: input.phone,
    sourceUserId: input.sourceUserId,
    source: input.source,
    child: input.child,
    completedScores: t1Scores,
    t1Report: latestT1ReportFor(input.reportHistory, t1Scores),
    kind: input.kind,
    consentVersion: input.consentVersion,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * 接收端讀發出端的回應。形狀不對就是 `null`（當成兌換失敗）—— 那一包是要寫進 A 的家長資料的，
 * 不照單全收。
 */
export function readHandoffPayload(body: unknown): HandoffPayload | null {
  if (!isObject(body)) return null;
  const { phone, sourceUserId, source, child, completedScores, t1Report, kind, consentVersion } = body;
  if (typeof phone !== 'string' || !/^1\d{10}$/.test(phone)) return null;
  if (typeof sourceUserId !== 'number' || !Number.isSafeInteger(sourceUserId) || sourceUserId <= 0) return null;
  if (source !== null) {
    if (!isObject(source) || typeof source.companyId !== 'number' || typeof source.slug !== 'string' || typeof source.name !== 'string') {
      return null;
    }
  }
  if (!isObject(child)) return null;
  if (!Array.isArray(completedScores) || completedScores.length === 0 || !completedScores.every(isObject)) return null;
  if (t1Report !== null && !isObject(t1Report)) return null;
  if (!HANDOFF_KINDS.includes(kind as HandoffKind)) return null;
  if (consentVersion !== null && typeof consentVersion !== 'string') return null;
  return body as unknown as HandoffPayload;
}
