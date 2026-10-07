-- ============================================================
-- 迁移：线上干预的「一期」t2_training_periods（T2 v3 规格 §6.1）
-- 日期：2026-10-07
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。只有 TRAINING_PUSH_V3 打开时程式才读写这张表；关着时旧版配对照跑、
-- 不碰它。先跑迁移、还没部署是安全的。
--
-- 【一期是什么】
-- 客户 2026-10-06《推送规则说明书》：一期 12 周 × 每周 3 支 ＝ 36 支，开期时一次排好（颜色 → 名额 →
-- 月龄窗 → 依编号），之后不再重算。每一周照旧另写一列 t2_weekly_plans（打卡统计、历史都读它），
-- 那一列的内容就是这一期那一周的几格。
--
-- 【一位家长、一份快照可以有好几期】
-- 第 12 周过完、没有新的报告时，依完成率开下一期（period_no + 1）。重新生成报告＝新的快照，从第 1 期重来。
-- (user_id, findings_id, period_no) 唯一：两个并发请求同时开期时，第二笔撞索引，读回第一笔。
--
-- 【plan 这一栏存什么】
-- {"perWeek":3,"sampleOnly":false,"dimensions":[…],"weeks":[[{week,dimension,activityId,variant,reason}…]×12]}
-- 只存活动编号；内容每次从活动库查（同 t2_weekly_plans）。开期之后某一支被停用，写那一周时补下一支，
-- 只改 plan 里那一格（UPDATE 这一列）。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_training_periods` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `findings_id` BIGINT UNSIGNED NOT NULL,
  `period_no` INT UNSIGNED NOT NULL,
  `first_week_start` DATE NOT NULL,
  `age_month` INT UNSIGNED NOT NULL,
  `adjustment` VARCHAR(8) NOT NULL,
  `completion` DECIMAL(5,4) NULL,
  `plan` JSON NOT NULL,
  `rules_version` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_findings_period` (`user_id`, `findings_id`, `period_no`),
  CONSTRAINT `fk_t2_training_periods_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_t2_training_periods_findings` FOREIGN KEY (`findings_id`) REFERENCES `t2_findings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_training_periods_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_training_periods';

SELECT COUNT(*) AS t2_training_periods_index_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_training_periods'
   AND INDEX_NAME = 'uniq_user_findings_period' AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1;

SELECT COUNT(*) AS t2_training_periods_plan_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_training_periods'
   AND COLUMN_NAME = 'plan' AND DATA_TYPE = 'json';

SELECT COUNT(*) AS t2_training_periods_fk_user_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_training_periods'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';

SELECT COUNT(*) AS t2_training_periods_fk_findings_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_training_periods'
   AND REFERENCED_TABLE_NAME = 't2_findings' AND DELETE_RULE = 'CASCADE';
