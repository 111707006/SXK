-- ============================================================
-- 迁移：扫码带走的报告连结（issue #22）
-- 日期：2026-08-10
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**（CREATE TABLE IF NOT EXISTS），
-- 重跑不会报错也不会动到既有资料。
--
--   mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> \
--     < deploy/migrations/2026-08-10-report-links.sql
--
-- 【什么时候跑】
-- 部署新版程式码之前或之后都可以。表不存在时，报告页的二维码区块**整个不显示**
-- （後端回 available: false），而不是显示一个扫出来是 404 的二维码。
--
-- 【A / B 都要跑】
-- 扫码带报告回家是 iPad 现场的功能，两个产品的报告页都有。
--
-- ⚠️ 请先备份：
--   mysqldump -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> > backup.sql

CREATE TABLE IF NOT EXISTS `report_links` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 32 位元组的密码学乱数，base64url 后恰好 43 个字元。
  -- 连结永久有效且无法撤回（产品端已选定的取舍），「猜不到」是它仅有的防线。
  `token` VARCHAR(64) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  -- report_history 里那一笔的 id（AssessmentRecord.id）。
  `report_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_report_link_token` (`token`),
  -- 一份报告一条连结。少了它，家长每重开一次报告页就多一个 token，
  -- 而旧的每一个都还永久有效。
  UNIQUE KEY `uk_user_report` (`user_id`, `report_id`),
  CONSTRAINT `fk_report_links_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 第一句必须回 1：表建起来了。
SELECT COUNT(*) AS report_links_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'report_links';

-- 第二句必须回 1：两个唯一索引都在（`..._ok` 一律以 1 为通过，见 migrate.mjs）。
--
-- 这一句是本迁移的重点。token 的唯一性是「一个 token 只对应一份报告」这句话的
-- 保证；(user_id, report_id) 的唯一性是「一份报告只有一条撤不回的连结」的保证。
-- 两者都是资料库层的约束，测试环境刻意没有资料库连线（见 test/setup/testEnv.ts），
-- **测试证明不了它们真的生效** —— 证明放在这里。
SELECT CASE WHEN COUNT(DISTINCT INDEX_NAME) = 2 THEN 1 ELSE 0 END AS report_links_unique_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'report_links'
   AND NON_UNIQUE = 0
   AND INDEX_NAME IN ('uk_report_link_token', 'uk_user_report');
