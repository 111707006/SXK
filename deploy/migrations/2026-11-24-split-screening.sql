-- ============================================================
-- 迁移：清分比例多一栏「筛查渠道比例」revenue_split_rates.screening_bp（#122，ADR-0020 第 8 点，只有专案 A 用到）
-- 日期：2026-11-24
-- ============================================================
--
-- **只加不删**：revenue_split_rates 一个可为 NULL 的新栏（加之前先看 information_schema），不动任何既有的列。
-- 完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开服务关系开关之前**（清分要同时开着）。开关关着的程式码不读也不写这一栏。
-- 【意思】家长最早进来的合作单位（筛查渠道，users.company_id）与现在的服务单位不同时，从对方那一份先切几成给它。
-- 只在单位那一层（scope = 'company'）设；NULL＝没设＝0（不分）。预设与推荐人那几列永远是 NULL。

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'revenue_split_rates' AND COLUMN_NAME = 'screening_bp'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `revenue_split_rates` ADD COLUMN `screening_bp` SMALLINT UNSIGNED NULL AFTER `company_bp`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS revenue_split_rates_screening_bp_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'revenue_split_rates' AND COLUMN_NAME = 'screening_bp';
