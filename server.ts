import express from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
// tcb import removed - replaced with MySQL
import * as mysqlDb from './src/db/mysql';
import { createAdminRouter } from './src/admin/routes';
import { notifyExpertBooking } from './src/notify';
import { sendVerificationCode } from './src/sms';
import { generateOutTradeNo, isValidOutTradeNo } from './src/utils/outTradeNo';
import {
  generateReportLinkToken,
  isValidReportLinkToken,
  reportLinkPath,
  resolveReportLinkBase,
} from './src/utils/reportLink';
import { renderParentExportHtml } from './src/admin/exportView';
import { readServiceType } from './src/utils/serviceTypes';
import { isValidCompanySlug } from './src/utils/companySlug';
import { ageBandOf, latestAssessedAgeMonth } from './src/utils/ageBandDrift';
import { calculateAgeMonth } from './src/utils/dateUtils';
import { planT2 } from './src/t2/routing';
import { entranceState, t1FlagsFromScores } from './src/t2/entrance';
import { readDiagnosisDirection } from './src/t2/diagnosisOptions';
import { scoreTool } from './src/t2/scoring';
import { buildT2Findings, latestCompleteResults } from './src/t2/findings';
import { readToolSubmission, refusalToHttp, toolBands } from './src/t2/toolResults';
import { ageKeyOf, matchWeeklyActivities } from './src/t2/activityMatch';
import type { WeeklyActivities } from './src/t2/activityMatch';
import { isCalendarDate, weekEndOf, weekStartOf } from './src/t2/weeks';
import { buildSmartGoals } from './src/t2/goals';
import { generateProse } from './src/t2/report';
import type { T2ReportInput } from './src/t2/report';
import * as t2Store from './src/db/t2ToolResults';
import * as t2FindingsStore from './src/db/t2Findings';
import * as t2WeeklyStore from './src/db/t2WeeklyPlans';
import { listActivityLibrary } from './src/db/t2Activities';
import type { ChildSnapshot, ToolResultRecord } from './src/db/t2ToolResults';
import type { FindingsRecord } from './src/db/t2Findings';
import type { WeeklyPlanRecord } from './src/db/t2WeeklyPlans';
import type { Activity, DiagnosisDirection, DimensionCode } from './src/t2/types';
import qrcode from 'qrcode-generator';
import * as wechatPay from './src/wechatPay';
import { DIMENSIONS_DATA } from './src/data';
import type { UnlockScope } from './src/types';
import { REHAB_SUGGESTIONS } from './src/dimensionContent';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

dotenv.config();

const app = express();
const PORT = Number(process.env.DEPLOY_RUN_PORT || process.env.PORT) || 5000;

// ── Product mode (backend counterpart of src/productConfig.ts) ──
// Both must be set on a deployment; they control different halves:
//   VITE_APP_MODE  — build time, decides what the bundle renders
//   APP_MODE       — run time, decides which routes this process registers
//
// Deliberately fail-closed, mirroring resolveMode() in productConfig.ts: an
// unrecognised value kills the process instead of quietly falling back to
// 'full'. A typo that fell back would leave the tier-2/3 endpoints serving on
// the box handed to the partner company, with nothing to signal it.
type AppMode = 'full' | 't1only';

function resolveAppMode(raw: string | undefined): AppMode {
  if (raw === undefined || raw === '') return 'full';
  if (raw === 'full' || raw === 't1only') return raw;
  throw new Error(
    `APP_MODE is not recognised: ${JSON.stringify(raw)}. Only 'full' (project A) or 't1only' (project B) are accepted.`
  );
}

const APP_MODE = resolveAppMode(process.env.APP_MODE);

/**
 * ICP 備案號 —— 給**伺服器自己吐出的那幾頁 HTML** 用的（家長掃碼帶走的報告頁、
 * 連結失效頁）。前端頁面走的是另一條路（`VITE_ICP_BEIAN`，建置期常數，
 * 見 `src/components/BeianFooter.tsx`）。
 *
 * 【為什麼是兩個變數，不是一個】
 * 這個專案**在本機建置、把產物 scp 上伺服器**（見 `deploy/README.md` 第五節）。
 * `VITE_ICP_BEIAN` 在本機 `pnpm run build` 那一刻就被寫死進前端產物，而這裡
 * 讀的是伺服器 `.env` 在**執行期**的值 —— 兩者物理上在不同機器上，共用不了。
 *
 * 所以上線時兩處都要設，值一樣：
 *   本機建置：VITE_ICP_BEIAN="沪ICP备2026009790号-3" pnpm run build
 *   伺服器 .env：ICP_BEIAN="沪ICP备2026009790号-3"
 *
 * 未設定時那幾頁不渲染備案號（與 BeianFooter 同一個約定：寧可沒有，不掛假的）。
 */
const ICP_BEIAN = process.env.ICP_BEIAN?.trim() || undefined;

// ── Demo switch: paywall on screen, no gate behind it ──
//
// For live demos of project A. The parent-facing paywall still renders (it is
// part of what gets demonstrated), but the tier-2/3 endpoints stop checking for
// an unlock and /api/unlocks reports `available: false`, which is the signal the
// frontend already uses for a skippable demo paywall (see src/utils/access.ts).
//
// This exists as its own flag rather than "just unset MYSQL_*" because the
// database also holds accounts, expert bookings and admin data — dropping it to
// open the paywall would take those down as collateral.
//
// ⚠️ While this is on, anyone who reaches the deployment gets the paid reports
// for free. It is fail-closed by default and by typo: unset, empty or '0'/'false'
// means enforced, and an unrecognised value refuses to boot rather than leaving
// the operator guessing which way it landed.
function resolveDemoOpen(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  throw new Error(
    `PAYWALL_DEMO_OPEN is not recognised: ${JSON.stringify(raw)}. Only '1'/'true' (paywall NOT enforced) or '0'/'false' (enforced) are accepted.`
  );
}

const PAYWALL_DEMO_OPEN = resolveDemoOpen(process.env.PAYWALL_DEMO_OPEN);

// The tier-2/3 AI endpoints exist only in project A. Project B registers them
// on a Router that is never mounted, so the paths genuinely do not exist and
// requests fall through to 404. That is stronger than registering a handler
// and rejecting inside it: there is no handler left to bypass, and a 404
// doesn't confirm the endpoint exists the way a 403 would.
const tier2Only = APP_MODE === 'full' ? app : express.Router();

// Same trick for the paid routes. Kept separate from tier2Only even though both
// currently resolve identically: "has deep assessment" and "charges for it" are
// two different product facts, and a pilot build with free T2/T3 would need them
// to diverge. One concept, one gate — same rule as productConfig's feature flags.
const paidOnly = APP_MODE === 'full' ? app : express.Router();

// ── Admin centre shape (backend counterpart of PRODUCT.adminCenter) ──
// Project B is delivered to several partner companies; project A has none, so
// every one of its parents is unassigned — which is exactly what "森心康直屬"
// means. The admin router uses this to decide two things: whether the company
// condition is fixed to `unassigned`, and whether the company-management routes
// are registered at all.
//
// It lives here rather than being read from src/productConfig.ts because that
// module reads `import.meta.env`, which only exists in the browser build.
const ADMIN_MULTI_COMPANY = APP_MODE === 't1only';

// Per-company branding is a project-B-only idea, so the endpoint that serves it
// only exists there — same never-mounted-Router trick as tier2Only above.
//
// Project A has no partner companies at all, so asking would be a request every
// visitor pays for and that can only ever come back empty. Worse, it would come
// back 404 and paint a red line in every parent's console, which reads as broken.
const multiCompanyOnly = APP_MODE === 't1only' ? app : express.Router();

// ── Branding (backend counterpart of PRODUCT.brand) ──
// Project B ships to a partner company and must not say "森心康" anywhere the
// parent can see. The AI prompts are the easy ones to miss: they are not on any
// screen, but the model is told to write in the brand's voice, so the generated
// report says it for us.
const BRAND_NAME = APP_MODE === 'full' ? '“森心康”' : '本系统';

// Project B has no mall, so telling the model to weave the wearables into its
// advice would advertise hardware the parent cannot buy — from a product that
// isn't even ours to advertise on.
const WEARABLES_PROMPT_CLAUSE = APP_MODE === 'full'
  ? '建议中可提倡将森心康智能穿戴硬件（脑电反馈带、精细OT手套、步态腰带等）编织到日常游戏中辅疗增效。'
  : '请聚焦于家庭日常可执行的互动与游戏，不要推荐任何需要购买的硬件或产品。';

// The parent reads the generated text verbatim, so the model has to follow the
// same wording rules as the screens do (客戶 2026-09-11《家长报告用语对照表》,
// docs/reference/client-mockups/家长报告用语对照表-2026-09-11.md; the screen-side
// half lives in src/utils/statusWording.ts). Without this clause the model, told
// it is a "首席临床医学主任医生", reliably writes 诊断 / 迟缓 / 障碍 / 风险 —
// exactly the words the table bans. Appended to every report prompt.
const PARENT_WORDING_CLAUSE = `用词规范（家长会直接阅读本报告，请严格遵守）：
- 本报告是发展筛查，不是诊断。不要写「诊断」「确诊」，不要点任何病名（如自闭症、脑瘫、多动症、智力障碍），不要写「阳性」。
- 不使用「障碍、疾病、症状、异常、不正常、缺陷、缺损、迟缓、发育迟缓、落后、滞后、失调、严重、重度、中度、轻度、不足、缺乏、困难、低于标准、未通过、不合格、偏低」这类判定性字眼。
- 不使用「风险、高风险、警告、危险、必须、一定要、立即、马上、尽快、否则会、将会导致、恶化、退化、错过黄金期」这类制造紧迫感的字眼。
- 不使用「治疗、矫正、转介、转诊、介入、患儿」；改用「训练、练习、支持、协助、孩子」。
- 描述现况请用「仍在建立中」「需要更多时间」「与同龄常见的发展节奏有差距」「目前需要较多支持」；给建议请用「建议进一步了解」「建议近期安排专业咨询」「可在日常中练习」。
- 一句话结论的句型是「（能力方面）＋（中性描述）＋（行动建议）」，不要以「孩子有……」作为判定句。
- 结果稳定时也要说清楚：「各方面发展稳定，可作为日后对照的基线记录。」`;

/** ¥19.9 per dimension, in 分 — WeChat Pay's amount.total is an integer in 分. */
const UNLOCK_PRICE_FEN = Number(process.env.UNLOCK_PRICE_FEN) || 1990;

// WeChat Pay credentials. Absent until the merchant id and ICP filing exist, so
// every payment path must behave sanely without them — see /api/payment/create,
// which reports `wechatReady: false` rather than pretending.
const wechatPayStatus = wechatPay.loadConfig();

/**
 * H5 or JSAPI. They are mutually exclusive environments, not a hierarchy:
 * JSAPI only works inside WeChat's browser (needs an openid from the OAuth
 * flow), H5 only works outside it. Covering both means shipping both.
 *
 * H5 is what's implemented. The JSAPI seam is real — same signing, callback,
 * query and idempotency code, different path and body — but the openid step
 * is missing, so asking for it fails loudly instead of silently ordering
 * something WeChat will reject.
 */
const PAY_TRADE_TYPE = (process.env.PAY_TRADE_TYPE || 'h5') as wechatPay.TradeType;

// Security headers (X-Content-Type-Options, frameguard, HSTS, etc.).
// CSP is disabled so the Vite-built SPA's inline styles/scripts still load;
// TLS is terminated by nginx (see deploy/nginx.conf).
app.use(helmet({ contentSecurityPolicy: false }));

// Raised limit so base64-encoded audio clips (<=10MB) can reach the ASR endpoint.
//
// `verify` keeps the untouched bytes around: WeChat Pay's callback signature
// covers the raw body, and JSON.parse → JSON.stringify does not round-trip
// byte-for-byte (key order, spacing, unicode escapes). Capturing it here beats
// mounting a separate express.raw() before this line — by the time a route-level
// parser runs, this one has already drained the stream.
app.use(express.json({
  limit: '15mb',
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));

// ── Rate limiting (per-IP) to stop automated abuse burning DashScope quota ──
// Behind nginx (see deploy/nginx.conf) we must trust the first proxy hop so the
// limiter keys on the real client IP (X-Forwarded-For), not nginx's address.
app.set('trust proxy', 1);

const jsonTooMany = (req: express.Request, res: express.Response) =>
  res.status(429).json({ error: '请求过于频繁，请稍后再试。' });

/**
 * 讀一個非負整數的環境變數。
 *
 * 不用 `Number(process.env.X) || fallback` 的理由是**它會吃掉 0**：把某個上限
 * 調成 0 是「現在就停止」這個最急的操作，而那個寫法會安靜地還你預設值 ——
 * 唯一的症狀是「我明明調過了」而它照送。打錯字同理：`RATE_AUTH_MAX="3O"`
 * 退回預設而不留任何痕跡，等於那次調整從來沒發生過。
 *
 * 刻意**沒有**套用在 `PORT`（0 不是一個埠號）與 `UNLOCK_PRICE_FEN`
 * （0 元解鎖是真的會把付費內容送出去，那個值該被擋下而不是被接受）。
 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.warn(`[Env] ${name}="${raw}" 不是非负整数，改用预设值 ${fallback}。`);
    return fallback;
  }
  return parsed;
}

// Generous defaults (tunable via env) so a full CPMV assessment (dozens of AI
// calls) never trips the limit, while a runaway loop hits it within seconds.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: readIntEnv('RATE_API_MAX', 800),
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: readIntEnv('RATE_AI_MAX', 200),
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: readIntEnv('RATE_AUTH_MAX', 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});

// Booking notifies real staff, so it gets a much tighter budget than the rest
// of /api. Generous enough for a clinic or school behind one NAT address, tight
// enough that a loop cannot bury the team in messages.
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: readIntEnv('RATE_BOOKING_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonTooMany,
});

app.use('/api', apiLimiter);
// 掃碼報告是 /api 之外唯一的公開路徑（issue #22）。token 猜不到，所以這不是
// 防暴力破解 —— 是防一支迴圈把一條打得到資料庫的公開路徑當成免費的壓力測試。
app.use('/r', apiLimiter);
app.use('/api/expert-booking', bookingLimiter);
// 後台登入與家長端登入是兩個不同的表面，但被爆破的方式一樣，套同一個預算。
app.use('/api/admin/login', authLimiter);
app.use(['/api/report', '/api/specialized-report', '/api/motion-eval',
  '/api/motion-report', '/api/ali-language-eval', '/api/asr'], aiLimiter);
app.use(['/api/auth/sms/request', '/api/auth/sms/verify'], authLimiter);

// ── Auth: password hashing (bcrypt) + stateless HMAC session tokens ──
const BCRYPT_ROUNDS = 10;

// Signing secret for session tokens. Set SESSION_SECRET in production so tokens
// survive restarts; otherwise a random per-boot secret is used (tokens reset on restart).
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[Auth] SESSION_SECRET not set — using a random per-boot secret. Set SESSION_SECRET in production to keep sessions valid across restarts.');
}
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 一位家長的識別鍵 —— **通行證裡裝的、資料層唯一認得的那個值**。
 *
 * `users.id` 的十進位字串。#27 之後只有這一種來源 —— 登入只剩手機號，而那條
 * 路徑寫不進資料庫就明確失敗，不會發出一張指向記憶體帳號的通行證。
 *
 * 電子郵件註冊那條路曾經發過 `mem:N` 形狀的識別鍵（資料庫寫入失敗時退回記憶
 * 體），舊的通行證因此可能還在某些瀏覽器裡。`toDbUserId` 的非數字防線留著，
 * 就是為了那些 token：拿 `mem:3` 去 `WHERE id = 3` 會讀到別人的孩子檔案。
 *
 * 對外不做任何承諾：它是不透明的字串，客戶端只負責原封不動送回來。
 */
type UserId = string;

function signToken(userId: UserId): string {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the token's user id if the signature is valid and unexpired, else null.
function verifyToken(token: string | null | undefined): UserId | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (typeof data.uid !== 'string' || !data.uid) return null;
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data.uid as UserId;
  } catch {
    return null;
  }
}

