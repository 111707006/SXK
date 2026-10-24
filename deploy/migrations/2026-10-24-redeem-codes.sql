-- ============================================================
-- 迁移：兑换码 redeem_batches、redeem_codes（客户 10/22，issue #110，规格 docs/specs/client-changes-2026-10-22-3-plan.md）
-- 日期：2026-10-24
-- ============================================================
--
-- 两张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。要先跑 2026-10-23-referrers.sql（外键）。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开开关 TRAINING_PLAN 之前**（只有专案 A）。
--
-- 【一批、一组】一批＝全域管理员替某位推荐人一次产的 N 组（月数一样）。一组码 10 码（去掉易混字元的 base32，
-- 显示成 XXXX-XXXX-XX），**存明码**：客服与推荐人要能在后台再拿出来发（与交接码只存杂凑不同，那个不必再显示）。
-- 状态：unused → used（家长兑换，或推荐人代填用掉）／void（全域管理员作废，只有 unused 能作废）。

CREATE TABLE IF NOT EXISTS `redeem_batches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `referrer_id` INT UNSIGNED NOT NULL,
  `months` TINYINT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  -- 谁产的（后台帐号）；帐号删掉留 NULL，纪录还在。
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_redeem_batches_referrer` (`referrer_id`),
  CONSTRAINT `fk_redeem_batches_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `referrers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_redeem_batches_admin` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `redeem_codes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT UNSIGNED NOT NULL,
  `code` CHAR(10) NOT NULL,
  `status` ENUM('unused','used','void') NOT NULL DEFAULT 'unused',
  -- 用掉它的家长；家长帐号删掉留 NULL（对帐时仍看得到这组码用过了）。
  `used_by` INT UNSIGNED NULL,
  `used_at` DATETIME NULL,
  `voided_at` DATETIME NULL,
  UNIQUE KEY `uk_redeem_codes_code` (`code`),
  INDEX `idx_redeem_codes_batch` (`batch_id`, `status`),
  CONSTRAINT `fk_redeem_codes_batch` FOREIGN KEY (`batch_id`) REFERENCES `redeem_batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_redeem_codes_user` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS redeem_batches_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches';
SELECT COUNT(*) AS redeem_codes_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_codes';
