import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SERVICE_TYPES } from '../src/utils/serviceTypes';

/**
 * 服務類型在程式碼與資料庫之間必須逐字一致（issue #21）。
 *
 * 這是一個**跨越兩種語言的常數**：TypeScript 的 `ServiceType` 聯集，與 MySQL 的
 * `ENUM(...)`。型別檢查看不到 .sql 檔，測試環境又刻意沒有資料庫連線
 * （見 `test/setup/testEnv.ts`），所以兩邊分岔時沒有任何一道閘門會亮。
 *
 * 分岔的樣子分兩種，都要等到線上才會發現：
 *
 * 1. **TS 多一種、ENUM 少一種**（加了第五種服務卻忘了寫遷移）→ 家長按下那一種
 *    會拿到「预约提交失败」，因為 MySQL 嚴格模式會拒絕不在 ENUM 裡的值。
 * 2. **ENUM 多一種、TS 少一種** → 資料庫裡存得下一種後台顯示成
 *    「未记录服务类型」的預約，而沒有人知道它是什麼。
 *
 * 寫法參照 `test/reportCopy.structure.test.ts` 與 `test/dimensionIds.test.ts`：
 * 讀原始碼，因為要比對的東西型別檢查擋不住。
 */

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'deploy/schema.sql';
const MIGRATION = 'deploy/migrations/2026-08-10-booking-service-type.sql';

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * 抓出 `service_type` 那一句 ENUM 裡列的值。
 *
 * 只找 `service_type` 後面緊接的那個 ENUM —— 檔案裡還有 `status` 與 `severity`
 * 等別的 ENUM，用一個泛用的 `/ENUM\(([^)]*)\)/` 會抓到第一個碰到的那個，
 * 然後這整支測試會安靜地改去驗別的欄位。
 */
function serviceEnumOf(sql: string): string[] | null {
  const match = sql.match(/`service_type`[\s\S]{0,80}?ENUM\(([^)]*)\)/i);
  if (!match) return null;
  return match[1]
    .split(',')
    .map(v => v.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

describe('程式碼與資料庫對四種服務的說法一致', () => {
  it('護欄本身沒有壞掉：兩個檔案都抓得到那一句 ENUM', () => {
    // 沒有這一條，欄位改名或 SQL 排版一變就會讓下面每一條「零筆全過」。
    expect(serviceEnumOf(read(SCHEMA)), SCHEMA).not.toBeNull();
    expect(serviceEnumOf(read(MIGRATION)), MIGRATION).not.toBeNull();
  });

  it.each([SCHEMA, MIGRATION])('%s 的 ENUM 與 ServiceType 逐字相同、順序相同', rel => {
    expect(serviceEnumOf(read(rel))).toEqual([...SERVICE_TYPES]);
  });

  /**
   * 預設值必須是既有的那一種。
   *
   * 錯了不會有任何聲音：還沒更新的家長端建置不送這個欄位，DEFAULT 於是決定
   * 那些預約算哪一種服務 —— 客服照著它分工，而畫面上一切正常。
   */
  it.each([SCHEMA, MIGRATION])('%s 的預設值是 online_consult', rel => {
    const sql = read(rel);
    const match = sql.match(/`service_type`[\s\S]{0,240}?DEFAULT\s+'([a-z_]+)'/i);
    expect(match?.[1]).toBe('online_consult');
  });

  /**
   * 線下的地點**不進系統**（本 issue 的取捨：據點資訊常變，寫進系統只會多一張
   * 要維護的表；既有的 new→contacted→scheduled→done 就是承接它的地方）。
   *
   * 釘住它，是因為「順手加一個地址欄位」是這張票最容易被好心推翻的決定，
   * 而推翻它的人不會知道那是刻意的。
   */
  it('預約表沒有任何地點欄位', () => {
    const schema = read(SCHEMA);
    const bookings = schema.slice(
      schema.indexOf('CREATE TABLE IF NOT EXISTS `expert_bookings`'),
      schema.indexOf('CREATE TABLE IF NOT EXISTS `admin_users`')
    );
    expect(bookings.length).toBeGreaterThan(0);
    for (const forbidden of ['`address`', '`venue`', '`location`', '`site_id`', '`clinic']) {
      expect(bookings, forbidden).not.toContain(forbidden);
    }
  });
});