function getBearerToken(req: express.Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** 這次請求的家長是誰。沒帶通行證或通行證無效一律 `null`。 */
function currentUserId(req: express.Request): UserId | null {
  return verifyToken(getBearerToken(req));
}

/**
 * 把識別鍵換成資料庫的 `users.id`。記憶體模式的帳號回 `null` ——
 * 它在資料庫裡根本不存在，拿 `mem:3` 去 `WHERE id = 3` 會讀到別人的資料。
 */
function toDbUserId(userId: UserId | null): number | null {
  if (!userId || !/^\d+$/.test(userId)) return null;
  const id = Number(userId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * 通行證上的識別鍵換回帳號本身。帳號已被刪除、或那是一個記憶體模式的識別鍵
 * （資料庫模式下不成立）時回 `null` —— 呼叫端一律當作「登入狀態已失效」。
 *
 * 簽章有效不等於帳號還在，這一步是那個差別。
 */
async function findSessionUser(userId: UserId | null): Promise<any | null> {
  const id = toDbUserId(userId);
  if (id === null) return null;
  return mysqlDb.findUserById(id);
}

/**
 * 雜湊一個一次性的秘密。#27 之後只剩**驗證碼**這一個呼叫端 —— 密碼登入已經
 * 下線，這個系統不再收任何一組密碼，函式名字也就不再提到密碼。
 *
 * 一併消失的是舊的 `verifyPassword`：它對非 bcrypt 的儲存值會退回
 * `明文 === 明文`，而那條退路在驗證碼上是一個洞（`sms_codes` 裡若因故存進明碼，
 * 明碼會直接比對成功，唯一的症狀是「登入正常」）。核對驗證碼因此直接用
 * `bcrypt.compare`，沒有任何一條非雜湊的旁路。
 */
async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// ── 手機號驗證碼登入（#25）──
//
// 純驗證碼登入沒有獨立的「註冊」動作：第一次驗證成功即建立帳號，歸屬在那一刻
// 寫入，此後不變。家長端因此只需要兩個動作 —— 索取、核對。

/** 中國大陸手機號。專家預約與登入是同一組規則，只寫一份。 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

/**
 * 驗證碼有效期。短到被側錄也來不及用，長到來得及切出去看簡訊再切回來。
 *
 * 單位是**秒**，因為到期時刻是交給資料庫算的（`createSmsCode` 的
 * `DATE_ADD(NOW(), INTERVAL ? SECOND)`）—— 這一整張表只有一個時鐘。
 */
const SMS_CODE_TTL_SEC = 5 * 60;

/**
 * 兩次索取之間的等待。
 *
 * 單位是**秒**而不是毫秒，因為比較的對象是資料庫算出來的 `age_sec` ——
 * 兩個單位在同一段程式裡並存，遲早會有人拿其中一個去減另一個。
 */
const SMS_CODE_COOLDOWN_SEC = 60;

/**
 * 同一筆驗證碼容許猜錯幾次。達到上限即鎖定該筆 —— 六位數字只有一百萬種，
 * 沒有上限的話，在有效期內慢慢猜是划得來的。
 */
const SMS_CODE_MAX_ATTEMPTS = 5;

/** 同一支手機號一天最多索取幾次。簡訊要錢，而收到的是一個真實的人。 */
const SMS_CODE_DAILY_MAX_PER_PHONE = 10;

/**
 * 同一個來源位址一天最多索取幾次。
 *
 * 上面那個上限是按號碼算的，所以擋不住換號碼：一台機器帶著一份號碼表跑過去，
 * 每一支都在自己的額度之內，帳單卻是整份的。這一道是按來源算的那一半。
 *
 * 預設值刻意比單一號碼寬很多：合作公司的 iPad 是一整間診所共用一個對外位址，
 * 一天服務幾十位家長是正常使用。可用 `SMS_IP_DAILY_MAX` 依現場調整，
 * 設成 0 即停止一切按位址計費的發送（`readIntEnv` 收 0，`|| 50` 會吃掉它）。
 */
const SMS_CODE_DAILY_MAX_PER_IP = readIntEnv('SMS_IP_DAILY_MAX', 50);

/**
 * 把來源位址收斂成一個「同一個接取點」的鍵。
 *
 * 直接拿 `req.ip` 當鍵，上面那道上限有兩個洞，而且兩個都不必花錢：
 *
 *   - **表示法**：同一個 IPv4 客戶端會以 `::ffff:203.0.113.9` 或 `203.0.113.9`
 *     出現（取決於 socket 家族與前面幾層代理），兩種字串各算一個來源，
 *     額度直接翻倍。新測試裡那句「不寫死 127.0.0.1」講的就是這件事。
 *   - **IPv6 的位址量**：一般接取拿到的是一整段 /64，也就是 2^64 個位址 ——
 *     換位址跟換字串一樣便宜。按單一位址算等於沒有算，所以截到 /64：
 *     那才是 ISP 實際配給「一個接取點」的粒度。
 *
 * 收斂後的值同時是寫進 `request_ip` 的值，計數與紀錄因此永遠是同一個鍵。
 */
function normalizeRequestIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ip = raw.trim().toLowerCase();
  if (!ip) return null;

  // IPv4-mapped IPv6 就是那個 IPv4 位址，不是另一個來源。
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;

  // IPv6 → /64。`::` 可能吃掉了中間任意多段，先補回來再取前四段。
  let groups: string[];
  if (ip.includes('::')) {
    const [head, tail] = ip.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = Math.max(8 - headParts.length - tailParts.length, 0);
    groups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  } else {
    groups = ip.split(':');
  }
  return `${groups.slice(0, 4).map(g => g || '0').join(':')}::/64`;
}

/** 六位數字，取自 CSPRNG。`Math.random` 的輸出是可預測的。 */
function generateSmsCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// ── coze-coding-dev-sdk LLM client ──
const llmConfig = new Config();
const llmClient = new LLMClient(llmConfig);
const LLM_REPORT_MODEL = 'doubao-seed-2-0-pro-260215';
const LLM_QWEN_MODEL = 'qwen-3-5-plus-260215';

async function callLLMJSON(systemPrompt: string, userPrompt: string, model: string = LLM_REPORT_MODEL): Promise<any> {
  const response = await llmClient.invoke(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model, temperature: 0.7 }
  );
  const cleaned = response.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Initialize Gemini client lazily to avoid crashing on start if GEMINI_API_KEY is not defined yet
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is not set in secrets or environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// DashScope (Alibaba Qwen) helpers — OpenAI-compatible mode
const DASHSCOPE_COMPAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_REPORT_MODEL = process.env.QWEN_REPORT_MODEL || 'qwen3.7-max';
const QWEN_ASR_MODEL = process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash';
const QWEN_VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen3-vl-plus';

function getDashScopeKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
  if (!key || key === 'MY_DASHSCOPE_API_KEY') return null;
  return key;
}

// Uses axios (not global fetch) because @cloudbase/node-sdk pulls in web-streams-polyfill,
// which replaces the global ReadableStream and makes undici's fetch throw
// `webidl.is.ReadableStream` on some Node versions. axios goes through http/https directly.
async function postDashScope(key: string, payload: any): Promise<{ status: number; data: any }> {
  const resp = await axios.post(DASHSCOPE_COMPAT_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    timeout: 120000,
    maxBodyLength: Infinity,
    validateStatus: () => true
  });
  return { status: resp.status, data: resp.data };
}

async function callQwenJSON(model: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const key = getDashScopeKey();
  if (!key) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const resp = await postDashScope(key, {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    // Flagship Qwen models default to deep-thinking mode, far too slow for a synchronous report request
    enable_thinking: false
  });

  if (resp.status < 200 || resp.status >= 300) {
    const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    throw new Error(`DashScope ${model} request failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const raw = resp.data;
  const content = raw.choices?.[0]?.message?.content;
  if (!content) throw new Error('DashScope returned empty content.');
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Shared multi-engine cascade for JSON report generation.
// Qwen SDK -> Doubao SDK -> DashScope Qwen. Throws if every engine fails.
async function generateReportJSON(systemInstruction: string, prompt: string): Promise<{ report: any; aiEngine: string }> {
  try {
    return { report: await callLLMJSON(systemInstruction, prompt, LLM_QWEN_MODEL), aiEngine: LLM_QWEN_MODEL };
  } catch (e1: any) {
    console.warn(`Qwen SDK (${LLM_QWEN_MODEL}) failed, trying Doubao:`, e1.message);
    try {
      return { report: await callLLMJSON(systemInstruction, prompt, LLM_REPORT_MODEL), aiEngine: LLM_REPORT_MODEL };
    } catch (e2: any) {
      console.warn(`Doubao SDK (${LLM_REPORT_MODEL}) failed, trying DashScope:`, e2.message);
      return { report: await callQwenJSON(QWEN_REPORT_MODEL, systemInstruction, prompt), aiEngine: QWEN_REPORT_MODEL };
    }
  }
}

// Vision call: send an ordered list of base64 JPEG frames + a prompt to qwen3-vl,
// treating the frames as a sampled video sequence. Returns parsed JSON.
async function callQwenVision(frames: string[], prompt: string): Promise<any> {
  const key = getDashScopeKey();
  if (!key) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const content: any[] = [{ type: 'text', text: prompt }];
  frames.forEach(f => content.push({ type: 'image_url', image_url: { url: f } }));

  const resp = await postDashScope(key, {
    model: QWEN_VL_MODEL,
    messages: [{ role: 'user', content }]
  });

  if (resp.status < 200 || resp.status >= 300) {
    const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    throw new Error(`Qwen VL request failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const raw = resp.data;
  const msg = raw.choices?.[0]?.message?.content;
  const text = typeof msg === 'string'
    ? msg
    : Array.isArray(msg) ? msg.map((c: any) => c.text || '').join('') : '';
  if (!text) throw new Error('Qwen VL returned empty content.');
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Fallback high-fidelity simulation engine when API key is missing
function generateFallbackReport(child: any, scores: any[]) {
  // Identify struggling dimensions
  const struggling = scores.filter((s: any) => s.status !== 'normal');
  const delayCount = scores.filter((s: any) => s.status === 'delay').length;
  const borderlineCount = scores.filter((s: any) => s.status === 'borderline').length;

  let summary = `对儿童【${child.name}】（${child.ageMonth}个月，${child.gender === 'boy' ? '男孩' : '女孩'}）的发育进行了9维度的评估分析。`;
  if (struggling.length === 0) {
    summary += `本次筛查各方面发展稳定，可作为日后对照的基线记录，建议维持当前的多感官成长氛围。`;
  } else if (delayCount > 0) {
    summary += `本次筛查提示，【${struggling.map(s => s.dimensionName).join('、')}】等方面与同龄常见的发展节奏有差距，其中【${scores.filter((s: any) => s.status === 'delay').map(s => s.dimensionName).join('、') || '部分项目'}】建议优先安排专业咨询，其余方面可在日常互动中多加练习。`;
  } else {
    summary += `本次筛查显示各方面发展大致稳定，其中【${struggling.map(s => s.dimensionName).join('、')}】仍在建立中，建议进一步了解，并在日常互动中多加练习。`;
  }

  // Calculate simulated critical metrics
  let neuralPlasticity = 88 - (delayCount * 8) - (borderlineCount * 3);
  let sensoryIntegration = 85 - (scores.find(s => s.dimensionId === 'sensory_processing')?.status === 'delay' ? 20 : 5);
  // 動作發展是唯一與運動控制相關的維度，權重合併後區間與原本一致 (61-81)
  let motorControl = 86 - (scores.find(s => s.dimensionId === 'gross_motor')?.status === 'delay' ? 25 : 5);
  // NOTE: 九大維度中已無「家庭環境」，此指標目前取自「學習能力」，名稱與來源不一致，待產品端決定改名或改算法
  let familyEnv = 90 - (scores.find(s => s.dimensionId === 'learning_ability')?.status === 'delay' ? 25 : 5);

  // Bounds check
  neuralPlasticity = Math.max(50, Math.min(98, neuralPlasticity));
  sensoryIntegration = Math.max(50, Math.min(98, sensoryIntegration));
  motorControl = Math.max(50, Math.min(98, motorControl));
  familyEnv = Math.max(50, Math.min(98, familyEnv));

  // Determine specific recommendations. The table lives in src/dimensionContent.ts
  // alongside the other dimension-keyed tables so one test can check them together.
  const rehabMap = REHAB_SUGGESTIONS;

  // 模板兜底也走同一條規則 —— B 沒有商城，卻在 AI 失敗時推薦穿戴套件，
  // 是最容易漏掉的一處：它只在降級路徑上才會出現。
  const defaultRehab = [
    APP_MODE === 'full'
      ? '建议使用森心康智能穿戴套件，将训练游戏从2D升级为3D。配合高精度传感器做家庭OT训练指导。'
      : '将训练融入日常游戏，透过重复性的互动动作巩固神经环路，无需额外器材。',
    '坚持每天定时间的少儿关节拉伸运动，刺激下丘脑及神经营养因子释放，助力幼童认知成长。'
  ];

  const defaultHome = [
    '【起居室多通道游戏】：客厅一角辟出22米安全运动池，摆放彩虹滑梯与手套练习架，每日固定游戏。',
    '【亲子伴谈闭环游戏】：每晚睡前半小时举行“今日小英雄”拥抱对话，巩固温馨氛围。',
    '【户外沙盒感统训练】：带孩子光脚在小沙坑或草皮上奔跑行走，接触多重天然微颗粒及材质。'
  ];

  // Pick suggestions
  let pickedRehab: string[] = [];
  struggling.forEach(s => {
    if (rehabMap[s.dimensionId]) {
      pickedRehab.push(...rehabMap[s.dimensionId]);
    }
  });

  if (pickedRehab.length < 3) {
    // Top up with random standard ones or dimensional ones that are normal but can be optimized
    scores.forEach(s => {
      if (pickedRehab.length < 4 && rehabMap[s.dimensionId]) {
        pickedRehab.push(rehabMap[s.dimensionId][0]);
      }
    });
  }

  // Cap rehab list length
  pickedRehab = pickedRehab.slice(0, 4);
  if (pickedRehab.length === 0) pickedRehab = defaultRehab;

  let neuralPathwayAnalysis = '';
  if (delayCount > 0) {
    neuralPathwayAnalysis = `当前发展分析表明，孩子在局部大脑神经元突触剪切与环路传导上仍在建立中。特别是在前庭平衡与部分前额叶网路区域，突触密度或整合度与同龄常见水平有差距，外周感受传导反射至皮质所需的时间较长。当前正处于突触重塑的发展窗口期（Brain plasticity period），加强游戏化的密集 OT 练习与反馈，能有效促进未分化神经元的跨脑区功能建立。`;
  } else if (borderlineCount > 0) {
    neuralPathwayAnalysis = `脑机理测绘显示孩子的感觉整合与情绪通路目前处于典型的中性过渡带。脑深层核团如杏仁核、纹状体与精细运动小脑区信息偶联良好，传导通路的容错裕度仍在建立中。持续提供富有情绪互动的高感官互动刺激，有助于神经网突触连结密度稳定增长。建议以微阻力定向活动与温暖的家庭环境支持环路突触稳连。`;
  } else {
    neuralPathwayAnalysis = `评估数据勾勒出孩子具有极其健康、极高弹性（High resilience）的脑结构协同性。前额叶皮层、枕叶视觉中枢与颞叶听觉语言区之间的神经递质传输极为平滑，双侧半球联合纤维胼胝体发育匀称。其动作规划机制和多感官整合功能已达甚至溢出同龄水平，建议提供复杂的益智或少儿创造性互动，促进其潜在优势半球技能在高级突触环路层面的进一步沉淀。`;
  }

  let prognosisPrediction = '';
  if (delayCount > 0) {
    prognosisPrediction = `若从当月起坚持每日约 1 小时的家庭互动练习，接下来 3-6 个月内，多个仍在建立中的方面通常会有明显进展，有较大机会回到 ASQ 常见范围。发展窗口期内的支持通常效果较好；家长可以保持轻松的心态，多给正面回应，不必焦虑或比较。`;
  } else {
    prognosisPrediction = `未来3-6个月，若坚持适度运动、低干扰数码陪伴及高频率亲子共读，儿童在语言组织、注意力连续性等核心维度将会有极佳的向上突显。建议家长保持轻松乐观的心态配合其成长。`;
  }

  return {
    summary,
    neuralPathwayAnalysis,
    rehabSuggestions: pickedRehab,
    homeGuidance: defaultHome,
    prognosisPrediction,
    criticalMetrics: {
      neuralPlasticity,
      sensoryIntegration,
      familyEnvironmentScore: familyEnv,
      motorControlIndex: motorControl
    }
  };
}

// API endpoint for generating assessment report (combining static and dynamic Gemini call query)
app.post('/api/report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, scores } = req.body;
    if (!child || !scores || !Array.isArray(scores)) {
      res.status(400).json({ error: 'Missing child profile or assessment scores in body.' });
      return;
    }

    let reportData;
    let isAiGenerated = false;
    let aiEngine = 'fallback_template';

    const scoresSummaryStr = scores.map(s =>
      `- 维度：${s.dimensionName} | 阶：${s.tierId} | 本次筛查量表：${s.scaleName} | 分数：${s.score}/${s.maxScore} | 状态：${s.status}`
    ).join('\n');

    const reportSystemInstruction = 'You are a compassionate pediatric neuro-rehabilitation expert. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.';

    const basePrompt = `您是一位在儿童神经康复、脑科学发育及儿童成长心理学领域深耕20年的首席临床医学主任医生。
请针对以下儿童的基础发育筛查详细数据，结合${BRAND_NAME}儿童康复的“9维3层分层神经系统检测”理念，为其生成一份深度、高精准、温暖且富有专业建设意义的“AI脑神经分层网络智能评估报告”。

儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

已评估的多维度量表及评分结果:
${scoresSummaryStr}

请注意：
1. 您必须严格按照指定的JSON数据格式输出（不要夹杂任何额外的文字、\`\`\`json 格式标记，只返回标准的可解析的JSON对象）。
2. 在您的神经环路发育状态分析中，请以专业脑神经突触偶联、脑功能定位（如前额叶、小脑精细区、前庭反射等）、以及神经可塑性等先进脑科学概念给予严密解析，既要表现医学大师的透彻，又要字字充满对受测儿童的厚爱与成长温煦。
3. 训练建议及家庭指导方案要有极强的动作实操逻辑，不要给出假大空的敷衍建议。${WEARABLES_PROMPT_CLAUSE}
4. metrics（百分值度区间在45至98之间）要根据上面的筛查分值客观联动。
5. ${PARENT_WORDING_CLAUSE}
`;

    // Qwen has no responseSchema equivalent, so the JSON contract is embedded in the prompt
    const qwenPrompt = basePrompt + `
你必须严格返回以下JSON结构（字段齐全，不要任何额外文字或\`\`\`json标记）：
{
  "summary": "一句话总结该名受测少儿此时的核心脑成长特征（60-120字）",
  "neuralPathwayAnalysis": "深入剖析孩子当前的脑网络状态、感觉中枢协调性、前额皮层控制环等神经反射弧状态（100-250字）",
  "rehabSuggestions": ["训练方案建议（共3至4条）"],
  "homeGuidance": ["家庭场景协作活动（共3条）"],
  "prognosisPrediction": "3-6个月后的发展轨迹预判（100字左右）",
  "criticalMetrics": {
    "neuralPlasticity": 45至98的整数,
    "sensoryIntegration": 45至98的整数,
    "familyEnvironmentScore": 45至98的整数,
    "motorControlIndex": 45至98的整数
  }
}`;

    // Engine 1: Qwen 3.5 Plus via SDK (primary)
    try {
      reportData = await callLLMJSON(reportSystemInstruction, qwenPrompt, LLM_QWEN_MODEL);
      isAiGenerated = true;
      aiEngine = LLM_QWEN_MODEL;
    } catch (qwenSdkErr: any) {
      console.warn(`Qwen SDK (${LLM_QWEN_MODEL}) report generation failed, trying Doubao:`, qwenSdkErr.message);

      // Engine 2: Doubao Seed via SDK (secondary)
      try {
        reportData = await callLLMJSON(reportSystemInstruction, qwenPrompt, LLM_REPORT_MODEL);
        isAiGenerated = true;
        aiEngine = LLM_REPORT_MODEL;
      } catch (sdkErr: any) {
        console.warn(`Doubao SDK (${LLM_REPORT_MODEL}) also failed:`, sdkErr.message);

        // Engine 3: Alibaba Qwen via DashScope (tertiary)
        try {
          reportData = await callQwenJSON(QWEN_REPORT_MODEL, reportSystemInstruction, qwenPrompt);
          isAiGenerated = true;
          aiEngine = QWEN_REPORT_MODEL;
        } catch (qwenErr: any) {
          console.warn(`Qwen (${QWEN_REPORT_MODEL}) also failed, trying Gemini:`, qwenErr.message);

          // Engine 4: Google Gemini (quaternary)
          try {
        const gClient = getGeminiClient();
        const response = await gClient.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: basePrompt,
          config: {
            systemInstruction: 'You are a compassionate pediatric neuro-rehabilitation expert. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '一句话总结该名受测少儿此时的核心脑成长特征，字数在60-120格内。'
                },
                neuralPathwayAnalysis: {
                  type: Type.STRING,
                  description: '深入剖析孩子当前的脑软硬件网络状态、感觉中枢协调性、前额皮层控制环等神经反射弧状态（100-250字）。'
                },
                rehabSuggestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '输出具有极强指导力、适合由康复师或家长辅导的长效训练方案建议列表（3至4条）。'
                },
                homeGuidance: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '设计可在客厅、卧室、游乐园便捷操演的、富有趣味游戏性质、结合运动腰带或脑控智能头戴设备的家庭场景协作活动（3条）。'
                },
                prognosisPrediction: {
                  type: Type.STRING,
                  description: '中肯预判在实施针对性家庭训练3-6个月后的脑环路发展轨迹图景与给家长的鼓励话术（100字左右）。'
                },
                criticalMetrics: {
                  type: Type.OBJECT,
                  properties: {
                    neuralPlasticity: { type: Type.INTEGER, description: '脑神经可 plasticity 发育潜力指数（45-98）' },
                    sensoryIntegration: { type: Type.INTEGER, description: '感觉统合大脑协同度指数（45-98）' },
                    familyEnvironmentScore: { type: Type.INTEGER, description: '家庭氛围赋能康复支持支持系数（45-98）' },
                    motorControlIndex: { type: Type.INTEGER, description: '运动姿势力线控制指数（45-98）' }
                  },
                  required: ['neuralPlasticity', 'sensoryIntegration', 'familyEnvironmentScore', 'motorControlIndex']
                }
              },
              required: ['summary', 'neuralPathwayAnalysis', 'rehabSuggestions', 'homeGuidance', 'prognosisPrediction', 'criticalMetrics']
            }
          }
        });

        const responseText = response.text || '';
        const cleanedResponse = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        reportData = JSON.parse(cleanedResponse);
        isAiGenerated = true;
        aiEngine = 'gemini-3.5-flash';
          } catch (apiErr: any) {
            console.warn('Gemini also unavailable, using local template engine:', apiErr.message);
            reportData = generateFallbackReport(child, scores);
            isAiGenerated = false;
            aiEngine = 'fallback_template';
          }
        }
      }
    }

    res.json({
      report: reportData,
      isAiGenerated,
      aiEngine,
      createdAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown internal assessment error.' });
  }
});

