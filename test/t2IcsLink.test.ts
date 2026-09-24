import { describe, it, expect } from 'vitest';
import { ICS_LINK_TTL_MS, createIcsLinkToken, readIcsLinkToken } from '../src/t2/icsLink';

/**
 * `.ics` 的短時效連結（Keep 規格 §3.8「加到日曆」，票 B7）。
 *
 * 【為什麼要這一支】
 * `GET /api/t2/practice-prefs.ics` 要 Bearer token，而手機要「加入日曆」得由瀏覽器自己去開一個網址
 * （`location.href`）—— 那一次請求帶不了 `Authorization`，一般連結會 401。所以伺服器先發一個短時效的
 * 連結，網址本身就是憑證。
 *
 * 這裡釘的是那個憑證的性質：
 * 1. 認得出是誰（驗得回同一位家長），過期、竄改、換一把鑰匙都不認。
 * 2. **不透明**：網址會留在瀏覽器歷史、伺服器的存取紀錄裡，裡面不能看得出使用者 id（更不用說手機號）。
 */

const SECRET = 'test-secret-for-ics-link';
const NOW = Date.parse('2026-09-24T12:00:00.000Z');

describe('簽出來的連結驗得回同一位家長', () => {
  it('同一把鑰匙、還沒過期 → 那位家長的 id', () => {
    const token = createIcsLinkToken('42', SECRET, NOW);
    expect(readIcsLinkToken(token, SECRET, NOW)).toBe('42');
    expect(readIcsLinkToken(token, SECRET, NOW + ICS_LINK_TTL_MS - 1)).toBe('42');
  });

  it('有效期不超過 10 分鐘（規格：一次性或 ≤10 分鐘）', () => {
    expect(ICS_LINK_TTL_MS).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(ICS_LINK_TTL_MS).toBeGreaterThan(0);
  });

  it('記憶體模式的識別鍵（`mem:3` 這種）也驗得回來', () => {
    expect(readIcsLinkToken(createIcsLinkToken('mem:3', SECRET, NOW), SECRET, NOW)).toBe('mem:3');
  });
});

describe('不認的', () => {
  it('過了有效期 → null', () => {
    const token = createIcsLinkToken('42', SECRET, NOW);
    expect(readIcsLinkToken(token, SECRET, NOW + ICS_LINK_TTL_MS)).toBeNull();
    expect(readIcsLinkToken(token, SECRET, NOW + 60 * 60 * 1000)).toBeNull();
  });

  it('換一把鑰匙 → null（伺服器換了 SESSION_SECRET，舊連結全部作廢）', () => {
    const token = createIcsLinkToken('42', SECRET, NOW);
    expect(readIcsLinkToken(token, 'another-secret', NOW)).toBeNull();
  });

  it('改了任何一個字元 → null', () => {
    const token = createIcsLinkToken('42', SECRET, NOW);
    for (let i = 0; i < token.length; i += 1) {
      const flipped = token[i] === 'A' ? 'B' : 'A';
      const tampered = token.slice(0, i) + flipped + token.slice(i + 1);
      expect(readIcsLinkToken(tampered, SECRET, NOW), `第 ${i} 個字元`).toBeNull();
    }
  });

  it('截短、加長、空字串、亂碼、家長端的通行證 → null，不丟例外', () => {
    const token = createIcsLinkToken('42', SECRET, NOW);
    for (const bad of [
      '',
      token.slice(0, -1),
      token.slice(0, 20),
      `${token}A`,
      'not-a-token',
      '%%%%',
      // 家長端通行證的形狀（payload.sig）：兩種憑證不能互通
      'eyJ1aWQiOiI0MiIsImV4cCI6OTk5OTk5OTk5OTk5OX0.c2lnbmF0dXJl',
    ]) {
      expect(readIcsLinkToken(bad, SECRET, NOW), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('不透明：網址裡看不出是誰', () => {
  it('連結裡找不到使用者 id 的明文、也找不到它的 base64', () => {
    const userId = '1234567';
    const token = createIcsLinkToken(userId, SECRET, NOW);
    expect(token).not.toContain(userId);
    const b64 = Buffer.from(JSON.stringify({ u: userId })).toString('base64url');
    expect(token).not.toContain(b64.slice(0, 8));
    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain(userId);
  });

  it('同一位家長簽兩次，兩條連結不一樣（不能拿連結比對出是不是同一個人）', () => {
    expect(createIcsLinkToken('42', SECRET, NOW)).not.toBe(createIcsLinkToken('42', SECRET, NOW));
  });

  it('只用網址安全的字元（直接接在 ?t= 後面，不必再跳脫）', () => {
    expect(createIcsLinkToken('42', SECRET, NOW)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
