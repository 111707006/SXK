import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CODE_ALPHABET, formatCode, generateCode, normalizeCode } from '../src/redeem/codes';
import { createRedeemLimiter, REDEEM_PER_SOURCE_PER_HOUR, REDEEM_PER_USER_PER_HOUR } from '../src/redeem/rateLimit';
import { readPlans } from '../src/components/training/TrainingPlanPage';

/**
 * 兌換碼（#110）：格式、不重複、大小寫與分隔符不拘、限流；兌換那一個交易的關鍵句（原子改已用、綁定第一次固定）。
 */

describe('碼', () => {
  const gen = () => generateCode(max => crypto.randomInt(max));

  it('10 碼、只用去掉易混字元的 32 個字（沒有 0、1、I、O）', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/);
    for (let i = 0; i < 200; i++) expect(gen()).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
  });

  it('一萬組不重複', () => {
    expect(new Set(Array.from({ length: 10000 }, gen)).size).toBe(10000);
  });

  it('顯示成 XXXX-XXXX-XX；輸入大小寫與分隔符不拘', () => {
    expect(formatCode('ABCD2345XY')).toBe('ABCD-2345-XY');
    expect(normalizeCode('abcd-2345-xy')).toBe('ABCD2345XY');
    expect(normalizeCode(' ABCD 2345_XY ')).toBe('ABCD2345XY');
  });

  it('形狀不對不打資料庫', () => {
    for (const bad of ['', 'ABCD2345X', 'ABCD2345XYZ', 'ABCD2345X0', 'ABCD2345XI', null, 12345]) expect(normalizeCode(bad)).toBeNull();
  });
});

describe('限流', () => {
  it('每位家長每小時 10 次', () => {
    let t = 0;
    const l = createRedeemLimiter(() => t);
    for (let i = 0; i < REDEEM_PER_USER_PER_HOUR; i++) expect(l.take('u1', `ip${i}`)).toBe(true);
    expect(l.take('u1', 'ipX')).toBe(false);
    t += 60 * 60 * 1000 + 1;
    expect(l.take('u1', 'ipX')).toBe(true);
  });

  it('每個來源每小時 30 次（換帳號也一樣）', () => {
    const l = createRedeemLimiter(() => 0);
    for (let i = 0; i < REDEEM_PER_SOURCE_PER_HOUR; i++) expect(l.take(`u${i}`, 'same-ip')).toBe(true);
    expect(l.take('u-new', 'same-ip')).toBe(false);
  });
});

describe('兌換的交易', () => {
  const src = readFileSync('src/db/redeemCodes.ts', 'utf8');

  it('原子地改已用：只有未用的改得到（兩人同時兌只有一人）', () => {
    expect(src).toContain("UPDATE redeem_codes SET status = 'used', used_by = ?, used_at = NOW() WHERE code = ? AND status = 'unused'");
    expect(src).toContain('affectedRows !== 1');
  });

  it('綁定第一次固定（INSERT IGNORE，家長是主鍵）；使用權照發', () => {
    expect(src).toContain("INSERT IGNORE INTO referrer_bindings (user_id, referrer_id, source, ref_id) VALUES (?, ?, 'code', ?)");
    expect(src).toContain("INSERT INTO training_passes");
    expect(readFileSync('deploy/migrations/2026-10-23-referrers.sql', 'utf8')).toContain('`user_id` INT UNSIGNED NOT NULL PRIMARY KEY');
  });

  it('同一位家長的使用權先鎖再算（接在後面，不重疊）', () => {
    expect(src).toContain('FOR UPDATE');
  });
});

describe('方案頁讀伺服器回的方案', () => {
  it('三張卡；價錢沒設是 null（價格待定）；付款沒開', () => {
    const out = readPlans({ plans: [{ months: 1, priceFen: null, title: '一个月', blurb: 'x' }, { months: 3, priceFen: 9900, title: '三个月', blurb: 'y' }, { months: 9, title: 'z', blurb: 'z' }], payAvailable: false });
    expect(out.plans.map(p => [p.months, p.priceFen])).toEqual([[1, null], [3, 9900]]);
    expect(out.payAvailable).toBe(false);
  });
});