// ── Paid-content gate for the tier-2/3 endpoints ──
//
// The frontend paywall decides what a parent *sees*; this decides what they can
// actually *fetch*. Without it the wall is decorative: these endpoints took no
// token at all, so anyone who knew the path got the paid report for free — and
// the parent who paid ¥19.9 would have bought something everyone already had.
// Same lesson as the APP_MODE work: a check that only exists in the bundle is
// not a check.
//
// Memory mode deliberately allows everything. With no durable store no purchase
// can exist (/api/payment/create returns 503 for that very reason), so enforcing
// here would only kill deep assessment on the demo deployment and protect
// nothing. The moment MYSQL_* is set this becomes a real gate — and startup logs
// which of the two is in effect, because a silently-open paywall is exactly the
// kind of thing nobody notices until the revenue is missing.
type UnlockDenial = { status: number; body: { error: string; code: string } };

async function denyIfLocked(req: express.Request, dimensionId: unknown): Promise<UnlockDenial | null> {
  if (!mysqlDb.isConfigured()) return null;
  // Demo switch. Sits above the dimension check on purpose: the demo paywall's
  // skip entry sends the parent straight into the assessment without a purchase,
  // so a 400 here would break the very flow this flag exists to show.
  if (PAYWALL_DEMO_OPEN) return null;

  // No dimension means we cannot tell what was purchased. Refuse rather than
  // guess — guessing wrong in the permissive direction gives away paid content.
  if (typeof dimensionId !== 'string' || !DIMENSIONS_DATA.some(d => d.id === dimensionId)) {
    return { status: 400, body: { error: '缺少有效的维度标识。', code: 'DIMENSION_REQUIRED' } };
  }

  const userId = currentUserId(req);
  if (!userId) return { status: 401, body: { error: '请先登录后再使用深度评估。', code: 'UNAUTHENTICATED' } };

  const user = await findSessionUser(userId);
  if (!user) return { status: 401, body: { error: '登录状态已失效，请重新登录。', code: 'UNAUTHENTICATED' } };

  const owned = await mysqlDb.listUnlockedDimensions(user.id);
  if (!owned.includes(dimensionId)) {
    return { status: 403, body: { error: '尚未解锁该维度的深度评估。', code: 'LOCKED' } };
  }
  return null;
}

/**
 * Applies denyIfLocked and writes the rejection. True means "already answered, stop".
 *
 * ⚠️ `dimensionId` must be the dimension the endpoint is about to SERVE, not a
 * field the caller can vary independently of the content. Getting this wrong is
 * not a small mistake: the first version of this gate checked a body field while
 * `/api/specialized-report` built its report from a *separate* body field
 * (`dimensionName`), so one ¥19.9 purchase unlocked all nine dimensions —
 * send the dimension you own, name the one you want. Endpoints that serve a
 * fixed dimension now pass a server-side constant; the rest look the name up
 * from the id they gated on.
 */
async function rejectIfLocked(req: express.Request, res: express.Response, dimensionId: unknown): Promise<boolean> {
  const denial = await denyIfLocked(req, dimensionId);
  if (!denial) return false;
  res.status(denial.status).json(denial.body);
  return true;
}

// ── Paid-content gate for T2 ──
//
// T2 is bought once, whole (ticket #45): one entitlement row per parent,
// `scope = 't2'`, no dimension. So this gate asks a yes/no question and has no
// dimension to be tricked about — the entire class of bug that denyIfLocked's
// comment describes cannot occur here, because there is nothing to name.
//
// A t3 entitlement does NOT open T2. They are two products: nine per-dimension
// purchases were the old model, and the migration marked every existing row
// 't3' precisely so they could not silently become free T2.
//
// Memory mode and the demo switch pass, same as the dimension gate — no durable
// store means no purchase can exist, and the demo paywall's skip entry sends the
// parent straight in.
async function denyIfT2Locked(req: express.Request): Promise<UnlockDenial | null> {
  if (!mysqlDb.isConfigured()) return null;
  if (PAYWALL_DEMO_OPEN) return null;

  const userId = currentUserId(req);
  if (!userId) return { status: 401, body: { error: '请先登录后再使用深度评估。', code: 'UNAUTHENTICATED' } };

  const user = await findSessionUser(userId);
  if (!user) return { status: 401, body: { error: '登录状态已失效，请重新登录。', code: 'UNAUTHENTICATED' } };

  if (!(await mysqlDb.hasT2Unlock(user.id))) {
    return { status: 403, body: { error: '尚未解锁深度评估。', code: 'LOCKED' } };
  }
  return null;
}

/**
 * Paths under `/api/t2` that stay open to a parent who has not paid.
 *
 * Two: the paywall must say how many questions the child will answer BEFORE
 * asking for money (spec §9.2), and the diagnosis direction changes that
 * number (§4.3), so a parent must be able to set it before paying too. Gating
 * either would leave a price tag and nothing else on the screen.
 *
 * Both handlers still require a signed-in parent — "open" here means "not
 * behind the purchase", not "anonymous". The plan is computed from THIS
 * parent's child and screening; there is nothing to compute for nobody.
 *
 * Written as an allowlist, not as "remember to call the gate in each handler".
 * The 2026-07-31 bypass was exactly a per-handler check that one handler got
 * wrong; a guard on the prefix means the endpoints ticket #57 adds are closed
 * by default and opening one takes a deliberate line right here.
 */
const T2_OPEN_PATHS = new Set(['/plan', '/diagnosis']);

// Mounted on tier2Only rather than paidOnly: in project B these paths must not
// exist at all (B has no T2), and a guard that answered 403 there would confirm
// the endpoint exists. Same never-mounted-Router trick as the rest of tier 2.
tier2Only.use('/api/t2', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (T2_OPEN_PATHS.has(req.path)) {
      next();
      return;
    }
    const denial = await denyIfT2Locked(req);
    if (denial) {
      res.status(denial.status).json(denial.body);
      return;
    }
    next();
  } catch (err: any) {
    // Express 4 does not catch rejected promises from middleware. Without this
    // the request hangs until the client gives up — and a hanging paywall reads
    // as "the site is broken", not as "you have not paid".
    console.error('[Payment] T2 gate failed:', err.message);
    res.status(500).json({ error: '无法确认深度评估权益，请稍后重试。' });
  }
});

// ── T2 入口：題量預估與診斷方向（票 #56，規格 §4.3–4.5、§9.2）──
//
// `GET /api/t2/plan`：依這位家長的孩子與最新篩查算 `planT2()`（純函式，`src/t2/routing.ts`），
// 附上前端要的三樣：九碼標記、生效的診斷方向、入口要不要出現（`entranceState`）。
// `PUT /api/t2/diagnosis`：存入口選的診斷方向。之後生成報告要帶（#59 讀同一張表）。
//
// 兩支都在 `T2_OPEN_PATHS` 上：付費前就要顯示題量，而診斷方向會改題量。
//
// 月齡用**實足月齡**（CONTEXT.md）：路由決定的是「現在該做哪一段」，出生日期對今天算；
// 舊檔案沒有出生日期就退回檔案上的 `ageMonth`（與篩查那一側同一條退路）。
//
// 記憶體模式：孩子與篩查讀 `offlineUserData`（`/api/db/save` 的熱備份），診斷方向放
// `offlineT2Intake` —— 展示站沒有資料庫也要看得到入口長什麼樣子。

const offlineT2Intake = new Map<UserId, DiagnosisDirection | null>();

/** 這位家長的孩子與篩查結果。資料庫模式讀 `user_data`，否則讀記憶體熱備份；都沒有回 `null`。 */
async function loadParentData(userId: UserId): Promise<{ child: any; completedScores: any[] } | null> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    const row = await withTimeout(mysqlDb.getUserDataByUserId(dbUserId), 2000);
    const parsed = row ? mysqlDb.parseUserDataRow(row) : null;
    if (!parsed) return null;
    return { child: parsed.child ?? null, completedScores: Array.isArray(parsed.completedScores) ? parsed.completedScores : [] };
  }
  const local = offlineUserData.get(userId);
  if (!local) return null;
  return { child: local.child ?? null, completedScores: Array.isArray(local.completedScores) ? local.completedScores : [] };
}

/**
 * 孩子今天的實足月齡。出生日期算得出來就用它；算不出來（舊檔案沒有出生日期）退回檔案上的
 * `ageMonth`。兩個都沒有回 `null` —— 不猜一個數字，`planT2` 對月齡是嚴格的。
 */
function liveAgeMonthOf(child: any): number | null {
  if (!child || typeof child !== 'object') return null;
  if (typeof child.birthDate === 'string') {
    const fromBirth = calculateAgeMonth(child.birthDate);
    if (fromBirth !== null) return fromBirth;
  }
  return Number.isInteger(child.ageMonth) && child.ageMonth >= 0 ? child.ageMonth : null;
}

async function loadT2Diagnosis(userId: UserId): Promise<DiagnosisDirection | null> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) return withTimeout(mysqlDb.getT2Diagnosis(dbUserId), 2000);
  return offlineT2Intake.get(userId) ?? null;
}

async function storeT2Diagnosis(userId: UserId, value: DiagnosisDirection | null): Promise<void> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    await withTimeout(mysqlDb.saveT2Diagnosis(dbUserId, value), 2000);
    return;
  }
  offlineT2Intake.set(userId, value);
}

/** 兩支端點共用的登入檢查。回 `null` 代表已經回應（401），呼叫端直接 return。 */
async function requireT2Parent(req: express.Request, res: express.Response): Promise<UserId | null> {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: '请先登录后再查看深度评估。', code: 'UNAUTHENTICATED' });
    return null;
  }
  if (await sessionAccountMissing(userId)) {
    res.status(401).json({ error: '登录状态已失效，请重新登录。', code: 'UNAUTHENTICATED' });
    return null;
  }
  return userId;
}

tier2Only.get('/api/t2/plan', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    // 查詢字串上帶了就以它為準（含空字串＝「未告知」）：畫面上家長換選項時即時重算，
    // 還沒存也算得出來。沒帶才用存的那一個。不認得的值是 400，不能安靜地當成沒填。
    const queried = req.query.diagnosis;
    const override = queried !== undefined ? readDiagnosisDirection(queried) : null;
    if (override && !override.ok) {
      res.status(400).json({ error: '诊断方向不是可选的十种之一。', code: 'DIAGNOSIS_INVALID' });
      return;
    }

    const data = await loadParentData(userId);
    const t1Scores = (data?.completedScores ?? []).filter((s: any) => s && typeof s === 'object' && s.tierId === 'T1');
    if (!data?.child || t1Scores.length === 0) {
      res.status(404).json({ error: '请先完成筛查，再查看深度评估的安排。', code: 'T1_REQUIRED' });
      return;
    }
    const ageMonth = liveAgeMonthOf(data.child);
    if (ageMonth === null) {
      res.status(400).json({ error: '孩子档案里没有可用的月龄，请先补齐出生日期。', code: 'CHILD_AGE_REQUIRED' });
      return;
    }

    const diagnosis = override ? override.value : await loadT2Diagnosis(userId);
    const t1Flags = t1FlagsFromScores(t1Scores);
    const plan = planT2(t1Flags, ageMonth, diagnosis);
    res.json({ ...plan, t1Flags, diagnosisDirection: diagnosis, entrance: entranceState(plan, t1Flags) });
  } catch (err: any) {
    console.error('[T2] plan failed:', err.message);
    res.status(500).json({ error: '暂时无法读取深度评估的安排，请稍后重试。' });
  }
});

tier2Only.put('/api/t2/diagnosis', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    const parsed = readDiagnosisDirection(req.body?.diagnosis);
    if (!parsed.ok) {
      res.status(400).json({ error: '诊断方向不是可选的十种之一。', code: 'DIAGNOSIS_INVALID' });
      return;
    }
    await storeT2Diagnosis(userId, parsed.value);
    res.json({ diagnosisDirection: parsed.value });
  } catch (err: any) {
    console.error('[T2] save diagnosis failed:', err.message);
    res.status(500).json({ error: '暂时无法保存，请稍后重试。' });
  }
});

// ── T2 交卷與已完成清單（票 #57，規格 §9.1、§9.2）──
//
// `POST /api/t2/tool-results`：家長答完一支工具送上來。body 只有答案（`toolId`、`assessedAgeMonth`、
// `rater`、`pre`、`answers`），**分數是伺服器算的**（`scoreTool`）：窗口外、缺答、多餘的題、值域外
// 一律 400 且**不落表** —— 半套結果這種東西不存在（`scoring/index.ts` 檔頭）。算得出來就連同孩子
// 快照存一筆，**每次交卷一筆、不覆蓋**（§5.1「重做會是新的一筆」）。
// `GET /api/t2/tool-results`：這位家長每支工具**最新且完整**的一筆（挑法與 #52 的彙整同一個函式
// `latestCompleteResults`），每筆附這支對它餵的維度的 band —— 加測提示「星號做完且判留意或關注
// 才顯示」（#58）要的資料，前端不自己跑規則表。
//
// 兩支都在 T2 閘門後面（不在 `T2_OPEN_PATHS` 上）：未登入 401、沒買 403。B 模式整個前綴不存在。
//
// 回應的形狀兩支相同（`ToolResultEntry`：`id`、`createdAt`、`result`、`bands`），交卷成功後前端可以
// 直接把回應接到清單上、當場判斷要不要顯示加測提示，不必再 GET 一次。§9.2 那一格寫「回 `ToolResult`」，
// 這裡是它的超集（`result` 就是那份 `ToolResult`，一個欄位都沒動）。
//
// 記憶體模式：存 `offlineT2ToolResults` —— 展示站沒有資料庫也要走得完一支問卷。

const offlineT2ToolResults = new Map<UserId, ToolResultRecord[]>();
let offlineT2ToolResultSeq = 0;

/** 兩支端點回的一筆。 */
interface ToolResultEntry {
  id: number;
  createdAt: string;
  result: ToolResultRecord['result'];
  bands: ReturnType<typeof toolBands>;
}

function toolResultEntry(record: ToolResultRecord): ToolResultEntry {
  return { id: record.id, createdAt: record.createdAt, result: record.result, bands: toolBands(record.result) };
}

async function storeT2ToolResult(userId: UserId, childSnapshot: ChildSnapshot, result: ToolResultRecord['result']): Promise<ToolResultRecord> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    const id = await withTimeout(t2Store.insertToolResult(dbUserId, childSnapshot, result), 2000);
    return { id, createdAt: new Date().toISOString(), childSnapshot, result };
  }
  offlineT2ToolResultSeq += 1;
  const record: ToolResultRecord = { id: offlineT2ToolResultSeq, createdAt: new Date().toISOString(), childSnapshot, result };
  const list = offlineT2ToolResults.get(userId) ?? [];
  list.push(record);
  offlineT2ToolResults.set(userId, list);
  return record;
}

async function loadT2ToolResults(userId: UserId): Promise<ToolResultRecord[]> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) return withTimeout(t2Store.listToolResults(dbUserId), 2000);
  return offlineT2ToolResults.get(userId) ?? [];
}

/** 交卷當下的孩子檔案。`ageMonth` 是今天算的實足月齡，可以與 body 的 `assessedAgeMonth` 不同（表單開著跨了月）。 */
function childSnapshotOf(child: any): ChildSnapshot {
  return {
    name: typeof child?.name === 'string' ? child.name : '',
    birthDate: typeof child?.birthDate === 'string' ? child.birthDate : null,
    gender: typeof child?.gender === 'string' ? child.gender : null,
    ageMonth: liveAgeMonthOf(child),
  };
}

tier2Only.post('/api/t2/tool-results', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    const parsed = readToolSubmission(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json(parsed.body);
      return;
    }

    // 快照要有東西可照：沒有孩子檔案就沒有「這筆是誰的孩子答的」。T2 的入口本來就在 T1 報告上，
    // 走到這裡而沒有檔案，是前端狀態壞了，不是正常路徑。
    const data = await loadParentData(userId);
    if (!data?.child) {
      res.status(404).json({ error: '还没有孩子的档案，请先完成筛查。', code: 'CHILD_REQUIRED' });
      return;
    }

    const outcome = scoreTool(parsed.value);
    if (!outcome.ok) {
      const http = refusalToHttp(outcome);
      res.status(http.status).json(http.body);
      return;
    }

    const record = await storeT2ToolResult(userId, childSnapshotOf(data.child), outcome.result);
    res.status(201).json(toolResultEntry(record));
  } catch (err: any) {
    console.error('[T2] submit tool result failed:', err.message);
    res.status(500).json({ error: '暂时无法保存这份问卷，请稍后重试。' });
  }
});

tier2Only.get('/api/t2/tool-results', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    const records = await loadT2ToolResults(userId);
    // 每支最新且完整的一筆。`latestCompleteResults` 吃的是 `ToolResult`，挑完再對回那一列
    // （同一個物件，不是複本，所以 Map 用物件當鍵對得回去）。
    const byResult = new Map(records.map(r => [r.result, r] as const));
    const latest = latestCompleteResults(records.map(r => r.result));
    res.json({ results: latest.map(r => toolResultEntry(byResult.get(r)!)) });
  } catch (err: any) {
    console.error('[T2] list tool results failed:', err.message);
    res.status(500).json({ error: '暂时无法读取已完成的问卷，请稍后重试。' });
  }
});


// ── T2 生成報告（票 #59，規格 §9.1、§9.2、§6.4）──
//
// `POST /api/t2/findings`：家長按「生成」時的快照。撈這位家長每支**最新且完整**的 `ToolResult`
// → 彙整成 `T2Findings`（#52）→ 配這一週的四支（#53）→ SMART 目標（#54）→ 組提示（#55）→
// 走既有的三段備援（Qwen → Doubao → DashScope）→ 驗證 → 過就存 prose，不過或全掛就存模板。
// `GET /api/t2/findings/latest`：最新一筆；一筆都沒有是 404。
//
// 【寫下後不改】
// 與 T1 報告同一個哲學（§9.1）：一次生成一列，不覆蓋、不重算。門檻改版（`rulesVersion` 換了）
// 之後回頭看半年前那份報告，讀到的仍是當時那一份 —— `GET /latest` 只是把那一列端出來，
// 不會拿今天的規則表重跑一次。
//
// 【兩個月齡不是同一個】
// - **測評月齡**（`findings.child.assessedAgeMonth`）：家長作答時用的那一個，從最新那筆結果來。
//   報告講的是「那時候看到什麼」，用今天的月齡去描述半個月前的作答會對不上題目。
// - **實足月齡**（今天算的）：活動配對用（訓練是現在要做的事，`activityMatch.ts` 檔頭）。
// 孩子跨段之後兩者會分岔，畫面上要標出來（#60）。
//
// 【星號沒做完也允許生成】
// §10.2 第 5 項。彙整層自己會把那個維度標成 `partial`，報告層自己會寫出來 —— 這裡不擋。
//
// 記憶體模式：存 `offlineT2Findings`；活動庫在沒有資料庫時是空的，於是每個維度「準備中」，
// 那是 §7.4 寫好的行為，不是錯誤。

const offlineT2Findings = new Map<UserId, FindingsRecord[]>();
let offlineT2FindingsSeq = 0;

