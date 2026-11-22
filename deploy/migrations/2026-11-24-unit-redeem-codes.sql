-- ============================================================
-- 迁移：单位层的兑换码（#124，ADR-0020 第 7 点，专案 A）
-- 日期：2026-11-24
-- ============================================================
--
-- **只加不删**：redeem_batches 的 referrer_id 放宽成可为 NULL（不删资料、旧程式码照旧每次都写它），
-- 加一个可为 NULL 的 company_id 与它的索引、外键（加之前先看 information_schema）。完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开服务关系开关之前**（只有专案 A 用到；B 跑了无害）。开关关着的程式码不读 company_id。
-- 【一批碼发给谁】推荐人的碼：referrer_id 有值、company_id NULL（与以前一样）；单位层的碼（单位管理者代填、发给
-- 本单位用）：company_id 有值、referrer_id NULL。两个都有值或都 NULL 的列不该出现（由程式码保证）。

ALTER TABLE `redeem_batches` MODIFY COLUMN `referrer_id` INT UNSIGNED NULL;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND COLUMN_NAME = 'company_id'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `redeem_batches` ADD COLUMN `company_id` INT UNSIGNED NULL AFTER `referrer_id`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND INDEX_NAME = 'idx_redeem_batches_company'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `redeem_batches` ADD INDEX `idx_redeem_batches_company` (`company_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND CONSTRAINT_NAME = 'fk_redeem_batches_company'
);
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE `redeem_batches` ADD CONSTRAINT `fk_redeem_batches_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS redeem_batches_company_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND COLUMN_NAME = 'company_id';
SELECT COUNT(*) AS redeem_batches_referrer_nullable_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND COLUMN_NAME = 'referrer_id' AND IS_NULLABLE = 'YES';
SELECT COUNT(*) AS redeem_batches_company_fk_ok FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_batches' AND CONSTRAINT_NAME = 'fk_redeem_batches_company';
