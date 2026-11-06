-- ============================================================
-- 迁移：T2 优惠券 coupon_batches、coupon_codes，payments 多两栏（客户 11/03 简报第 21、29 页，
-- 规格 docs/specs/client-changes-2026-11-03.md〈优惠券〉，开关 T2_COUPON）
-- 日期：2026-11-07
-- ============================================================
--
-- **只加不删**：两张新表（CREATE TABLE IF NOT EXISTS）＋ payments 两个可为 NULL 的新栏（加之前先看 information_schema）。
-- 完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开开关 T2_COUPON 之前**（只有专案 A）。旧版程式码不读这两张表、也不写 payments 的新栏。
--
-- 【一批、一张】一批＝全域管理员一次产的 N 张，折法存在批次上（后台可改）；一张码 10 码（与兑换码同一种字元），存明码。
-- 状态：unused → used（家长兑换，那一刻就算用掉、绑在这位家长身上）／void（全域管理员作废，只有 unused 能作废）。
-- 每位家长只能用一张：coupon_codes.used_by 是 UNIQUE。
-- payments.coupon_code_id／list_amount_fen：T2 订单用了哪一张、折前多少（对帐用）；没用券是 NULL。

CREATE TABLE IF NOT EXISTS `coupon_batches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 后台自己认批次用的备注（例「11 月门诊」），不给家长看。
  `note` VARCHAR(40) NULL,
  -- percent：打几折，discount_value 是实付的百分比（50＝五折＝半价）；amount：减固定金额，discount_value 是分。
  `discount_kind` ENUM('percent','amount') NOT NULL DEFAULT 'percent',
  `discount_value` INT UNSIGNED NOT NULL DEFAULT 50,
  `quantity` INT UNSIGNED NOT NULL,
  -- 最后一天可以兑换（含当天）；NULL＝不过期。
  `expires_on` DATE NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_coupon_batches_admin` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coupon_codes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT UNSIGNED NOT NULL,
  `code` CHAR(10) NOT NULL,
  `status` ENUM('unused','used','void') NOT NULL DEFAULT 'unused',
  -- 用掉它的家长。UNIQUE：每位家长只能用一张（NULL 不算重复）。家长帐号删掉留 NULL。
  `used_by` INT UNSIGNED NULL,
  `used_at` DATETIME NULL,
  `voided_at` DATETIME NULL,
  UNIQUE KEY `uk_coupon_codes_code` (`code`),
  UNIQUE KEY `uk_coupon_codes_used_by` (`used_by`),
  INDEX `idx_coupon_codes_batch` (`batch_id`, `status`),
  CONSTRAINT `fk_coupon_codes_batch` FOREIGN KEY (`batch_id`) REFERENCES `coupon_batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coupon_codes_user` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'coupon_code_id'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `payments` ADD COLUMN `coupon_code_id` INT UNSIGNED NULL AFTER `months`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'list_amount_fen'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `payments` ADD COLUMN `list_amount_fen` INT UNSIGNED NULL AFTER `coupon_code_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS coupon_batches_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_batches';
SELECT COUNT(*) AS coupon_codes_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupon_codes';
SELECT COUNT(*) AS payments_coupon_code_id_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'coupon_code_id';
SELECT COUNT(*) AS payments_list_amount_fen_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'list_amount_fen';