/** 生成與每週活動共用的一組輸入：孩子、九碼、今天的實足月齡。缺哪一項就回哪一種 HTTP。 */
interface T2Context {
  child: any;
  t1Flags: ReturnType<typeof t1FlagsFromScores>;
  /** 今天算的實足月齡（活動配對用）。 */
  liveAgeMonth: number;
  diagnosis: DiagnosisDirection | null;
}

/**
 * 讀齊生成報告要的東西。回 `null` 代表已經回應（404／400），呼叫端直接 return。
 * 檢查與 `GET /api/t2/plan` 同一套 —— 同一位家長在入口看得到題量，在這裡就該生得出報告。
 */
async function loadT2Context(userId: UserId, res: express.Response): Promise<T2Context | null> {
  const data = await loadParentData(userId);
  const t1Scores = (data?.completedScores ?? []).filter((s: any) => s && typeof s === 'object' && s.tierId === 'T1');
  if (!data?.child || t1Scores.length === 0) {
    res.status(404).json({ error: '请先完成筛查，再生成深度评估报告。', code: 'T1_REQUIRED' });
    return null;
  }
  const liveAgeMonth = liveAgeMonthOf(data.child);
  if (liveAgeMonth === null) {
    res.status(400).json({ error: '孩子档案里没有可用的月龄，请先补齐出生日期。', code: 'CHILD_AGE_REQUIRED' });
    return null;
  }
  return {
    child: data.child,
    t1Flags: t1FlagsFromScores(t1Scores),
    liveAgeMonth,
    diagnosis: await loadT2Diagnosis(userId),
  };
}

/** 活動庫。沒有資料庫（展示站）時是空的 —— 配不到就是「準備中」（§7.4）。 */
async function loadActivityLibrary(): Promise<Activity[]> {
  if (!mysqlDb.isConfigured()) return [];
  try {
    return await withTimeout(listActivityLibrary(), 2000);
  } catch (err: any) {
    // 活動庫讀不出來不該讓整份報告生不出來：報告的判定與目標都不靠它，
    // 少的只是「本週四支」那一段，而那一段本來就有「準備中」這個出口。
    console.error('[T2] 活動庫讀取失敗，本次以空庫配對:', err.message);
    return [];
  }
}

async function storeT2Findings(userId: UserId, input: t2FindingsStore.FindingsInsert): Promise<FindingsRecord> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    const id = await withTimeout(t2FindingsStore.insertFindings(dbUserId, input), 2000);
    return { id, createdAt: new Date().toISOString(), ...input };
  }
  offlineT2FindingsSeq += 1;
  const record: FindingsRecord = { id: offlineT2FindingsSeq, createdAt: new Date().toISOString(), ...input };
  const list = offlineT2Findings.get(userId) ?? [];
  list.push(record);
  offlineT2Findings.set(userId, list);
  return record;
}

async function loadLatestT2Findings(userId: UserId): Promise<FindingsRecord | null> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) return withTimeout(t2FindingsStore.latestFindings(dbUserId), 2000);
  const list = offlineT2Findings.get(userId) ?? [];
  return list.length === 0 ? null : list[list.length - 1];
}

/**
 * 這份快照講的是幾個月大時的作答（檔頭「兩個月齡不是同一個」）。
 * 最新那筆完整結果的 `assessedAgeMonth`；一支都沒做過就用今天的實足月齡。
 */
function assessedAgeMonthOf(results: ReadonlyArray<ToolResultRecord['result']>, fallback: number): number {
  const selected = latestCompleteResults(results);
  if (selected.length === 0) return fallback;
  return selected[selected.length - 1].assessedAgeMonth;
}

/** 兩支端點回的一份快照。`findings` 與 `prose` 原樣，不重算、不改寫。 */
function findingsEntry(record: FindingsRecord) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    findings: record.findings,
    prose: record.prose,
    isAiGenerated: record.isAiGenerated,
    aiEngine: record.aiEngine,
  };
}

tier2Only.post('/api/t2/findings', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    const context = await loadT2Context(userId, res);
    if (!context) return;

    const records = await loadT2ToolResults(userId);
    const results = records.map(r => r.result);
    const findings = buildT2Findings({
      results,
      t1Flags: context.t1Flags,
      assessedAgeMonth: assessedAgeMonthOf(results, context.liveAgeMonth),
      sex: context.child?.gender === 'boy' || context.child?.gender === 'girl' ? context.child.gender : undefined,
      diagnosisDirection: context.diagnosis,
    });

    // 報告要的素材：這一週的四支（實足月齡）與最多三條目標。都是純函式算的，
    // 模型只負責把它們寫成句子（§6.2「AI 只寫字，不判斷」）。
    //
    // 「前四週派過的」要照實傳：報告的提示會逐支帶上活動標題，而家長在同一頁底下看到的是
    // `/api/t2/weekly-plan` 存下來的那一份（票 #61 把兩者排在一起）。這裡傳空陣列的話，
    // 「四週內派過 −2」不生效，兩邊就會對「這一週練什麼」給出兩個不一樣的答案。
    const childName = typeof context.child?.name === 'string' ? context.child.name : undefined;
    const recentWeeks = await loadRecentWeeklyPlans(userId, weekStartOf(new Date()));
    const input: T2ReportInput = {
      findings,
      activities: matchWeeklyActivities(
        findings,
        context.liveAgeMonth,
        recentWeeks.flatMap(p => p.activities.picks.map(x => x.id)),
        await loadActivityLibrary(),
      ),
      goals: buildSmartGoals(findings, { childName }),
      childName,
    };

    const outcome = await generateProse(input, generateReportJSON);
    if (!outcome.isAiGenerated) {
      // 家長拿到的是模板，而模板讀起來比較平。日誌是唯一看得出「為什麼」的地方。
      console.warn(`[T2] 報告退模板（${outcome.aiEngine}）：${outcome.errors.join(' | ')}`);
    }

    const record = await storeT2Findings(userId, {
      findings,
      prose: outcome.prose,
      isAiGenerated: outcome.isAiGenerated,
      aiEngine: outcome.aiEngine,
    });
    res.status(201).json(findingsEntry(record));
  } catch (err: any) {
    console.error('[T2] generate findings failed:', err.message);
    res.status(500).json({ error: '暂时无法生成报告，请稍后重试。' });
  }
});

tier2Only.get('/api/t2/findings/latest', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    const record = await loadLatestT2Findings(userId);
    if (!record) {
      res.status(404).json({ error: '还没有生成过深度评估报告。', code: 'T2_FINDINGS_NONE' });
      return;
    }
    res.json(findingsEntry(record));
  } catch (err: any) {
    console.error('[T2] latest findings failed:', err.message);
    res.status(500).json({ error: '暂时无法读取报告，请稍后重试。' });
  }
});

// ── T2 每週活動（票 #60，規格 §9.1、§9.2、§7.3）──
//
// `GET /api/t2/weekly-plan?week=`：查的那週有就回那一份；沒有就用最新的 `T2Findings` 快照
// ＋當週實足月齡＋前四週派過的編號跑一次配對（#53），存起來再回。**一週一筆**：同一週查兩次
// 回同一份，表裡仍是一筆。
//
// 【為什麼要存下來，不是每次算】
// 配對對「前四週派過的」會扣 2 分（§7.3 第 2 條）。不存的話，家長在同一週裡重整兩次頁面，
// 第二次算出來的四支可能與第一次不同 —— 昨天記下「這週要練 A017」的那位家長，今天打開找不到它。
//
// 【兩個月齡在畫面上要分得開】
// 配對吃**實足月齡**（訓練是現在要做的事）；報告寫的是**測評月齡**（那時候看到什麼）。
// 孩子跨段之後兩者會分岔，回應把兩個都帶上，畫面標出配對用的是哪一個（詞彙表的要求）。
// 「當週實足月齡」取的是那一週**星期一**那天的月齡：一週裡過生日的孩子，整週用同一個數字，
// 否則同一份已經存下來的活動，在畫面上會在生日那天突然變成「為另一個年齡段配的」。
//
// 【活動內容不存在這張表裡】
// 存的是編號；標題、時長、器材、圖文步驟每次都從活動庫查（`listActivityLibrary`）。
// 內容團隊今天補完一支活動的步驟，家長這一週打開就看得到 —— 存進來等於給每一週複製一份活動庫。
// 編號在庫裡查不到（今天不會發生：活動只停用不刪除）就略過那一支，不讓整週的畫面壞掉。
//
// 記憶體模式：存 `offlineT2WeeklyPlans`；活動庫是空的，於是每個維度「準備中」（§7.4）。

const offlineT2WeeklyPlans = new Map<UserId, WeeklyPlanRecord[]>();
let offlineT2WeeklyPlanSeq = 0;

/** 配對要看「前幾週派過的」（§7.3 第 2 條）。 */
const RECENT_WEEKS = 4;

/** 可以查到多未來的一週（見端點裡那一段註解）。 */
const WEEK_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;

async function loadWeeklyPlan(userId: UserId, weekStart: string): Promise<WeeklyPlanRecord | null> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) return withTimeout(t2WeeklyStore.findWeeklyPlan(dbUserId, weekStart), 2000);
  return (offlineT2WeeklyPlans.get(userId) ?? []).find(p => p.weekStart === weekStart) ?? null;
}

async function loadRecentWeeklyPlans(userId: UserId, weekStart: string): Promise<WeeklyPlanRecord[]> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    return withTimeout(t2WeeklyStore.recentWeeklyPlans(dbUserId, weekStart, RECENT_WEEKS), 2000);
  }
  return (offlineT2WeeklyPlans.get(userId) ?? [])
    .filter(p => p.weekStart < weekStart)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, RECENT_WEEKS);
}

/**
 * 存這一週的那一份。**兩個請求同時算完時，後到的那個讀回先到的那一份** ——
 * 一週一筆是 `uniq_user_week` 保證的，撞到它代表別人剛剛寫好了，不是錯誤。
 * 少了這一關，家長開兩個分頁（或連點兩下重整）時，第二個分頁會拿到 500。
 */
async function storeWeeklyPlan(
  userId: UserId,
  weekStart: string,
  input: t2WeeklyStore.WeeklyPlanInsert,
): Promise<WeeklyPlanRecord> {
  const dbUserId = toDbUserId(userId);
  if (mysqlDb.isConfigured() && dbUserId !== null) {
    try {
      const id = await withTimeout(t2WeeklyStore.insertWeeklyPlan(dbUserId, input), 2000);
      return { id, createdAt: new Date().toISOString(), ...input };
    } catch (err: any) {
      if (err?.code !== 'ER_DUP_ENTRY') throw err;
      const winner = await loadWeeklyPlan(userId, weekStart);
      if (winner) return winner;
      throw err;
    }
  }
  // 記憶體模式：沒有唯一索引，自己擋一次（兩個請求可以在 await 之間交錯）。
  const existing = (offlineT2WeeklyPlans.get(userId) ?? []).find(p => p.weekStart === weekStart);
  if (existing) return existing;
  offlineT2WeeklyPlanSeq += 1;
  const record: WeeklyPlanRecord = { id: offlineT2WeeklyPlanSeq, createdAt: new Date().toISOString(), ...input };
  const list = offlineT2WeeklyPlans.get(userId) ?? [];
  list.push(record);
  offlineT2WeeklyPlans.set(userId, list);
  return record;
}

/**
 * 那一週星期一當天的實足月齡（檔頭「兩個月齡」）。
 *
 * 有出生日期就照它算；那一週在孩子出生之前時 `calculateAgeMonth` 回 `null`，這裡跟著回 `null`
 * ——**不退回測評月齡**：那會讓 2019 年那一週的畫面寫著「按孩子现在 48 个月安排」，一個看起來
 * 像真的、其實與那一週無關的數字，而且還會為那一週寫一列。
 *
 * 沒有出生日期的舊檔案才退回快照上的測評月齡：那是我們僅有的資訊，而配對對月齡是嚴格的
 *（非負整數），不猜一個數字。
 */
function ageMonthForWeek(child: any, weekStart: string, fallback: number): number | null {
  if (typeof child?.birthDate === 'string') {
    return calculateAgeMonth(child.birthDate, new Date(`${weekStart}T00:00:00.000Z`));
  }
  return fallback;
}

tier2Only.get('/api/t2/weekly-plan', async (req, res) => {
  try {
    const userId = await requireT2Parent(req, res);
    if (!userId) return;

    // `week=` 帶了就以它為準（那一天所在那一週），沒帶就是這一週。認不得的日期是 400：
    // 安靜地當成「這一週」的話，家長看到的是一份與他選的日期無關的活動。
    const queried = req.query.week;
    if (queried !== undefined && (typeof queried !== 'string' || !isCalendarDate(queried))) {
      res.status(400).json({ error: '日期格式不正确，请用 2026-09-07 这样的写法。', code: 'WEEK_INVALID' });
      return;
    }
    const weekStart = weekStartOf(typeof queried === 'string' ? queried : new Date());

    // 只服務「這一週與它之前」，外加一週的餘裕（家長的裝置時鐘比伺服器快幾分鐘時，週日深夜
    // 送上來的「下一週」仍算得出來）。再往後的週次沒有意義，而每一個不同的週次都會寫一列——
    // 不擋的話，一個帶著自己 token 的腳本可以無上限地寫進去。
    if (weekStart > weekStartOf(new Date(Date.now() + WEEK_LOOKAHEAD_MS))) {
      res.status(400).json({ error: '还看不到这么远的安排，请先看这一周。', code: 'WEEK_OUT_OF_RANGE' });
      return;
    }

    const snapshot = await loadLatestT2Findings(userId);
    if (!snapshot) {
      res.status(404).json({
        error: '请先生成深度评估报告，本周的活动会依报告安排。',
        code: 'T2_FINDINGS_REQUIRED',
      });
      return;
    }

    const data = await loadParentData(userId);
    const ageMonth = ageMonthForWeek(data?.child, weekStart, snapshot.findings.child.assessedAgeMonth);
    if (ageMonth === null) {
      res.status(400).json({ error: '这一周在孩子出生之前，请换一个日期。', code: 'WEEK_OUT_OF_RANGE' });
      return;
    }

    // 活動庫一次請求讀一次：配對要它，把編號配回內容也要它。
    const library = await loadActivityLibrary();
    let record = await loadWeeklyPlan(userId, weekStart);
    if (!record) {
      const recent = await loadRecentWeeklyPlans(userId, weekStart);
      const recentIds = recent.flatMap(p => p.activities.picks.map(x => x.id));
      const matched = matchWeeklyActivities(snapshot.findings, ageMonth, recentIds, library);
      record = await storeWeeklyPlan(userId, weekStart, {
        weekStart,
        findingsId: snapshot.id,
        activities: {
          picks: matched.picks.map(p => ({ id: p.activity.id, dimension: p.dimension, reason: p.reason })),
          preparing: matched.preparing,
        },
      });
    }

    res.json(weeklyPlanResponse(record, ageMonth, snapshot, library));
  } catch (err: any) {
    console.error('[T2] weekly plan failed:', err.message);
    res.status(500).json({ error: '暂时无法读取本周的活动，请稍后重试。' });
  }
});

/** 把存下來的編號配回活動庫的內容。庫裡查不到的略過（檔頭）。`library` 由呼叫端讀好傳進來。 */
function weeklyPlanResponse(
  record: WeeklyPlanRecord,
  ageMonth: number,
  snapshot: FindingsRecord,
  library: ReadonlyArray<Activity>,
) {
  const byId = new Map(library.map(a => [a.id, a] as const));
  const activities = record.activities.picks
    .map(pick => {
      const activity = byId.get(pick.id);
      if (!activity) {
        console.warn(`[T2] 每週活動 ${record.weekStart} 的 ${pick.id} 不在活動庫裡，略過`);
        return null;
      }
      return { activity, dimension: pick.dimension, reason: pick.reason };
    })
    .filter((x): x is { activity: Activity; dimension: DimensionCode; reason: WeeklyActivities['picks'][number]['reason'] } => x !== null);

  return {
    weekStart: record.weekStart,
    weekEnd: weekEndOf(record.weekStart),
    createdAt: record.createdAt,
    findingsId: record.findingsId,
    // 配對用的實足月齡與它落在哪一個年齡段（畫面上要標出來）
    ageMonth,
    ageKey: ageKeyOf(ageMonth),
    // 報告用的測評月齡。兩者不同時畫面要說明（孩子跨段後會分岔）
    reportAgeMonth: snapshot.findings.child.assessedAgeMonth,
    activities,
    preparing: record.activities.preparing,
  };
}

/** Dimensions whose deep assessment is served by a fixed endpoint. */
const LANGUAGE_DIMENSION_ID = 'language';
const MOTION_DIMENSION_ID = 'gross_motor';

