import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import { signAdminToken, verifyAdminToken } from '../src/admin/adminAuth';

/**
 * 後台工作階段的簽章。
 *
 * 這個檔案存在的理由只有一個：**密鑰缺席時必須失敗關閉。**
 *
 * 原本 `adminSecret()` 寫的是 `process.env.SESSION_SECRET || ''`，看起來只是一個
 * 無害的預設值，實際上是把整個後台的簽章公開 —— `HMAC(key='', 'sxk-admin-token-v1')`
 * 是一個常數，任何人都能離線算出來，然後自簽一張 `role: 'global_admin'` 的 token，
 * 逐一切過每一家合作公司，取走所有孩子的健康資料。
 *
 * `buildIdentity()` 會回查資料庫，但那擋不住這件事：它只要求 `aid` 對應到一個啟用中
 * 的帳號，而 `aid` 是自增小整數，從 1 開始試幾十次必中。
 *
 * 少了密鑰的正確行為與少了資料庫一樣：整個後台不可用，不是「用一把大家都知道的
 * 鑰匙繼續營業」。
 */

const REAL_SECRET = process.env.SESSION_SECRET;

afterEach(() => {
  process.env.SESSION_SECRET = REAL_SECRET;
});

const payload = {
  aid: 1,
  email: 'attacker@example.com',
  role: 'global_admin' as const,
  companyId: null,
  sel: { kind: 'company' as const, companyId: 7 },
};

/** 攻擊者算得出來的那把鑰匙 —— 這正是修掉的那個預設值。 */
function forgeWithEmptySecret(): string {
  const b64url = (buf: Buffer | string) =>
    Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const key = crypto.createHmac('sha256', '').update('sxk-admin-token-v1').digest();
  const body = b64url(
    JSON.stringify({ ...payload, typ: 'admin', exp: Date.now() + 60_000 })
  );
  return `${body}.${b64url(crypto.createHmac('sha256', key).update(body).digest())}`;
}

describe('密鑰缺席時後台失敗關閉', () => {
  it('沒有 SESSION_SECRET 就簽不出工作階段', () => {
    process.env.SESSION_SECRET = '';
    expect(() => signAdminToken(payload)).toThrow();
  });

  it('沒有 SESSION_SECRET 時任何 token 都驗不過', () => {
    process.env.SESSION_SECRET = 'a-real-secret';
    const legitimate = signAdminToken(payload);
    expect(verifyAdminToken(legitimate)).not.toBeNull();

    // 同一張合法 token，在密鑰消失之後也必須失效 —— 「驗不了」要當作「不通過」。
    process.env.SESSION_SECRET = '';
    expect(verifyAdminToken(legitimate)).toBeNull();
  });

  // 這一條是整個檔案的重點：把舊的預設值放回去，它就會通過。
  it('用空字串推導出的密鑰偽造的 token 一律不通過', () => {
    const forged = forgeWithEmptySecret();

    process.env.SESSION_SECRET = 'a-real-secret';
    expect(verifyAdminToken(forged)).toBeNull();

    process.env.SESSION_SECRET = '';
    expect(verifyAdminToken(forged)).toBeNull();
  });
});

describe('正常情況下的簽章', () => {
  it('簽出來的 token 驗得回原本的內容', () => {
    process.env.SESSION_SECRET = 'a-real-secret';
    const verified = verifyAdminToken(signAdminToken(payload));
    expect(verified).toMatchObject({
      typ: 'admin',
      aid: 1,
      role: 'global_admin',
      sel: { kind: 'company', companyId: 7 },
    });
  });

  it('換了密鑰之後舊 token 就不認得了', () => {
    process.env.SESSION_SECRET = 'secret-one';
    const token = signAdminToken(payload);
    process.env.SESSION_SECRET = 'secret-two';
    expect(verifyAdminToken(token)).toBeNull();
  });

  it('過期的 token 不通過', () => {
    process.env.SESSION_SECRET = 'a-real-secret';
    // 13 小時前簽的（TTL 是 12 小時）
    const stale = signAdminToken(payload, Date.now() - 13 * 60 * 60 * 1000);
    expect(verifyAdminToken(stale)).toBeNull();
  });
});
