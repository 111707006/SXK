-- ============================================================
-- 迁移：清分 revenue_split_rates，payments 多一栏 split_snapshot（客户 11/03〈清分〉，
-- 规格 docs/specs/client-changes-2026-11-03.md，ADR-0016，开关 REVENUE_SPLIT）
-- 日期：2026-11-07
-- ============================================================
--
-- **只加不删**：一张新表（CREATE TABLE IF NOT EXISTS）＋ payments 一个可为 NULL 的新栏（加之前先看 information_schema）。
-- 完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开开关 REVENUE_SPLIT 之前**（只有专案 A）。旧版程式码不读这张表、也不写 payments 的新栏。
--
-- 【比例】一个预设＋个别覆写（每家公司、每位推荐人）。只有全域管理员能改，不留修改纪录（规格）。
-- 【快照】payments.split_snapshot：订单成立（开单）那一刻的对方与比例（src/revenueSplit/split.ts 的 SplitSnapshot），
-- 改比例只对之后的新订单生效。开关打开之前的订单是 NULL（对帐表上写「未记录」）。

CREATE TABLE IF NOT EXISTS `revenue_split_rates` (
  -- default：预设那一组（ref_id 固定 0）；company：某家合作公司（companies.id）；referrer：某位推荐人（referrers.id）。
  `scope` ENUM('default','company','referrer') NOT NULL,
  `ref_id` INT UNSIGNED NOT NULL DEFAULT 0,
  -- 万分比（2000＝20%）；NULL＝没设，往上一层找（推荐人 → 公司 → 预设 → 程式里的 20%）。
  -- platform_bp：平台拿扣掉微信手续费之后的几成；company_bp：三方时合作公司拿「对方那一份」的几成（其余给治疗师）。
  `platform_bp` SMALLINT UNSIGNED NULL,
  `company_bp` SMALLINT UNSIGNED NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`scope`, `ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'split_snapshot'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `payments` ADD COLUMN `split_snapshot` JSON NULL AFTER `list_amount_fen`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS revenue_split_rates_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'revenue_split_rates';
SELECT COUNT(*) AS payments_split_snapshot_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'split_snapshot';