// API endpoint for single-dimension T2/T3 specialized deep report (AI-generated)
tier2Only.post('/api/specialized-report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, dimensionId, t2Percent, t3Percent, status } = req.body;
    if (await rejectIfLocked(req, res, dimensionId)) return;
    // The report is built from the dimension we just authorized, looked up here
    // rather than taken from the body. Accepting a client-supplied display name
    // alongside the gated id is what let one purchase serve all nine reports.
    const dimensionName = DIMENSIONS_DATA.find(d => d.id === dimensionId)?.name;
    if (!child || !dimensionName) {
      res.status(400).json({ error: 'Missing child profile or dimension name.' });
      return;
    }

    // Same three labels the screens use (src/utils/statusWording.ts) — the model
    // echoes whatever we call the status, so feed it the parent-facing words.
    const statusText = status === 'delay' ? '需要较多支持' : status === 'borderline' ? '需要少量支持' : '发展稳定';
    // 提示改写于 #59（规格 v2 §6）。原本这里要模型谈「脑神经突触偶联」「前庭反射」与
    // 「森心康智能穿戴硬件」—— 前者是拿神经解剖的词包装一份筛查结果（§6.2「AI 只写字，
    // 不判断」：它手上只有两个百分比，写不出神经传导的事），后者是把带货写进报告正文。
    // 两者都与 §6 直接冲突，换成「这个能力由哪些小步骤搭起来、现在搭到哪里」。
    // JSON 的栏位名一个都没动（`SpecializedReportView.tsx` 照它渲染），换的是要它写什么。
    const systemInstruction = 'You are a warm, plain-spoken childhood development writer for parents. You strictly return output as a single, valid JSON block exactly matching the instructed schema, with no markdown codeblocks, no front/end spacing, in Chinese language.';
    const prompt = `您是一位替儿童发展筛查机构写家长版报告的中文写手，读者是孩子的家长。
请针对以下儿童在【${dimensionName}】这一单一发育维度的深度评估结果，生成一份聚焦该维度的“发展观察报告”。

儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

【${dimensionName}】维度评估结果:
- T2 家属自评得分率: ${typeof t2Percent === 'number' ? t2Percent : '未知'}%
- T3 临床实测得分率: ${typeof t3Percent === 'number' ? t3Percent : '未知'}%
- 综合判定: ${statusText}

请注意：
1. 只聚焦【${dimensionName}】这一个维度，不要泛谈其他维度。
2. neuralPathwayAnalysis 写的是「这项能力是由哪些更小的步骤一层层搭起来的，孩子现在搭到哪一层、下一层是什么」。用家长听得懂的日常语言，举孩子生活里看得到的例子。只写观察得到的行为，不要转而描述身体内部的运作机制 —— 这份评估看的是孩子在日常里做得到什么，写别的就超出了它能说的范围。
3. 训练建议与家庭指导要具体到「什么时候、用家里已经有的什么东西、做几分钟」，让家长今天就能开始。不要提任何品牌、产品，或需要另外购买的器材。
4. criticalMetrics 的百分值（45-98 之间的整数）要与上面的得分率客观联动（得分越低指标越低）。
5. ${PARENT_WORDING_CLAUSE}
你必须严格返回以下JSON结构（字段齐全，不要任何额外文字或\`\`\`json标记）：
{
  "summary": "一句话总结该维度目前的发展特点（60-120字）",
  "neuralPathwayAnalysis": "这项能力由哪些小步骤搭起来、孩子现在到哪一步、下一步是什么（120-250字）",
  "rehabSuggestions": ["针对该维度的训练建议（共3至4条）"],
  "homeGuidance": ["可在家操演的场景化活动（共3条）"],
  "prognosisPrediction": "3-6个月针对性训练后的发展轨迹预判（100字左右）",
  "criticalMetrics": {
    "neuralPlasticity": 45至98的整数,
    "sensoryIntegration": 45至98的整数,
    "familyEnvironmentScore": 45至98的整数,
    "motorControlIndex": 45至98的整数
  }
}`;

    try {
      const { report, aiEngine } = await generateReportJSON(systemInstruction, prompt);
      res.json({ report, isAiGenerated: true, aiEngine, createdAt: new Date().toISOString() });
    } catch (aiErr: any) {
      // All engines failed → let the frontend fall back to its per-dimension template
      console.warn('Specialized report AI generation failed, frontend will use template:', aiErr.message);
      res.json({ report: null, isAiGenerated: false, aiEngine: 'fallback_template' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown specialized report error.' });
  }
});

// API endpoint for CPMV-20 motion item scoring from sampled video frames (qwen3-vl)
tier2Only.post('/api/motion-eval', async (req: express.Request, res: express.Response) => {
  try {
    const { frames, item, child } = req.body;
    // CPMV-20 motion scoring is the gross-motor product (AssessmentPanel only
    // renders it for that dimension), so the gate binds to it server-side.
    if (await rejectIfLocked(req, res, MOTION_DIMENSION_ID)) return;
    if (!Array.isArray(frames) || frames.length === 0 || !item || !item.name) {
      res.status(400).json({ error: 'Missing frames or item definition.' });
      return;
    }

    const key = getDashScopeKey();
    if (!key) {
      // No key → let the frontend keep the item for manual scoring
      res.json({ score: null, isAiGenerated: false });
      return;
    }

    const ageInfo = child ? `受评儿童约 ${child.ageMonth} 个月（${child.gender === 'boy' ? '男' : '女'}）。` : '';
    const prompt = `你是一位资深小儿脑瘫康复评估治疗师，正在依据「脑瘫儿童动作影像筛查(CPMV-20)」量表，判读一段动作视频抽取的连续帧序列（按时间先后排列）。${ageInfo}

评估项目：${item.name}
指令要求：${item.cmd || ''}
临床观察要点：${item.watch}
量化观察指标：${item.ai}

评分锚点：
- 2 分（完成良好）：${item.s2}
- 1 分（可完成但质量异常）：${item.s1}
- 0 分（无法完成）：${item.s0}

请仔细观察这些帧中孩子的动作质量，严格对照上面的评分锚点，客观判读该项得分。若画面不足以判断，score 用 null。
你必须只返回以下 JSON（不要任何额外文字或\`\`\`标记）：
{
  "score": 0或1或2或null,
  "observation": "结合观察要点，用 60-120 字客观描述你在画面中看到的动作表现与评分理由",
  "flags": ["从以下键中选出观察到的异常，没有则空数组：tremor(震颤/抖动), assoc(联合动作/镜像), comp(代偿动作), worseL(左侧较差), worseR(右侧较差)"]
}`;

    try {
      const result = await callQwenVision(frames, prompt);
      const validScore = result.score === 0 || result.score === 1 || result.score === 2 ? result.score : null;
      const validFlags = Array.isArray(result.flags)
        ? result.flags.filter((f: any) => ['tremor', 'assoc', 'comp', 'worseL', 'worseR'].includes(f))
        : [];
      res.json({
        score: validScore,
        observation: typeof result.observation === 'string' ? result.observation : '',
        flags: validFlags,
        isAiGenerated: true,
        model: QWEN_VL_MODEL
      });
    } catch (aiErr: any) {
      console.warn('Motion-eval VL analysis failed, frontend will keep manual scoring:', aiErr.message);
      res.json({ score: null, isAiGenerated: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown motion evaluation error.' });
  }
});

// API endpoint for CPMV-20 overall narrative report (qwen3.7-max) once items are scored
tier2Only.post('/api/motion-report', async (req: express.Request, res: express.Response) => {
  try {
    const { child, total, domains, flags, lowItems } = req.body;
    if (await rejectIfLocked(req, res, MOTION_DIMENSION_ID)) return;
    if (!total || typeof total.pct !== 'number') {
      res.status(400).json({ error: 'Missing motion assessment totals.' });
      return;
    }

    const domainStr = Array.isArray(domains)
      ? domains.map((d: any) => `- ${d.name}: ${d.pct === null ? '未测' : d.pct + '%'}`).join('\n') : '';
    const flagStr = Array.isArray(flags) && flags.length
      ? flags.map((f: any) => `${f.label}（第${(f.items || []).join('、')}项）`).join('；')
      : '未标记明显异常运动表现';
    const ageInfo = child ? `${child.ageMonth}个月${child.gender === 'boy' ? '男' : '女'}童` : '受评儿童';

    const systemInstruction = 'You are a compassionate pediatric cerebral-palsy rehabilitation specialist. You strictly return output as a single valid JSON block, no markdown codeblocks, in Chinese.';
    const prompt = `你是一位资深小儿脑瘫康复评估治疗师。以下是一名${ageInfo}的「脑瘫儿童动作影像筛查(CPMV-20)」结果，请据此撰写专业、温暖、实操性强的观察摘要与训练建议。

总体：完成 ${total.tested}/20 项，实测总分 ${total.sum}/${total.max}，得分率 ${total.pct}%。
五维得分率：
${domainStr}
异常运动表现：${flagStr}
${Array.isArray(lowItems) && lowItems.length ? `得分偏低(0-1分)项目编号：${lowItems.join('、')}` : ''}

请只返回以下JSON（不要额外文字或\`\`\`标记）：
{
  "summary": ["观察摘要，3-5条，每条聚焦一个发现（受限领域/异常表现/偏侧性/发育顺序等），结合脑瘫康复专业视角，语气温暖客观"],
  "suggestions": ["训练与随访建议，3-5条，具体可操作，可提及GMFM/OT/PT专项、AI影像补拍要点、复评节奏"]
}`;

    try {
      const { report, aiEngine } = await generateReportJSON(systemInstruction, prompt);
      res.json({
        summary: Array.isArray(report.summary) ? report.summary : [],
        suggestions: Array.isArray(report.suggestions) ? report.suggestions : [],
        isAiGenerated: true,
        aiEngine
      });
    } catch (aiErr: any) {
      console.warn('Motion-report narrative failed, frontend will use local template:', aiErr.message);
      res.json({ isAiGenerated: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown motion report error.' });
  }
});

// Fallback advanced diagnostic engine for Language and Communication
function generateFallbackLanguageReport(
  child: any,
  targetPrompt: string,
  audioTranscribedText: string,
  articulation: string,
  fluency: string,
  sentenceLength: string
) {
  let condition = '发育性言语障碍-构音发育延迟';
  let pathMessage = `针对儿童【${child.name}】（${child.ageMonth}个月，${child.gender === 'boy' ? '男孩' : '女孩'}）的言语和构音功能深度评估。孩子在拼读测试“${targetPrompt}”时发音为“${audioTranscribedText || '(未记录发音)'}”。`;

  if (articulation.includes('辅音置换') || articulation.includes('省略')) {
    condition = '构音器官运动规划不佳 (辅音发音位置代偿性前移延迟)';
    pathMessage += `
临床脑神经言语学评估表明：受测儿在舌面后音（如 g, k）与舌尖前音（如 d, t）的运动支配规划上存在反馈滞后。儿童言语听觉传导带（Temporal Auditory Zone）对高频辅音音素的编码感知度完好，但 Broca 言语区在大脑下运动皮质向下颌、舌肌群下达动作脉冲时，空间控制不够精细。表现为舌根部肌肉上抬力线不稳，出现代偿性的舌尖前音置换发音。建议进行定向口肌抗阻与唇舌尖脱敏刺激。`;
  } else if (fluency.includes('连复') || fluency.includes('卡顿')) {
    condition = '儿童发育性不流畅 (口吃倾向与韵律传导受限)';
    pathMessage += `
言语声谱特征表明：患儿在言语声带起动阶段（Speech onset period）存在一过性气流控制失衡。由于言语运动区与脊髓前角细胞呼吸反馈存在轻微的时间不匹配，患儿在脑部产生词汇概念后，急于输出，导致声带在吸气末期过度扣紧，无法顺畅吐出首字。这常伴随情绪上的轻度应激性焦虑。建议采用“慢速起音法”及舒缓呼吸疗法，减少家长催促等负面心理干扰。`;
  } else if (sentenceLength.includes('单字') || sentenceLength.includes('无句法')) {
    condition = '表达性语言迟缓 (语义词汇及语法结构发育偏后)';
    pathMessage += `
神经网络评估反映：儿童处于典型的主动语篇词汇组织滞后状态。其理解性语言（言语解码区 Wernicke）能听懂日常指令，但表达性语言（言语编码区 Broca）中，由于工作记忆（Working Memory）存储容量较小，无法短时间内在线组装多级语法树。主要停留在以“单字”或“电报词”表达核心需求的阶段。需要高频的“双词句扩张”及声画情境强化。`;
  } else {
    condition = '轻度发育性音素转换延迟 (预后良性过渡阶段)';
    pathMessage += `
经脑功能多维言语测绘，患儿当前的构音肌肉反馈、构音规划、声气协调度均在正常可塑范围。个别复杂辅音拼读（如翘舌音、擦音）的轻微模糊属于3-4岁发育期常见生理现象。脑突触剪切与微电流传输极具潜力，建议在家庭陪伴中增加高频辅音对指纠音游戏。`;
  }

  return {
    speechPathology: pathMessage.trim(),
    diagnosedCondition: `${child.ageMonth}个月儿童：${condition}`,
    acousticProfile: {
      pitchAnalysis: `检测声带闭合弹性，基频 F0 平均在 285Hz 左右，发声力度均匀度可塑，声门下压在构音重音处有轻度偏窄。`,
      speechRate: `检测得出发声时间 1.4 秒。拼读语速约为 ${fluency.includes('卡顿') || fluency.includes('连复') ? '45' : '82'} 字/分钟，相较于同龄均值（约 90-110 字/分钟）显现${fluency.includes('卡顿') || fluency.includes('连复') ? '明显节律停滞，阻碍率约 18%' : '轻微词汇获取迟缓或普通流畅'}。`,
      resonance: `口腔共鸣正常。${articulation.includes('鼻音') ? '伴随有轻微的鼻腔共鸣漏气或腭咽闭合不足，导致清晰度下降 12%' : '下颌下拉幅度略窄，致使唇齿爆破音共鸣区受阻，音调略呈闭锁型'}。`
    },
    interventionGoals: [
      `【构音肌肉运动】每日进行10分钟口唇抗阻训练（如吹气、舌尖抵硬腭、吹肥皂泡等）以提升下颌关节张力。`,
      `【言语听觉联动】使用森心康定制慢语速法（120字/分钟）进行绘本故事跟读，每次 15 分钟，纠正辅音脱失。`,
      `【语法表达拉伸】采用双词组合扩展法（如：孩子说“苹果”，家长扩展为“吃大苹果”或“红色的苹果”），每日循环5组。`
    ],
    slpExercises: [
      {
        day: "第 1-2 天",
        target: "构音器官（唇舌肌张力）协调激活",
        exercise: "【舌尖点触操】：在儿童上唇、下唇以及上齿龈处涂抹少许酸奶或果酱，引导儿童自主用舌尖舔舐。再配合“呼气吹乒乓球”游戏，在桌面上放置3个小乒乓球，引导儿童张大口、深呼吸并猛烈吹气，每次5个回合。",
        duration: "10分钟 / 每日2次",
        tips: "吹气时注意儿童双肩保持放松，不要耸肩耸颈，保持唇部收紧成圆形。"
      },
      {
        day: "第 3-4 天",
        target: "特定音素“后/前音”构音位置矫正与阻力诱导",
        exercise: "【软腭抬高与低头构音】：针对g/k不分、读成d/t的儿童，让其稍微后仰头部，口含少许温水进行‘咕噜咕噜’漱口游戏。随后，让其尝试发出‘g-g-g’（嗝）的声音，通过声腔物理阻力和重力，协助舌根部上抬、接触软腭。",
        duration: "15分钟 / 每日1次",
        tips: "切勿强行责备患儿发音不准，通过好玩的‘嗝嗝小怪兽’角色扮演降低其抗拒情绪。"
      },
      {
        day: "第 5-7 天",
        target: "双词句/语法树多级扩展交互强化",
        exercise: "【实物选择与情境句子拉伸】：准备孩子喜爱的苹果、饼干、玩具汽车。第一步，让孩子指着说出名称（‘苹果’）；第二步，家长追问‘谁要吃苹果？’，引导发出‘宝宝吃’；第三步，扩展为‘宝宝吃苹果’。以此多级拉伸言语 Broca 中枢的工作记忆负荷。",
        duration: "200分钟 / 每日1次",
        tips: "当孩子说出三字短句后，给予非常夸张的正向肢体鼓励（如大力击掌、拥抱），重建其开口自信。"
      }
    ],
    parentGuidance: "首要建议家长克服自身急躁心理，严格控制患儿使用平板电脑、手机的时长（每日不超20分钟）。用极具眼神交汇、温柔对视、夸张口型、语速放慢一半的日常对话，取代命令式的提问。在舒适宽松且充满暖意的家庭语境中，滋润并唤醒儿童的言语皮层神经网络。"
  };
}

// API endpoint for deep language evaluation with Alibaba Qwen models
tier2Only.post('/api/ali-language-eval', async (req: express.Request, res: express.Response) => {
  try {
    const { child, audioTranscribedText, articulation, fluency, sentenceLength, targetPrompt } = req.body;

    // This endpoint only ever produces the language deep report, so it gates on
    // the language dimension — not on whatever the caller claims to own.
    if (await rejectIfLocked(req, res, LANGUAGE_DIMENSION_ID)) return;
    if (!child) {
      res.status(400).json({ error: 'Missing child profile.' });
      return;
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.ALI_LLM_API_KEY;
    let isAiGenerated = false;
    let evalReport;

    const langSystemPrompt = 'You are a compassionate pediatric speech-language pathologist and neurology expert. You strictly return output as a single, valid JSON block with no markdown code blocks, no front/end spacing, in Chinese language.';

    // Build the prompt regardless of engine
    const prompt = `请针对以下受评儿童的语言样本和临床发音构音障碍特征，进行深度脑神经语言学评估，并输出结构化儿童SLP诊疗报告：
儿童档案:
- 姓名: ${child.name}
- 年龄: ${child.ageMonth}个月
- 性别: ${child.gender === 'boy' ? '男孩' : '女孩'}

言语测试设定:
- 目标说词/说句模板: "${targetPrompt}"
- 儿童实际开口录制转录: "${audioTranscribedText || '(无转录，仅凭物理特征评估)'}"

临床听觉/视觉测绘观察特征:
- 发音清晰度 (Articulation): ${articulation}
- 口齿流畅度 (Fluency): ${fluency}
- 平均句子长度 (Syntactic complexity/MLU): ${sentenceLength}

请结合儿童的发育月龄，给出极度专业、充满厚爱、科学严谨的评估分析。
你必须严格返回以下JSON Schema格式的对象，不要夹杂任何额外的文字，不要夹杂 \`\`\`json 标记，确保可以被JSON.parse完美解析：
{
  "speechPathology": "从脑部颞叶言语中枢与构音肌张力角度，对儿童在该发音中的阻尼和剪裁异常进行病理机制深度剖析（150-250字）。",
  "diagnosedCondition": "一句话判定其言语障碍分类诊断名（例如：3岁儿童发育性言语障碍-构音延迟）及目前的发育分级。",
  "acousticProfile": {
    "pitchAnalysis": "声带声学频带振动分析及声学阻抗说明（60-100字）。",
    "speechRate": "说明儿童发音时间，推算当前语速并对比同龄标准（60-100字）。",
    "resonance": "判断是否存在异常共振（如软腭控制不佳导致的鼻腔漏气或口腔紧闭音，60-100字）。"
  },
  "interventionGoals": [
    "近期干预目标1（如口唇肌张力激活）",
    "近期干预目标2（如特定塞音/擦音舌位拉伸）",
    "近期干预目标3（如语法短句双向扩展）"
  ],
  "slpExercises": [
    {
      "day": "第1-2天",
      "target": "阶段训练一目标",
      "exercise": "具体游戏化操练步骤设计，指导家长协助儿童发音",
      "duration": "操练时间",
      "tips": "重点注意事项"
    },
    {
      "day": "第3-4天",
      "target": "阶段训练二目标",
      "exercise": "具体游戏化操练步骤设计",
      "duration": "操练时间",
      "tips": "重点注意事项"
    },
    {
      "day": "第5-7天",
      "target": "阶段训练三目标",
      "exercise": "具体游戏化操练步骤设计",
      "duration": "操练时间",
      "tips": "重点注意事项"
    }
  ],
  "parentGuidance": "舒缓抚养人心理情绪压力，提供关于语言刺激环境赋能（如慢速伴读、声画互联）的资深SLP指导意见。"
}`;

    // Engine 1: Qwen 3.5 Plus via SDK (primary)
    try {
      evalReport = await callLLMJSON(langSystemPrompt, prompt, LLM_QWEN_MODEL);
      isAiGenerated = true;
    } catch (qwenSdkErr: any) {
      console.warn(`Qwen SDK language eval failed, trying Doubao:`, qwenSdkErr.message);

      // Engine 2: Doubao Seed via SDK (secondary)
      try {
        evalReport = await callLLMJSON(langSystemPrompt, prompt, LLM_REPORT_MODEL);
        isAiGenerated = true;
      } catch (sdkErr: any) {
        console.warn(`Doubao SDK language eval also failed:`, sdkErr.message);
      }
    }

    if (!evalReport) {
      evalReport = generateFallbackLanguageReport(child, targetPrompt, audioTranscribedText, articulation, fluency, sentenceLength);
      isAiGenerated = false;
    }

    res.json({
      report: evalReport,
      isAiGenerated,
      createdAt: new Date().toISOString()
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown deep language evaluation error.' });
  }
});

// API endpoint for real speech recognition via Qwen3-ASR-Flash
tier2Only.post('/api/asr', async (req: express.Request, res: express.Response) => {
  try {
    const { audioData, context, dimensionId } = req.body;
    // Transcription is a utility used inside several already-gated flows rather
    // than a per-dimension product, so it keeps the caller-supplied id. Residual
    // exposure, stated plainly: owning any one dimension buys transcription in
    // general. That costs DashScope quota, not paid content — every report this
    // could feed is gated on its own dimension above.
    if (await rejectIfLocked(req, res, dimensionId)) return;
    if (!audioData || typeof audioData !== 'string') {
      res.status(400).json({ error: 'Missing audioData (base64 data URL or public audio URL).' });
      return;
    }

    const key = getDashScopeKey();
    if (!key) {
      res.status(503).json({ error: 'DASHSCOPE_API_KEY is not configured, real speech recognition unavailable.' });
      return;
    }

    // Note: qwen3-asr-flash rejects plain-text system messages ("does not support this input"),
    // so the `context` field from the client is accepted but not forwarded.
    void context;
    const messages: any[] = [{
      role: 'user',
      content: [{ type: 'input_audio', input_audio: { data: audioData } }]
    }];

    const resp = await postDashScope(key, { model: QWEN_ASR_MODEL, messages });

    if (resp.status < 200 || resp.status >= 300) {
      const errText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      res.status(502).json({ error: `Qwen ASR request failed (${resp.status}): ${errText.slice(0, 300)}` });
      return;
    }

    const raw = resp.data;
    const message = raw.choices?.[0]?.message;
    const text = typeof message?.content === 'string'
      ? message.content
      : Array.isArray(message?.content)
        ? message.content.map((c: any) => c.text || '').join('')
        : '';
    const audioInfo = Array.isArray(message?.annotations)
      ? message.annotations.find((a: any) => a.type === 'audio_info')
      : null;

    res.json({
      text: text.trim(),
      language: audioInfo?.language || null,
      emotion: audioInfo?.emotion || null,
      model: QWEN_ASR_MODEL
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unknown ASR error.' });
  }
});

// MySQL (Alibaba Cloud RDS) integration
// mysqlDb imported at top of file

// Offline-mode fallback in-memory datastore (used when MySQL is unavailable)
//
// 以**使用者 id** 為鍵：孩子檔案與分數認的是帳號本身，登入方式怎麼變都不關
// 它的事 —— 電子郵件下線的這一次，這張表一個字都不必動。
//
// #27 之後**沒有任何一條路會在記憶體裡建帳號**：登入只剩手機號，而那條路徑
// 沒有記憶體模式（寫不進資料庫就明確失敗，見 `/api/auth/sms/verify`）。
// 這張表因此只剩一個用途：已登入的家長遇上資料庫暫時寫不進去時的熱備份。
const offlineUserData = new Map<UserId, any>();

// Bookings taken while MySQL is unconfigured. Lost on restart — acceptable for
// demos, NOT for production: a real booking that vanishes is a parent left
// waiting for a call. The response tells the client which mode it landed in.
const offlineBookings: any[] = [];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs);
    promise.then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

app.get('/api/db/status', (req, res) => {
  res.json({
    configured: mysqlDb.isConfigured(),
    engine: mysqlDb.isConfigured() ? 'mysql' : 'memory',
  });
});

/**
 * Dimensions this user has paid to unlock. The paywall reads this; it is the
 * only source of truth for access, never anything the client stores.
 */
paidOnly.get('/api/unlocks', async (req, res) => {
  try {
    // The store check comes before the token check on purpose. In memory mode
    // there is no gate at all (denyIfLocked lets everything through), so a 401
    // here would leave the client unable to learn that — it would fail closed
    // and lock a demo box out of its own deep assessment. Saying "this server
    // keeps no purchases" leaks nothing.
    // `available: false` is the frontend's cue that no purchase can gate anything
    // here, so the paywall renders with its skip entry. Two different reasons
    // produce it — no durable store, or the demo switch — and neither one lets a
    // 401 happen first, because a client that cannot ask is a client that fails
    // closed and locks a demo box out of its own deep assessment.
    if (!mysqlDb.isConfigured() || PAYWALL_DEMO_OPEN) {
      res.json({ dimensionIds: [], t2: false, available: false, priceFen: UNLOCK_PRICE_FEN });
      return;
    }
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: '请先登录。' });
      return;
    }
    const user = await findSessionUser(userId);
    if (!user) {
      res.status(401).json({ error: '登录状态已失效，请重新登录。' });
      return;
    }
    // The price ships with the list so the paywall never hardcodes its own copy
    // of it. UNLOCK_PRICE_FEN is env-tunable; a screen showing ¥19.9 while the
    // order is opened for something else is a refund dispute by construction.
    res.json({
      // Two products in one response. `dimensionIds` is the old per-dimension T3
      // list; `t2` is the whole-of-T2 entitlement (#45). They are separate keys
      // rather than one merged list because merging them is exactly how a t3
      // purchase would start opening T2.
      dimensionIds: await mysqlDb.listUnlockedDimensions(user.id),
      t2: await mysqlDb.hasT2Unlock(user.id),
      available: true,
      priceFen: UNLOCK_PRICE_FEN,
    });
  } catch (err: any) {
    console.error('[Payment] Failed to list unlocks:', err.message);
    res.status(500).json({ error: '无法读取已解锁维度。' });
  }
});

/**
 * Opens a pending payment for one dimension and returns the merchant order
 * number. Placing the actual WeChat order is stage 3-4 and is blocked on ICP
 * filing plus the mchid — and on the still-open H5-vs-JSAPI choice.
 *
 * There is deliberately NO endpoint that settles a payment. The only legitimate
 * triggers are a signature-verified WeChat callback and the query-order
 * compensation path; exposing anything else would hand out paid content for
 * free to whoever found the URL.
 */
paidOnly.post('/api/payment/create', async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: '请先登录后再购买。' });
      return;
    }
    // `scope` says what is being bought. Absent means the old shape (a dimension
    // and nothing else) — treated as t3, which is both the previous behaviour and
    // the conservative side: a request that forgets to say what it wants must not
    // end up buying the bigger product.
    const { scope: rawScope, dimensionId } = req.body || {};
    if (rawScope !== undefined && rawScope !== 't2' && rawScope !== 't3') {
      res.status(400).json({ error: '购买范围不正确。' });
      return;
    }
    const scope: UnlockScope = rawScope === 't2' ? 't2' : 't3';
    if (scope === 't3' && !DIMENSIONS_DATA.some(d => d.id === dimensionId)) {
      res.status(400).json({ error: '维度不存在。' });
      return;
    }
    if (!mysqlDb.isConfigured()) {
      // Taking money without a durable order record is not a degraded mode, it
      // is a refund dispute waiting to happen. Refuse.
      res.status(503).json({ error: '支付服务暂未开放，请稍后再试。' });
      return;
    }

    const user = await findSessionUser(userId);
    if (!user) {
      res.status(401).json({ error: '登录状态已失效，请重新登录。' });
      return;
    }

    // Already owned → do not create another order. A parent who taps twice, or
    // returns to an old paywall page, must not be able to pay for the same thing
    // a second time. Asked per scope: holding a dimension's T3 says nothing about
    // whether T2 has been bought.
    const owned = scope === 't2'
      ? await mysqlDb.hasT2Unlock(user.id)
      : (await mysqlDb.listUnlockedDimensions(user.id)).includes(dimensionId);
    if (owned) {
      res.json({ alreadyUnlocked: true });
      return;
    }

    const outTradeNo = generateOutTradeNo();
    if (!isValidOutTradeNo(outTradeNo)) {
      // Can only fire if the generator is changed badly; failing here beats
      // failing at WeChat's door with the parent mid-payment.
      throw new Error(`generated out_trade_no violates the official contract: ${outTradeNo}`);
    }
    // T2 stores no dimension at all. Putting a placeholder one here would make
    // the reconciliation report show a purchase of something nobody sold.
    const paidDimensionId = scope === 't2' ? null : (dimensionId as string);
    const paymentId = await mysqlDb.createPayment({
      userId: user.id,
      outTradeNo,
      amountFen: UNLOCK_PRICE_FEN,
      scope,
      dimensionId: paidDimensionId,
    });

    // Credentials missing → the order row exists but there is nothing to pay
    // with. Say so; the client must never read this as success.
    if (!wechatPayStatus.config) {
      res.json({
        alreadyUnlocked: false, outTradeNo, paymentId, amountFen: UNLOCK_PRICE_FEN,
        scope, dimensionId: paidDimensionId,
        wechatReady: false,
        reason: `微信支付尚未配置：缺少 ${wechatPayStatus.missing.join('、')}`,
      });
      return;
    }

    if (PAY_TRADE_TYPE === 'jsapi') {
      // The seam, held open honestly. Ordering works; obtaining the payer's
      // openid (OAuth web authorization) does not exist yet, and inventing one
      // would just move the failure to WeChat's door with the parent mid-payment.
      res.status(501).json({
        error: 'JSAPI 支付尚未实装（需先完成网页授权取得 openid）。',
        code: 'JSAPI_NOT_IMPLEMENTED',
      });
      return;
    }

    const dimensionName = DIMENSIONS_DATA.find(d => d.id === dimensionId)?.name || dimensionId;
    // What the parent will see on the WeChat payment sheet.
    const orderDescription = scope === 't2'
      ? '森心康 深度评估解锁'
      : `森心康 ${dimensionName} 深度评估解锁`;
    // H5 requires the payer's real IP. Behind nginx this is the X-Forwarded-For
    // hop we already trust (app.set('trust proxy', 1)).
    const payerClientIp = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');

    const order = await wechatPay.placeOrder(wechatPayStatus.config, 'h5', {
      description: orderDescription,
      outTradeNo,
      amountFen: UNLOCK_PRICE_FEN,
      payerClientIp,
    });

    res.json({
      alreadyUnlocked: false,
      outTradeNo,
      paymentId,
      amountFen: UNLOCK_PRICE_FEN,
      scope,
      dimensionId: paidDimensionId,
      wechatReady: true,
      tradeType: 'h5',
      // 有效期只有 5 分鐘 —— 前端拿到就該立刻跳轉，不可存起來重用。
      h5Url: order.h5Url,
    });
  } catch (err: any) {
    console.error('[Payment] Failed to create payment:', err.message);
    res.status(500).json({ error: '创建订单失败，请稍后重试。' });
  }
});

/**
 * Settles one payment and grants the unlock. The single place entitlements are
 * ever created from a payment — both the callback and the query-order
 * compensation path funnel through here.
 *
 * Idempotency lives in markPaymentSuccess's conditional UPDATE
 * (`WHERE status = 'pending'`): WeChat retries a callback up to 15 times and the
 * return page fires a query on top of that, so several racing paths will try to
 * settle the same order. Only the one that actually moved the row wins; everyone
 * else sees affectedRows = 0 and must not grant anything.
 */
async function settlePayment(outTradeNo: string, transactionId: string | null): Promise<'granted' | 'already' | 'unknown'> {
  const payment = await mysqlDb.findPaymentByOutTradeNo(outTradeNo);
  if (!payment) {
    console.error(`[Payment] Settlement for an unknown order: ${outTradeNo}`);
    return 'unknown';
  }
  const moved = await mysqlDb.markPaymentSuccess(outTradeNo, transactionId);
  if (!moved) return 'already';

  // Anything that is not literally 't2' settles as a dimension purchase — the
  // shape every row had before #45, and the one that grants less.
  const scope: UnlockScope = payment.scope === 't2' ? 't2' : 't3';
  await mysqlDb.grantUnlock({
    userId: payment.user_id,
    scope,
    dimensionId: scope === 't2' ? null : payment.dimension_id,
    source: 'payment',
    paymentId: payment.id,
  });
  console.log(`[Payment] Unlocked ${scope === 't2' ? '整份 T2' : payment.dimension_id} for user ${payment.user_id} (${outTradeNo})`);
  return 'granted';
}

/**
 * WeChat Pay result callback.
 *
 * On `paidOnly` like the rest of payments: project B never submits a notify_url,
 * so no callback can legitimately arrive there, and an endpoint that can only
 * ever receive forgeries has no business existing on the box handed to the
 * partner company. Same rule as the tier-2/3 routes — don't register what the
 * product doesn't have.
 *
 * Order of operations is not negotiable — verify, then decrypt. Decrypting first
 * means feeding unverified ciphertext to the cipher.
 *
 * Answering within 5 seconds is a hard requirement (WeChat retries otherwise),
 * which is why the reply goes out before the entitlement work.
 */
paidOnly.post('/api/pay/wechat/notify', async (req: any, res) => {
  const fail = (status: number, why: string) => {
    console.error(`[Payment] Callback rejected: ${why}`);
    res.status(status).json({ code: 'FAIL', message: '失败' });
  };

  if (!wechatPayStatus.config) return fail(503, 'WeChat Pay is not configured on this deployment');

  const signature = String(req.headers['wechatpay-signature'] || '');
  const timestamp = String(req.headers['wechatpay-timestamp'] || '');
  const nonce = String(req.headers['wechatpay-nonce'] || '');
  const serial = String(req.headers['wechatpay-serial'] || '');
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';

  if (!signature || !timestamp || !nonce || !rawBody) return fail(400, 'missing signature headers or body');

  // Wechatpay-Serial identifies WeChat's key, not ours. A mismatch means their
  // key rotated and ours is stale — rejecting makes them retry, which is the
  // correct outcome, and it stops us from verifying against the wrong key.
  if (serial && wechatPayStatus.config.platformKeyId && serial !== wechatPayStatus.config.platformKeyId) {
    return fail(401, `Wechatpay-Serial ${serial} does not match the configured public key id`);
  }

  const verified = wechatPay.verifyCallbackSignature({
    timestamp, nonce, rawBody, signature,
    publicKey: wechatPayStatus.config.platformPublicKey,
  });
  if (!verified.ok) return fail(401, verified.reason || 'signature verification failed');

  let decrypted: any;
  try {
    const body = JSON.parse(rawBody);
    if (body.event_type !== 'TRANSACTION.SUCCESS') {
      // Not a success event — acknowledge so WeChat stops retrying, do nothing.
      console.log(`[Payment] Callback ignored, event_type=${body.event_type}`);
      res.status(204).end();
      return;
    }
    decrypted = JSON.parse(wechatPay.decryptResource(wechatPayStatus.config.apiV3Key, body.resource));
  } catch (err: any) {
    return fail(400, `decrypt failed: ${err.message}`);
  }

  const outTradeNo = decrypted?.out_trade_no;
  const tradeState = decrypted?.trade_state;
  if (!outTradeNo) return fail(400, 'decrypted payload has no out_trade_no');

  // Acknowledge first: the 5-second budget is for receipt, not for our
  // bookkeeping. If the grant below fails, the query-order path recovers it.
  res.status(204).end();

  if (tradeState !== 'SUCCESS') {
    console.log(`[Payment] ${outTradeNo} callback trade_state=${tradeState}, nothing granted`);
    return;
  }
  try {
    await settlePayment(outTradeNo, decrypted?.transaction_id ?? null);
  } catch (err: any) {
    console.error(`[Payment] Settlement failed for ${outTradeNo}: ${err.message}`);
  }
});

/**
 * Query-order compensation.
 *
 * Callbacks are not guaranteed: a deploy, a network blip or a bad notify_url and
 * the parent has paid with nothing to show. This asks WeChat directly and is the
 * only other path allowed to grant an unlock — note it takes no state from the
 * client beyond an order number it must already own.
 */
paidOnly.get('/api/payment/status', async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: '请先登录。' });
      return;
    }
    const outTradeNo = typeof req.query.outTradeNo === 'string' ? req.query.outTradeNo : '';
    if (!outTradeNo || !isValidOutTradeNo(outTradeNo)) {
      res.status(400).json({ error: '订单号格式不正确。' });
      return;
    }
    if (!mysqlDb.isConfigured()) {
      res.status(503).json({ error: '支付服务暂未开放。' });
      return;
    }

    const user = await findSessionUser(userId);
    const payment = await mysqlDb.findPaymentByOutTradeNo(outTradeNo);
    // Only the owner may ask. Otherwise the endpoint becomes an oracle for
    // anyone guessing order numbers.
    if (!user || !payment || payment.user_id !== user.id) {
      res.status(404).json({ error: '订单不存在。' });
      return;
    }

    if (payment.status === 'success') {
      res.json({ outTradeNo, status: 'success', scope: payment.scope ?? 't3', dimensionId: payment.dimension_id });
      return;
    }
    if (!wechatPayStatus.config) {
      res.json({ outTradeNo, status: payment.status, wechatReady: false });
      return;
    }

    const remote = await wechatPay.queryOrderByOutTradeNo(wechatPayStatus.config, outTradeNo);
    if (remote.tradeState === 'SUCCESS') {
      await settlePayment(outTradeNo, remote.transactionId);
      res.json({ outTradeNo, status: 'success', scope: payment.scope ?? 't3', dimensionId: payment.dimension_id });
      return;
    }
    res.json({ outTradeNo, status: payment.status, tradeState: remote.tradeState });
  } catch (err: any) {
    console.error('[Payment] Status query failed:', err.message);
    res.status(500).json({ error: '查询订单状态失败。' });
  }
});

