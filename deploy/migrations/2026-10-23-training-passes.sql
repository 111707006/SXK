-- ============================================================
-- 迁移：居家训练使用权 training_passes（客户 10/22，issue #91，规格 docs/specs/client-changes-2026-10-22-3-plan.md，ADR-0013）
-- 日期：2026-10-23
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **打开开关 TRAINING_PLAN 之前**（只有专案 A）。开关关着时程式码不碰这张表。
--
-- 【一列是什么】
-- 一段居家训练使用权：起日、迄日（Asia/Shanghai 的日历日，头尾都含）、月数（1／3／6 → 28／84／168 天）、
-- 来源（付款、兑换码、推荐人代填、T2 附送一个月）与它的参照（付款或兑换码的编号）。
-- `unique_key` 挡住同一件事发两段：T2 附送一位家长只一段（`t2_bonus:<家长>`）、同一笔付款回调重送只一段
-- （`payment:<付款>`）、同一组兑换码只一段（`code:<码>`）。其余是 NULL（UNIQUE 允许多个 NULL）。
-- 删家长是硬删（ADR-0006），外键连带删掉。

CREATE TABLE IF NOT EXISTS `training_passes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `starts_on` DATE NOT NULL,
  `ends_on` DATE NOT NULL,
  `months` TINYINT UNSIGNED NOT NULL,
  `source` ENUM('payment','code','proxy','t2_bonus') NOT NULL,
  `ref_id` INT UNSIGNED NULL,
  `unique_key` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_training_pass_key` (`unique_key`),
  INDEX `idx_training_passes_user` (`user_id`, `ends_on`),
  CONSTRAINT `fk_training_passes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
