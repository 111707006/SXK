-- ============================================================
-- 迁移：优惠券绑推荐人（使用者 2026-11-23，专案 A）
-- 日期：2026-11-25
-- ============================================================
--
-- **只加不删**：
-- 1. coupon_batches 加一个可为 NULL 的 referrer_id 与它的索引、外键（加之前先看 information_schema）。
--    新产的每一批都带推荐人（由程式码保证）；之前产的那几批（含测试优惠码那一批）留 NULL＝没有推荐人。
--    推荐人删掉时留 NULL（ON DELETE SET NULL）：家长已经用掉的券还要照折后价付款，不能跟着删。
-- 2. service_relation_changes.reason 的 ENUM 在最后加 'coupon'（家长用某位推荐人的优惠券而挂上／换掉服务关系）。
--    只在最后加一个值，旧资料与旧程式码都不受影响。
--
-- 完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**部署这一版程式码之前**（只有专案 A 用到优惠券；B 跑了无害）。

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches' AND COLUMN_NAME = 'referrer_id'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `coupon_batches` ADD COLUMN `referrer_id` INT UNSIGNED NULL AFTER `id`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches' AND INDEX_NAME = 'idx_coupon_batches_referrer'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `coupon_batches` ADD INDEX `idx_coupon_batches_referrer` (`referrer_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches' AND CONSTRAINT_NAME = 'fk_coupon_batches_referrer'
);
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE `coupon_batches` ADD CONSTRAINT `fk_coupon_batches_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `referrers` (`id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `service_relation_changes` MODIFY COLUMN `reason` ENUM('link','code','admin','migration','coupon') NOT NULL;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS coupon_batches_referrer_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches' AND COLUMN_NAME = 'referrer_id' AND IS_NULLABLE = 'YES';
SELECT COUNT(*) AS coupon_batches_referrer_fk_ok FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches' AND CONSTRAINT_NAME = 'fk_coupon_batches_referrer';
SELECT COUNT(*) AS service_relation_changes_coupon_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_relation_changes' AND COLUMN_NAME = 'reason' AND COLUMN_TYPE LIKE '%''coupon''%';
