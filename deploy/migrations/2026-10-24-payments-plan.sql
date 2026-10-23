-- ============================================================
-- 迁移：payments 多一种范围 plan（训练计划）与月数栏（客户 10/22，issue #111，规格 docs/specs/client-changes-2026-10-22-3-plan.md）
-- 日期：2026-10-24
-- ============================================================
--
-- **只加不删**：scope 的列举值多 'plan'（MODIFY 只加值），多一栏 months（训练计划买几个月；T2／T3 是 NULL）。
-- 重复执行结果一样（加栏位前先看 information_schema）。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开开关 TRAINING_PLAN 之前**（只有专案 A）。旧版程式码不读 months、也不会产生 scope='plan' 的列。

ALTER TABLE `payments` MODIFY COLUMN `scope` ENUM('t2','t3','plan') NOT NULL DEFAULT 't3';

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'months'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `payments` ADD COLUMN `months` TINYINT UNSIGNED NULL AFTER `dimension_id`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) AS payments_months_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'months';
