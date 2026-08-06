/**
 * 後台的工作階段 token。
 *
 * 與家長端的 token **刻意分開簽章**：簽章密鑰由 `SESSION_SECRET` 再推導一層，
 * 因此一張家長 token 在後台這邊連簽章都對不上。不是靠 payload 裡的 `typ`
 * 欄位去擋 —— 那種擋法只要有人忘了檢查一次就整個垮掉，而「忘了檢查」正是
 * 這個專案已經踩過的形狀。`typ` 仍然檢查，但它是第二道，不是唯一一道。
 *
 * token 裡帶了角色與（全域管理員的）選定公司，但**帳號是否仍啟用、是否仍屬於
 * 那家公司，每次請求都回查資料庫**。停用一個帳號必須立刻切斷存取，而不是等
 * 七天後 token 過期。
 */
import crypto from 'crypto';
import type { AdminIdentity, AdminRole, CompanySelection } from './companyScope';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時 —— 後台看得到孩子的健康資料，比家長端的 7 天短

export interface AdminTokenPayload {
  typ: 'admin';
  /** admin_users.id */
  aid: number;
  email: string;
  role: AdminRole;
  /** company_member 的所屬公司；global_admin 為 null */
  companyId: number | null;
  /** global_admin 當下選定的視野；未選定為 null */
  sel: CompanySelection | null;
  exp: number;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 後台專用的簽章密鑰，由家長端的 `SESSION_SECRET` 推導。
 *
 * 每次呼叫都重算而不是在模組載入時算好一次：`server.ts` 會在載入時
 * `dotenv.config()`，而測試會在那之前改 `SESSION_SECRET`。存成模組常數會讓
 * 兩邊各自抓到不同時間點的值，症狀是「簽得出來但驗不過」。
 *
 * **沒有 `SESSION_SECRET` 就沒有密鑰，回 `null`。** 這裡刻意不像家長端那樣退回
 * 一把隨機密鑰，更不能退回空字串 —— `HMAC(key='', 'sxk-admin-token-v1')` 是一個
 * 任何人都算得出來的固定值，等於把整個後台的簽章公開。後台本來就沒有降級模式
 * （沒有資料庫時整組回 503），密鑰缺席比照辦理：簽不出來、也驗不過。
 */
function adminSecret(): Buffer | null {
  const base = process.env.SESSION_SECRET;
  if (!base) return null;
  return crypto.createHmac('sha256', base).update('sxk-admin-token-v1').digest();
}

export function signAdminToken(
  payload: Omit<AdminTokenPayload, 'typ' | 'exp'>,
  now: number = Date.now()
): string {
  const secret = adminSecret();
  // 拋出而不是回傳一個簽不動的字串：登入若在沒有密鑰的情況下「成功」，
  // 發出去的就是一張人人簽得出來的通行證。
  if (!secret) throw new Error('SESSION_SECRET 未设定，管理中心无法签发工作阶段。');
  const body = b64url(
    JSON.stringify({ ...payload, typ: 'admin', exp: now + TOKEN_TTL_MS } satisfies AdminTokenPayload)
  );
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/** 簽章有效且未過期時回傳 payload，否則 `null`（含密鑰未設定）。 */
export function verifyAdminToken(token: string | null | undefined): AdminTokenPayload | null {
  const secret = adminSecret();
  if (!secret) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    ) as AdminTokenPayload;
    if (data.typ !== 'admin') return null;
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    if (typeof data.aid !== 'number') return null;
    if (data.role !== 'global_admin' && data.role !== 'company_member') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 把 token 的內容與**資料庫當下的帳號狀態**合成身分。
 *
 * `account` 由呼叫端從資料庫取得。角色與所屬公司一律以資料庫為準，token 只提供
 * 全域管理員的選定視野 —— 選定是使用者的意圖，權限不是。
 */
export function buildIdentity(
  payload: AdminTokenPayload,
  account: { id: number; email: string; role: AdminRole; companyId: number | null; active: boolean }
): AdminIdentity | null {
  if (!account.active) return null;

  if (account.role === 'company_member') {
    // 公司成員卻沒有所屬公司是資料錯誤。放行會讓他變成一個沒有邊界的檢視者，
    // 因此一律擋下 —— 不確定的時候當作未授權。
    if (account.companyId === null) return null;
    return {
      role: 'company_member',
      adminUserId: account.id,
      email: account.email,
      companyId: account.companyId,
    };
  }

  const sel = payload.sel;
  const selection: CompanySelection | null =
    sel && sel.kind === 'company' && typeof sel.companyId === 'number'
      ? { kind: 'company', companyId: sel.companyId }
      : sel && sel.kind === 'unassigned'
        ? { kind: 'unassigned' }
        : null;

  return { role: 'global_admin', adminUserId: account.id, email: account.email, selection };
}
