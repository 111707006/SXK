import crypto from 'crypto';

/**
 * 簽出一張真的家長端通行證 —— 與 `server.ts` 的 `signToken` 同一套 HMAC。
 *
 * 抽成共用的一份，是因為 payload 的形狀就是身分機制本身：`server.ts` 換掉它
 * 的那一天，這裡會**一處**跟著換，而不是三支測試各自留著一份過期的形狀
 * 繼續簽出伺服器已經不認得的 token。
 *
 * `userId` 是**使用者 id**，不是電子郵件 —— 資料層只認得這個鍵。
 */
export function signSessionToken(userId: string | number): string {
  const b64url = (buf: Buffer | string) =>
    Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = b64url(JSON.stringify({ uid: String(userId), exp: Date.now() + 60_000 }));
  const sig = b64url(
    crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest()
  );
  return `${payload}.${sig}`;
}

/** 直接可用的 `Authorization` 標頭。 */
export function bearer(userId: string | number): Record<string, string> {
  return { Authorization: `Bearer ${signSessionToken(userId)}` };
}