/**
 * 家長端的專家名單 —— **只回他所屬公司的專家**。
 *
 * 回應刻意用一個明確的 `reason` 說明「為什麼是空的」，而不是回一個空陣列讓
 * 前端自己猜。三種空法在畫面上要長得不一樣：
 *   - `unassigned`：這位家長沒有歸屬，任何一家公司的專家都不該出現在他眼前
 *   - `none_configured`：他的公司還沒設定專家，這是公司的待辦，不是系統故障
 *   - `unavailable`：這個部署沒有資料庫（展示站），談不上專家名單
 */
app.get('/api/specialists', async (req, res) => {
  try {
    if (!mysqlDb.isConfigured()) {
      res.json({ specialists: [], reason: 'unavailable' });
      return;
    }
    const userId = currentUserId(req);
    if (!userId) {
      // 未登入就沒有歸屬可言。與「未歸屬」回同一種結果 —— 兩者都不該看到任何公司的專家。
      res.json({ specialists: [], reason: 'unassigned' });
      return;
    }
    const user = await withTimeout(findSessionUser(userId), 2000).catch(() => null);
    const companyId = user?.company_id ?? null;
    if (companyId === null) {
      res.json({ specialists: [], reason: 'unassigned' });
      return;
    }
    const specialists = await withTimeout(mysqlDb.listActiveSpecialists(Number(companyId)), 2000);
    res.json({
      specialists,
      reason: specialists.length ? 'ok' : 'none_configured',
    });
  } catch (err: any) {
    console.error('[Specialists] Lookup failed:', err.message);
    res.status(500).json({ error: '读取专家名单失败。' });
  }
});

/**
 * 這家合作公司的 LOGO —— 家長端頁首與登入卡那顆方塊要畫什麼（專案 B 專屬）。
 *
 * **公開，不需要登入。** 那顆方塊在登入畫面上就要出現，而那時候還沒有帳號可查。
 * 唯一的線索是進站連結上的 `?c=<識別碼>`（前端記在 localStorage，見
 * `src/utils/attribution.ts`），由呼叫端當查詢參數帶過來。
 *
 * 【只回 LOGO，不回公司名稱】
 * 識別碼印在傳單上、貼在轉發的訊息裡，任何人都拿得到，所以這條路徑的輸出
 * 等於對外公開。家長端**不顯示合作公司名稱**是既有的產品決定（見
 * `deploy/schema.sql` 的 `companies.name` 註解），這裡多回一個欄位就等於
 * 悄悄推翻它。資料層那一句也只 SELECT `logo_url` 一欄。
 *
 * 【永遠回 200，用 `reason` 說明】
 * 呼叫端在任何情況下都畫得出東西（取不到就用建置內建的字標），所以「查不到」
 * 不是錯誤。但也不能只回一個空值讓前端自己猜 —— 同 `/api/specialists`，
 * 回應永遠帶一個明確的 `reason`，「為什麼沒顯示」才有得查：
 *
 *   ok              這家公司設了 LOGO
 *   no_slug         請求沒帶識別碼（家長從乾淨連結或書籤進來）
 *   bad_slug        識別碼格式不對
 *   unavailable     這個部署沒有資料庫
 *   unknown         查無此識別碼，或那家公司已停用
 *   not_configured  公司在，但還沒設 LOGO
 */
multiCompanyOnly.get('/api/company-brand', async (req, res) => {
  const done = (logoUrl: string | null, reason: string) => res.json({ logoUrl, reason });
  try {
    const raw = req.query.c;
    const slug = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!slug) return done(null, 'no_slug');
    // 形狀不對的一律不查資料庫。這是一條公開路徑，每一次查詢都是別人可以
    // 免費叫我們做的工 —— 與 `/r/:token` 同一個處置。
    if (!isValidCompanySlug(slug)) return done(null, 'bad_slug');
    if (!mysqlDb.isConfigured()) return done(null, 'unavailable');

    const logoUrl = await withTimeout(mysqlDb.findCompanyLogoBySlug(slug), 2000);
    if (logoUrl === null) {
      // 查無此公司與「公司在但沒設 LOGO」在資料層長得一樣（都是 null）。
      // 對呼叫端來說結果相同（畫字標），所以不為了分辨它們再查一次。
      return done(null, 'unknown_or_not_configured');
    }
    return done(logoUrl, 'ok');
  } catch (err: any) {
    // 這一頁是裝飾，不該因為資料庫慢就讓家長看到錯誤。記在日誌，畫面退回字標。
    console.error('[CompanyBrand] Lookup failed:', err.message);
    return done(null, 'unavailable');
  }
});

/**
 * Expert consultation booking. Registered in both products — the booking flow
 * lives in the shared AnalysisReport, and it is project B's entire conversion
 * point (B has no paid tier; the consultation list IS the deliverable).
 *
 * Until now the frontend only flipped a local flag to "success", so a parent was
 * told an expert would call and nobody ever heard about it. This persists the
 * booking first, then notifies staff best-effort.
 */
app.post('/api/expert-booking', async (req, res) => {
  try {
    const {
      specialistId, specialistName, parentName, parentPhone,
      childAgeMonth, childGender, reportSummary, preferredSlot, deviceId, serviceType,
    } = req.body || {};

    const name = typeof parentName === 'string' ? parentName.trim() : '';
    const phone = typeof parentPhone === 'string' ? parentPhone.trim() : '';

    if (!specialistId || typeof specialistId !== 'string') {
      res.status(400).json({ error: '缺少指定专家。' });
      return;
    }
    /**
     * 四種服務中的哪一種（issue #21）。
     *
     * 沒帶就是既有的線上諮詢說明 —— 還沒更新的家長端建置不送這個欄位，
     * 拒絕它會讓專案 B 唯一的轉換點在部署當下停擺。
     *
     * 但**認不得就 400，不猜**。悄悄落回預設值的話，一筆該是線下訓練的預約
     * 會存成線上諮詢，客服照著線上的流程回電，家長在機構門口等，
     * 而從頭到尾沒有任何一個畫面看得出這個落差。
     */
    const service = readServiceType(serviceType);
    if (service === null) {
      res.status(400).json({ error: '无法辨识的服务类型。' });
      return;
    }
    if (!name || name.length > 64) {
      res.status(400).json({ error: '请填写家长姓名。' });
      return;
    }
    // Mainland mobile number. Staff call this back, so a malformed one is a
    // dead booking — reject at the door rather than storing garbage.
    if (!PHONE_PATTERN.test(phone)) {
      res.status(400).json({ error: '请填写正确的 11 位手机号码。' });
      return;
    }

    const ageMonth = Number.isFinite(Number(childAgeMonth)) ? Number(childAgeMonth) : null;
    const summary = typeof reportSummary === 'string' ? reportSummary.slice(0, 2000) : null;
    const slot = typeof preferredSlot === 'string' ? preferredSlot.slice(0, 64) : null;

    // Resolve the signed-in user when a token is present. Project B is
    // anonymous, so absence of a token is normal, not an error.
    let userId: number | null = null;
    const sessionUserId = currentUserId(req);
    if (sessionUserId) {
      const user = await findSessionUser(sessionUserId).catch(() => null);
      if (user) userId = user.id;
    }

    // 通知要送到**這位家長所屬公司**的企業微信，不是那個全域的單一位置。
    // 未歸屬（或查不到）時 company 為 null，notify 會退回全域設定並在日誌說明。
    const company =
      userId !== null && mysqlDb.isConfigured()
        ? await mysqlDb.findCompanyByUserId(userId).catch(() => null)
        : null;

    let bookingId: number | null = null;
    let persisted = false;
    if (mysqlDb.isConfigured()) {
      bookingId = await mysqlDb.createExpertBooking({
        userId,
        deviceId: typeof deviceId === 'string' ? deviceId : null,
        specialistId,
        parentName: name,
        parentPhone: phone,
        childAgeMonth: ageMonth,
        childGender: typeof childGender === 'string' ? childGender : null,
        reportSummary: summary,
        preferredSlot: slot,
        serviceType: service,
      });
      persisted = true;
    } else {
      offlineBookings.push({
        id: offlineBookings.length + 1, userId, specialistId, parentName: name,
        parentPhone: phone, childAgeMonth: ageMonth, childGender, reportSummary: summary,
        preferredSlot: slot, serviceType: service, createdAt: new Date().toISOString(),
      });
      bookingId = offlineBookings.length;
      console.warn('[Booking] MySQL not configured — booking held in memory only and will be lost on restart.');
    }

    // Answer as soon as the booking is durable. Notification is advisory: staff
    // can always work the queue by created_at, and making the parent wait on a
    // webhook round-trip would be worse than notifying a second later.
    res.json({ ok: true, bookingId, persisted });

    notifyExpertBooking({
      bookingId,
      serviceType: service,
      specialistName: typeof specialistName === 'string' ? specialistName : specialistId,
      parentName: name,
      parentPhone: phone,
      childAgeMonth: ageMonth,
      childGender: typeof childGender === 'string' ? childGender : null,
      preferredSlot: slot,
      reportSummary: summary,
      companyName: company?.name ?? null,
      companyWebhookUrl: company?.wecomWebhookUrl ?? null,
    })
      .then(results => {
        if (persisted && bookingId && results.some(r => r.ok)) {
          return mysqlDb.markBookingNotified(bookingId);
        }
      })
      .catch(err => console.error('[Booking] Notification pipeline failed:', err.message));
  } catch (err: any) {
    console.error('[Booking] Failed to record booking:', err.message);
    res.status(500).json({ error: '预约提交失败，请稍后重试或直接联系微信客服。' });
  }
});

// ── 電子郵件註冊與登入已於 #27 移除 ──
//
// 手機號驗證碼是家長端唯一的入口（`/api/auth/sms/*`，見下方）。既有電子郵件
// 家長的資料列留在資料庫裡一列都沒動，但**不提供認領路徑** —— 那個代價在
// grilling 階段已明確提出並由產品端選定，見
// `docs/adr/0002-parent-identity-is-company-plus-phone.md`。
//
// 一併消失的還有：展示用的明文種子帳號、記憶體模式的帳號表，以及那條在資料庫
// 寫入失敗時吞掉例外、退回記憶體、仍回報成功並發 token 的路 —— 家長看到註冊
// 成功、帳號卻在下次重啟時消失，那不是降級，是靜默的資料遺失。

/**
 * 這次登入落在哪一個歸屬範圍。
 *
 * 「查不到公司」與「查不動」是**兩個不同的答案**，所以回的是一個可辨別的
 * union，而不是一個 `number | null`：
 *
 *   - 查不到（沒帶識別碼、識別碼無效）→ 未歸屬，是一個確定且正常的答案。
 *   - 查不動（逾時、資料庫掛了）→ **沒有安全的預設值**。退成未歸屬會讓一位
 *     歸屬甲公司的家長在那一刻查不到自己的帳號，於是在未歸屬範圍內被建出
 *     第二個，孩子的檔案與分數留在他再也走不回去的那一個帳號裡。
 *
 * 因此查詢失敗時明確失敗，讓家長重試一次。
 */
type CompanyScope = { ok: true; companyId: number | null } | { ok: false; detail: string };

async function resolveCompanyScope(raw: unknown): Promise<CompanyScope> {
  if (typeof raw !== 'string') return { ok: true, companyId: null };
  const slug = raw.trim().toLowerCase();
  if (!slug || slug.length > 64) return { ok: true, companyId: null };
  try {
    const company = await withTimeout(mysqlDb.findCompanyBySlug(slug), 2000);
    if (!company) {
      // 查無此公司是一個**確定**的答案：這位家長落在未歸屬，不猜一家填上去。
      console.warn(`[Company] 进站识别码查无对应公司，该家长归属留空: ${slug}`);
      return { ok: true, companyId: null };
    }
    return { ok: true, companyId: company.id };
  } catch (err: any) {
    // 只报告「查不动」这件事，不在这里替呼叫端决定怎么处置 ——
    // 那个决定写在 `/api/auth/sms/verify` 里，而且只有一种：拒绝这次登入。
    console.warn('[Company] 归属查询失败:', err.message);
    return { ok: false, detail: err.message };
  }
}

/**
 * 索取一則登入驗證碼。
 *
 * 順序是**先寫入、再送出**，而不是反過來。寫不進去時家長還沒收到任何東西，
 * 重試一次就好；反過來的話，一則已經送達的驗證碼會因為那一列沒進資料庫而
 * 永遠驗不了，而家長手上拿著它。
 *
 * 這條路徑**沒有記憶體模式**。已經下線的電子郵件註冊那條路會吞掉資料庫例外、
 * 退回記憶體、仍回報成功並發 token —— 家長看到成功，帳號卻在下次重啟時消失。
 * 那不是降級，是靜默的資料遺失，這條路不沿用。
 */
app.post('/api/auth/sms/request', async (req, res) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  if (!PHONE_PATTERN.test(phone)) {
    res.status(400).json({ error: '请填写正确的 11 位手机号码。' });
    return;
  }
  if (!mysqlDb.isConfigured()) {
    res.status(503).json({ error: '短信登录暂未开放，请稍后再试。' });
    return;
  }

  const requestIp = normalizeRequestIp(req.ip);
  let codeId: number | null = null;
  try {
    // ── 防刷（一）：冷卻期 ──
    //
    // 「上一次是多久以前」由**資料庫**算好放在 `age_sec` 裡送回來。這裡不碰
    // `created_at`：那一欄是資料庫寫的，拿它去減 `Date.now()` 需要資料庫與
    // Node 行程的時區剛好一樣，而沒有人保證過那件事（見 `findLatestSmsCode`）。
    const latest = await withTimeout(mysqlDb.findLatestSmsCode(phone), 2000);
    // `== null` 這一句是必要的，不能只靠底下的 `Number.isFinite`：
    // `Number(null)` 是 **0**，而 0 是有限的。少了它，一個 NULL 的 age_sec
    // 會被讀成「才剛過 0 秒」而不是「算不出來」，於是每一次索取都回 429 ——
    // 那正是這段程式當初要消滅的那個全體登入關閉。
    const elapsedSec = latest?.age_sec == null ? NaN : Number(latest.age_sec);
    if (latest && Number.isFinite(elapsedSec) && elapsedSec < SMS_CODE_COOLDOWN_SEC) {
      const wait = Math.max(1, Math.ceil(SMS_CODE_COOLDOWN_SEC - elapsedSec));
      res.status(429).json({ error: `请求过于频繁，请 ${wait} 秒后再试。`, retryAfterSec: wait });
      return;
    }
    if (latest && !Number.isFinite(elapsedSec)) {
      // 算不出來就不擋 —— 下面兩道當日上限仍然是硬邊界，而擋下去的代價是
      // 家長完全登不進來（登入只剩這一條路）。
      console.warn('[SMS] 冷却期无法计算（age_sec 缺失），本次不套用冷却。');
    }

    // ── 防刷（二）(三)：兩道當日上限 ──
    //
    // 按號碼算的那一道擋不住換號碼：一台機器把號碼表跑過去，每一支都在自己的
    // 額度之內，而帳單是整份的，收到簡訊的人也都是真的。按來源算的是另一半。
    //
    // 兩支查詢彼此不相干，所以一起發 —— 序列跑只是把登入路徑上的等待加倍
    // （每一支各有兩秒的預算）。代價是號碼已經超標的那一次會多問一句位址，
    // 那是罕見的那條路，換常見的那條快一倍划得來。
    const [phoneCount, ipCount] = await Promise.all([
      withTimeout(mysqlDb.countRecentSmsCodesByPhone(phone, 24), 2000),
      requestIp
        ? withTimeout(mysqlDb.countRecentSmsCodesByIp(requestIp, 24), 2000)
        : Promise.resolve(0),
    ]);

    if (phoneCount >= SMS_CODE_DAILY_MAX_PER_PHONE) {
      res.status(429).json({ error: '本手机号今日验证码索取次数已达上限，请明天再试或联系客服。' });
      return;
    }
    if (requestIp && ipCount >= SMS_CODE_DAILY_MAX_PER_IP) {
      // 與上面那句**刻意不同字**。這一道擋下的家長自己一次都沒索取過 ——
      // 他只是跟別人共用一條網路。兩種原因回同一句話的話，家長會照著去等
      // 一個永遠不會到的明天，而客服從他的轉述裡分不出是哪一種。
      console.warn(`[SMS] 来源 ${requestIp} 今日索取次数已达上限，暂停发送。`);
      res.status(429).json({
        error: '当前网络今日验证码发送量已达上限。若您与他人共用同一网络（如机构 WiFi），请稍后再试或联系客服。',
      });
      return;
    }

    const code = generateSmsCode();
    codeId = await withTimeout(mysqlDb.createSmsCode({
      phone,
      // 只存雜湊。這一列若是明碼，任何一份備份都等同一把能登入的鑰匙。
      codeHash: await hashSecret(code),
      // 到期時刻由資料庫算（見 `createSmsCode`）——`created_at`、`expires_at`、
      // `consumed_at` 因此同屬一個時鐘，沒有「哪一欄歸誰管」要記。
      ttlSec: SMS_CODE_TTL_SEC,
      requestIp,
    }), 2000);

    const delivery = await sendVerificationCode(phone, code);
    if (!delivery.ok) {
      // 沒送出去的那一列必須收回去，否則冷卻期會把家長擋在門外一分鐘，
      // 而他手上並沒有任何一組可以輸入的驗證碼。
      try {
        await withTimeout(mysqlDb.deleteSmsCode(codeId), 2000);
      } catch (cleanupErr: any) {
        console.error('[SMS] 未送出的验证码回收失败，该笔将留到过期:', cleanupErr.message);
      }
      res.status(503).json({
        error: delivery.reason === 'not_configured'
          ? '短信通道尚未开放，暂时无法发送验证码。'
          : '验证码发送失败，请稍后再试。',
      });
      return;
    }

    // 回應裡**沒有驗證碼**。帶上去的話，這支 API 就是「誰打得到誰就能登入」。
    res.json({
      success: true,
      expiresInSec: SMS_CODE_TTL_SEC,
      cooldownSec: SMS_CODE_COOLDOWN_SEC,
    });
  } catch (err: any) {
    console.error('[SMS Request Error]:', err.message);
    res.status(500).json({ error: '验证码发送失败，请稍后再试。' });
  }
});

/**
 * 核對驗證碼。成功即登入 —— **第一次成功時建立帳號**，歸屬在那一刻寫入。
 *
 * 帳號是以（歸屬，手機號）這一組去找的，不是手機號本身：同一支手機號在兩家
 * 合作公司是兩位家長（`docs/adr/0002-parent-identity-is-company-plus-phone.md`）。
 */
app.post('/api/auth/sms/verify', async (req, res) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!PHONE_PATTERN.test(phone) || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: '请填写手机号与 6 位验证码。' });
    return;
  }
  if (!mysqlDb.isConfigured()) {
    res.status(503).json({ error: '短信登录暂未开放，请稍后再试。' });
    return;
  }

  try {
    const row = await withTimeout(mysqlDb.findLatestSmsCode(phone), 2000);
    // 過期與否由**資料庫**判斷（`is_expired`），與 `age_sec` 同一個理由。
    // 判斷不出來時當作已過期 —— **這個方向失敗是安全的**（家長重新索取一次
    // 就好），反過來會讓一組早就該作廢的驗證碼繼續通得過。
    const expired = Number(row?.is_expired ?? 1) !== 0;
    // 不存在、已用過、已過期，對外是同一句話：多說一個字都是在告訴猜的人
    // 他猜對了哪一半。
    const stale = !row || row.consumed_at || expired;
    if (stale) {
      res.status(401).json({ error: '验证码错误或已失效，请重新获取。' });
      return;
    }
    if (Number(row.attempts) >= SMS_CODE_MAX_ATTEMPTS) {
      res.status(401).json({ error: '错误次数过多，请重新获取验证码。' });
      return;
    }

    // 直接比對雜湊，沒有任何一條「儲存值不像雜湊就當明文比」的旁路 ——
    // `sms_codes` 裡若因故存進明碼，那條旁路會讓明碼直接通過，
    // 而唯一的症狀是「登入正常」。（那正是 #27 一併移除的舊 verifyPassword。）
    if (!(await bcrypt.compare(code, row.code_hash))) {
      await withTimeout(mysqlDb.incrementSmsCodeAttempts(row.id), 2000);
      const left = SMS_CODE_MAX_ATTEMPTS - (Number(row.attempts) + 1);
      res.status(401).json({
        error: left > 0 ? `验证码错误，还可以再试 ${left} 次。` : '错误次数过多，请重新获取验证码。',
      });
      return;
    }

    // 歸屬先問清楚，**再**作廢驗證碼。
    //
    // 順序反過來的代價全落在家長身上：資料庫慢個兩秒，這一句就查不動，
    // 而他手上那組正確的驗證碼已經被作廢了 —— 他按「重新获取」會撞上冷卻期，
    // 於是被擋在門外一分鐘，手裡拿著一組再也驗不過的號碼。
    // 這一句查的是公司名冊，跟驗證碼有沒有被用過完全無關，先問不會少任何保護。
    const scope = await resolveCompanyScope(req.body?.companySlug);
    if (!scope.ok) {
      console.error('[SMS Verify] 归属查询失败，无法判断这次登入属于哪一个范围，拒绝继续。');
      res.status(503).json({ error: '登录暂时不可用，请稍后再试。' });
      return;
    }

    // 讀完再作廢。`findUserByPhone` 跟上面那句歸屬查詢是同一件事的兩半 ——
    // 都是**沒有副作用的讀**，都有兩秒的預算會逾時，而排在作廢之後的那一次
    // 逾時會把家長手上那組正確的驗證碼一起帶走：他按「重新获取」撞上冷卻期，
    // 被擋在門外一分鐘，手裡拿著一組再也驗不過的號碼。讀先做完不少任何保護。
    const existing = await withTimeout(mysqlDb.findUserByPhone(scope.companyId, phone), 2000);

    // 先作廢再建帳號。反過來的話，同一組驗證碼在兩個同時進來的請求裡都會通過。
    if (!await withTimeout(mysqlDb.consumeSmsCode(row.id), 2000)) {
      res.status(401).json({ error: '验证码错误或已失效，请重新获取。' });
      return;
    }

    let user = existing;
    if (!user) {
      // 歸屬只在這一行寫得進去，此後不再改變 —— 已有帳號的家長走的是上面那條路。
      const newUserId = await withTimeout(mysqlDb.createPhoneUser(phone, scope.companyId), 2000);
      user = { id: newUserId, phone, company_id: scope.companyId };
      console.log(`[MySQL] Registered phone account (company: ${scope.companyId ?? '未归属'})`);
    }

    const sessionUserId: UserId = String(user.id);
    let child = null;
    let completedScores: any[] = [];
    let orders: any[] = [];
    let reportHistory: any[] = [];
    try {
      const dataRow = await withTimeout(mysqlDb.getUserDataByUserId(Number(user.id)), 2000);
      if (dataRow) {
        const parsed = mysqlDb.parseUserDataRow(dataRow);
        child = parsed.child;
        completedScores = parsed.completedScores;
        orders = parsed.orders;
        reportHistory = parsed.reportHistory;
      }
    } catch (dbErr: any) {
      // 讀不到既有資料不該擋住登入 —— 帳號本身已經確定了，同步會再試一次。
      console.warn('[MySQL] Load user data failed:', dbErr.message);
    }

    res.json({
      success: true,
      phone,
      token: signToken(sessionUserId),
      child, completedScores, orders, reportHistory,
    });
  } catch (err: any) {
    // 建帳號寫不進去就是失敗。**不得**退回記憶體再發一張通行證 ——
    // 家長會看到登入成功，而那個帳號在下一次重啟時就不存在了。
    console.error('[SMS Verify Error]:', err.message);
    res.status(500).json({ error: '登录失败，请稍后再试。' });
  }
});

/**
 * 這一位家長是誰，以及他有沒有資格問。
 *
 * 三種答案：登入了（`userId`）、沒登入（兩者皆空）、拿了一張不算數的通行證
 * （`unauthorized`）。第三種要與第二種分開：**帶著壞掉的通行證不能悄悄退回
 * 裝置紀錄** —— 那會讓一位其實已經登入的家長看到裝置上的舊檔案，而他不會知道
 * 自己看的不是自己的那一份。
 *
 * 身分只從通行證來。query 或 body 裡的 `email`、`userId` 一律不看 ——
 * 客戶端送上來的識別鍵不是身分，是一個請求。
 */
function resolveSyncIdentity(req: express.Request): { userId: UserId } | 'anonymous' | 'unauthorized' {
  if (!getBearerToken(req)) return 'anonymous';
  const userId = currentUserId(req);
  return userId ? { userId } : 'unauthorized';
}

/**
 * 這個工作階段的帳號還在嗎（ADR-0006）。
 *
 * 後台的刪除是硬刪：`users` 那一列不見了，但家長手機上那顆通行證還是有效的簽章。
 * 少了這一步，被刪掉的家長會看到一個空白的評估面板，存檔靜靜落進記憶體備份，
 * 而他以為自己的資料還在。回 401 之後前端會請他重新登入 —— 重新登入即新帳號，
 * 這正是「刪了就刪了」的意思。
 *
 * **資料庫出問題時不回 401。** 只有明確查到「沒有這個人」才算帳號不在；一次逾時
 * 就把所有人登出，代價比漏判一位已刪帳號大得多。
 */
async function sessionAccountMissing(userId: UserId | null): Promise<boolean> {
  if (!userId || !mysqlDb.isConfigured()) return false;
  const user = await withTimeout(findSessionUser(userId), 2000).catch(() => undefined);
  return user === null;
}

// Endpoint to load child assessment records
app.get('/api/db/load', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const identity = resolveSyncIdentity(req);
    if (identity === 'unauthorized') {
      res.status(401).json({ error: '未授权：请重新登录' });
      return;
    }
    // 登入了就讀他自己的那一份；沒登入才讀裝置紀錄 —— 後者的鍵是客戶端產生的
    // 不可猜測 UUID，那是註冊之前的匿名使用方式，行為不變。
    const userId = identity === 'anonymous' ? null : identity.userId;
    if (!userId && (!deviceId || typeof deviceId !== 'string')) {
      res.status(400).json({ error: 'Missing deviceId parameter.' });
      return;
    }

    if (await sessionAccountMissing(userId)) {
      res.status(401).json({ error: '帐号已不存在，请重新登录' });
      return;
    }

    const dbUserId = toDbUserId(userId);
    if (mysqlDb.isConfigured() && (!userId || dbUserId !== null)) {
      try {
        const row = userId
          ? await withTimeout(mysqlDb.getUserDataByUserId(dbUserId as number), 2000)
          : await withTimeout(mysqlDb.getUserDataByDevice(deviceId as string), 2000);

        if (row) {
          const parsed = mysqlDb.parseUserDataRow(row);
          res.json({ source: 'mysql', ...parsed });
        } else {
          res.json({ source: 'mysql', child: null, completedScores: [], orders: [], reportHistory: [] });
        }
        return;
      } catch (dbErr: any) {
        console.warn('[MySQL] Load failed, falling back to memory:', dbErr.message);
      }
    }

    // Memory fallback
    if (userId) {
      const localData = offlineUserData.get(userId);
      if (localData) {
        res.json({ source: 'memory', child: localData.child || null, completedScores: localData.completedScores || [], orders: localData.orders || [], reportHistory: localData.reportHistory || [] });
        return;
      }
    }
    res.json({ source: 'unconfigured' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load data.' });
  }
});

// Endpoint to save child assessment records
app.post('/api/db/save', async (req, res) => {
  try {
    const { deviceId, child, completedScores, orders, reportHistory } = req.body;
    const identity = resolveSyncIdentity(req);
    if (identity === 'unauthorized') {
      res.status(401).json({ error: '未授权：请重新登录' });
      return;
    }
    const userId = identity === 'anonymous' ? null : identity.userId;
    if (!userId && !deviceId) {
      res.status(400).json({ error: 'Missing deviceId.' });
      return;
    }

    // 帳號被後台刪掉之後，這顆通行證仍然是有效的簽章（ADR-0006）。不先擋下來的話，
    // 這一次存檔會因為外鍵而寫不進資料庫，然後落進下面那條「記憶體備份」的退路，
    // 回給家長一句 `success: true` —— 他以為存好了。
    if (await sessionAccountMissing(userId)) {
      res.status(401).json({ error: '帐号已不存在，请重新登录' });
      return;
    }

    // Always save to memory as hot-backup
    if (userId) {
      offlineUserData.set(userId, { child, completedScores, orders, reportHistory });
    }

    const dbUserId = toDbUserId(userId);
    if (mysqlDb.isConfigured() && dbUserId !== null) {
      try {
        // 通行證保證這個 id 來自一次成功的登入，帳號因此已經存在 ——
        // 這裡不會、也不該隱式建立帳號。
        await withTimeout(
          mysqlDb.saveUserData(dbUserId, deviceId || null, child, completedScores || [], orders || [], reportHistory || []),
          2000
        );
        console.log(`[MySQL] Saved data for user ${dbUserId}`);
        res.json({ success: true });
        return;
      } catch (err: any) {
        console.warn('[MySQL] Save failed, data in memory backup:', err.message);
        res.json({ success: true, localSavedFallback: true });
        return;
      }
    }

    res.json({ success: true, localSaved: true });
  } catch (err: any) {
    console.error('[Save Error]:', err.message);
    res.status(500).json({ error: `Save failed: ${err.message}` });
  }
});

// ══════════════════════════════════════════════════════════════
// 掃碼帶走報告（issue #22）
// ══════════════════════════════════════════════════════════════
//
// 家長在合作公司的 iPad 上看完報告，掃畫面上的二維碼，同一份報告就在他自己的
// 手機上打開。手機沒有登入，所以那條連結**本身就是憑據**。
//
// ⚠️ 已知取捨：**永久有效，沒有撤回手段**。二維碼被拍到就等於那份報告永久
// 公開，而系統沒有任何作廢的動作可以做。此取捨在規格階段被明確提出並由產品端
// 選定（issue #22 / #14），不是遺漏。剩下的唯一防線是猜不到 —— 32 位元組的
// 密碼學亂數，見 src/utils/reportLink.ts。
//
// 這裡刻意**複用後台匯出的那個 HTML 產生器**（src/admin/exportView.ts），不另寫
// 一份：兩邊各寫一份的話，同一位孩子的判定說法會在兩張紙上分岔，而那正是
// issue #8 當初把 statusLabel 收成一份的理由。

/** 二維碼裡那串網址的來源。沒設定就用請求本身的來源（見 resolveReportLinkBase）。 */
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

function requestOrigin(req: express.Request): string {
  // `trust proxy` 已設為 1，因此 nginx 帶進來的 X-Forwarded-Proto／Host 算數。
  return `${req.protocol}://${req.get('host') ?? ''}`;
}

/**
 * 把網址畫成二維碼（SVG）。
 *
 * 在伺服器端做，理由是**前端包裡不必多一個編碼器** —— 二維碼一份報告只需要
 * 產生一次，而那個編碼器（Reed-Solomon、遮罩、格式資訊）在瀏覽器裡的唯一用途
 * 就是這一張圖。
 *
 * 糾錯等級選 M（約 15%）而不是 L：這張圖會被印在 iPad 螢幕上、隔著反光與指紋
 * 被另一支手機拍下來，容錯多一點的代價只是圖密一點。
 */
function renderQrSvg(url: string): string {
  // typeNumber 0 = 依內容自動挑最小的版本。
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  // `scalable` 讓 SVG 帶 viewBox 而不是寫死的像素尺寸 —— 畫面上要多大由 CSS 決定。
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/**
 * 為某一份報告取得（必要時建立）它的永久連結。
 *
 * 回應刻意分成三種而不是「成功／失敗」：
 *   - `available: false` + 原因碼 → 這個部署沒有資料庫，做不出永久連結。
 *     畫面因此整個不顯示二維碼區塊，而不是顯示一個掃出來 404 的二維碼。
 *   - 401 → 沒登入。連結綁在帳號上，匿名的裝置紀錄沒有 user id 可以綁。
 *   - 200 + url/qrSvg → 有連結。
 */
app.post('/api/report-link', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const dbUserId = toDbUserId(userId);
    if (!userId) {
      res.status(401).json({ error: '未授权：请重新登录' });
      return;
    }

    const reportId = typeof req.body?.reportId === 'string' ? req.body.reportId.trim() : '';
    if (!reportId || reportId.length > 128) {
      res.status(400).json({ error: '缺少报告编号。' });
      return;
    }

    // 記憶體模式沒有 user_data 以外的持久層，發出去的 token 重啟就消失 ——
    // 那不是「永久連結」，是一條會在某個看不見的時刻壞掉的連結。明說做不到。
    if (!mysqlDb.isConfigured() || dbUserId === null) {
      res.json({ available: false, reason: 'NO_DATABASE' });
      return;
    }

    const token = await withTimeout(
      mysqlDb.issueReportLink(dbUserId, reportId, generateReportLinkToken()),
      2000
    );
    if (!token) {
      res.status(500).json({ error: '产生报告连结失败，请稍后再试。' });
      return;
    }

    const url = resolveReportLinkBase(PUBLIC_BASE_URL, requestOrigin(req)) + reportLinkPath(token);
    res.json({ available: true, url, qrSvg: renderQrSvg(url) });
  } catch (err: any) {
    console.error('[ReportLink] issue failed:', err.message);
    res.status(500).json({ error: '产生报告连结失败，请稍后再试。' });
  }
});

/**
 * 掃碼之後打開的那一頁。**公開，不需要登入** —— 那正是這個功能存在的理由。
 *
 * 走的是伺服器端渲染的 HTML，不是 SPA：手機上打開就是一頁純文件，
 * 不必下載整個前端，離線存下來也還讀得到。
 */
app.get('/r/:token', async (req, res) => {
  try {
    const token = req.params.token;
    // 形狀不對的一律 404，不去碰資料庫。這是一條公開路徑，每一次查詢都是
    // 別人可以免費叫我們做的工。
    if (!isValidReportLinkToken(token) || !mysqlDb.isConfigured()) {
      res.status(404).type('html').send(reportLinkNotFoundHtml());
      return;
    }

    const link = await withTimeout(mysqlDb.findReportLinkByToken(token), 2000);
    if (!link) {
      res.status(404).type('html').send(reportLinkNotFoundHtml());
      return;
    }

    const row = await withTimeout(mysqlDb.getUserDataByUserId(link.userId), 2000);
    const data = row ? mysqlDb.parseUserDataRow(row) : null;
    const reportHistory: any[] = data?.reportHistory ?? [];
    const record = reportHistory.find(r => r?.id === link.reportId);

    // token 有效但那份報告已經不在歷史裡（家長刪掉了、或舊資料被覆蓋）。
    // 這裡刻意不退回「最新的那一份」—— 拿著這張二維碼的人可能是另一位醫師，
    // 他不會知道自己看的已經換了一份。
    if (!record) {
      res.status(404).type('html').send(reportLinkNotFoundHtml());
      return;
    }

    // 分數取自**那一筆報告紀錄**，不是家長當下的 completedScores：紀錄是
    // 當時的事實快照，重測之後仍然要讀得出這份報告當初說了什麼。
    const scores = Array.isArray(record.scores) ? record.scores : [];
    const assessedAgeMonth = latestAssessedAgeMonth(scores, [record]);

    res.type('html').send(
      renderParentExportHtml(
        {
          childName: record.child?.name ?? null,
          childAgeMonth: typeof record.child?.ageMonth === 'number' ? record.child.ageMonth : null,
          childGender: record.child?.gender ?? null,
          // 帳號那一欄留空：這是給家長自己與他挑的醫師看的一頁，
          // 手機號印在一條撤不回的連結上沒有任何好處。
          email: null,
          phone: null,
          screenedAt: record.createdAt ?? null,
          scores,
          reportHistory: [record],
          bookings: [],
          assessedAgeMonth,
          assessedBandName: assessedAgeMonth === null ? null : ageBandOf(assessedAgeMonth).name,
        },
        {
          reportId: link.reportId,
          includeBookings: false,
          hint: '这一页是您扫码带走的报告，网址可以收藏起来，之后随时打开。',
          // 家長會把這個網址收藏起來反覆打開 —— 它是這個網域對外的一頁，
          // 備案號要在。後台匯出那條路徑不傳，那一份是列印文件不是網頁。
          icpBeian: ICP_BEIAN,
        }
      )
    );
  } catch (err: any) {
    console.error('[ReportLink] render failed:', err.message);
    res.status(500).type('html').send(reportLinkNotFoundHtml('报告暂时读取不了，请稍后再扫一次。'));
  }
});

/**
 * 掃不到東西時的那一頁。
 *
 * 刻意是一頁人看得懂的中文，不是 JSON 也不是 SPA：站在這一頁前面的是一位
 * 拿著手機的家長，`{"error":"Not found"}` 對他沒有任何意義。
 */
function reportLinkNotFoundHtml(message = '这个报告连结无效，或对应的报告已经不在了。'): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>找不到这份报告</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #1f2933;
         margin: 0; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; background: #f0f4f8; padding: 24px; }
  .box { background: #fff; border-radius: 16px; padding: 28px 24px; max-width: 380px;
         text-align: center; line-height: 1.8; }
  p { margin: 0; font-size: 15px; }
  .sub { margin-top: 10px; font-size: 13px; color: #829ab1; }
  .beian { margin-top: 18px; font-size: 12px; color: #9fb3c8; }
  .beian a { color: inherit; text-decoration: none; }
</style>
</head>
<body><div class="box">
  <p>${message.replace(/</g, '&lt;')}</p>
  <p class="sub">请回到评估现场的画面，重新扫一次二维码。</p>
  ${
    // 這一頁也是這個網域回給訪客的一頁 —— 掃到失效連結的家長停在這裡，
    // 它跟報告頁一樣看得到、一樣會被抽查到。
    ICP_BEIAN
      ? `<p class="beian"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">${ICP_BEIAN.replace(/</g, '&lt;')}</a></p>`
      : ''
  }
</div></body>
</html>`;
}

// ── 管理中心 ──
// 掛在這裡（所有家長端路由之後、404 兜底之前）。路由本身在 src/admin/routes.ts，
// 那個檔案不得直接碰資料庫 —— 後台的每一句家長查詢都必須經過帶公司條件的
// 單一入口，見 src/admin/adminStore.ts 與 test/adminScope.structure.test.ts。
app.use(
  '/api/admin',
  createAdminRouter(
    { multiCompany: ADMIN_MULTI_COMPANY },
    {
      // 硬刪要連記憶體裡這份熱備份一起刪（ADR-0006）。少了這一行，被刪掉的孩子的
      // 姓名、生日、分數與整串報告歷史會留在跑著的進程裡直到下一次重啟，而條款
      // 承諾的是全部關聯資料都刪掉。
      // 鍵是 `UserId`（字串形式的帳號 id），與 `/api/db/save` 寫進去時用的同一個。
      onParentDeleted: parentId => {
        offlineUserData.delete(String(parentId));
      },
    }
  )
);

// Anything under /api that reached this point matched no route. Answer with a
// JSON 404 before the SPA fallback in startServer() gets a chance to serve
// index.html.
//
// Without this, a GET to a route that is not registered — every tier-2/3 and
// paid endpoint in project B — falls through to `app.get('*')` and comes back
// as HTML with status 200. The client then parses a web page as JSON, and a
// deliberately disabled endpoint looks like a success. POSTs happened to 404
// correctly only because the catch-all is GET-only, which made the bug
// invisible on half the surface.
//
// Registered here, at the bottom of the module, because Express matches in
// registration order and every route above is already in. It deliberately does
// NOT live inside startServer(): a test that loads the app without listening
// must see the same 404 behaviour as production, or "the route exists" and
// "the route is registered" stop being the same question.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Binds the port and mounts the SPA. Deliberately separate from the module body
 * above, which only *defines* the app.
 *
 * The split is what makes the HTTP tests possible: importing this module gives
 * a fully-routed Express app that has not touched the network. `main.ts` is the
 * only caller — nothing else should start listening as an import side effect.
 */
export async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import so `vite` (a devDependency) is never required in production,
    // where hosting platforms may prune devDependencies after build.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SenXinKang Server] Server is booted successfully on http://0.0.0.0:${PORT}`);
    // Log the mode and where the port came from. Both have burned us before:
    // a wrong APP_MODE silently exposes the tier-2/3 endpoints, and
    // DEPLOY_RUN_PORT taking precedence over the platform-injected PORT makes a
    // service unreachable with no other symptom.
    const portSource = process.env.DEPLOY_RUN_PORT
      ? 'DEPLOY_RUN_PORT'
      : process.env.PORT
        ? 'PORT'
        : 'default';
    console.log(
      `[SenXinKang Server] APP_MODE=${APP_MODE} (${APP_MODE === 'full'
        ? 'project A — tier-2/3 endpoints registered'
        : 'project B — tier-2/3 endpoints NOT registered'}), port from ${portSource}`
    );
    // Say out loud whether the paywall is enforced. Memory mode lets every
    // tier-2/3 request through (see denyIfLocked) — fine for a demo box, a
    // silent giveaway on a production one.
    if (APP_MODE === 'full') {
      console.log(
        PAYWALL_DEMO_OPEN
          ? '[SenXinKang Server] Paywall NOT enforced (PAYWALL_DEMO_OPEN=1): the wall still renders but tier-2/3 endpoints are open to anyone. Demo only — unset this before selling.'
          : mysqlDb.isConfigured()
            ? '[SenXinKang Server] Paywall ENFORCED — tier-2/3 requests require a matching unlock.'
            : '[SenXinKang Server] Paywall NOT enforced (no MYSQL_* configured): tier-2/3 endpoints are open to anyone. Demo mode only.'
      );
      console.log(
        wechatPayStatus.config
          ? `[SenXinKang Server] WeChat Pay configured (trade type: ${PAY_TRADE_TYPE}).`
          : `[SenXinKang Server] WeChat Pay NOT configured — orders can be opened but not paid. Missing: ${wechatPayStatus.missing.join(', ')}`
      );
    }
  });
}

export { app };
