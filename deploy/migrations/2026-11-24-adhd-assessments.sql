-- ============================================================
-- 迁移：成人 ADHD 的评估纪录 adhd_assessments（2026-11-24）
-- 日期：2026-11-24
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- 成人 ADHD（APP_MODE=adhd）的资料库 sxk_adhd_db，在部署新版程式码之前（先套整份 deploy/schema.sql）。
-- 专案 A、B 的程式码不碰这张表，跑了也无害。
--
-- 【一列是什么】
-- 受评者做完一次评估（客户页面走到报告）存的那一份：客户页面 casePayload() 原样（作答、页面算的分数与结论）。
-- 同一份个案（bridge 给的 client_case_id）回头改答案再看报告，更新的是同一列；开始新的评估是新的一列。
-- 设计：docs/specs/adhd-product-design.md 第 4 节。没有 company_id：公司范围经 users 带出。

CREATE TABLE IF NOT EXISTS `adhd_assessments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `client_case_id` VARCHAR(100) NOT NULL,
  `page_version` VARCHAR(40) NOT NULL,
  `payload` JSON NOT NULL,
  `subject_name` VARCHAR(100) NOT NULL,
  `conclusion_status` VARCHAR(20) NOT NULL,
  `conclusion_title` VARCHAR(100) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_case` (`user_id`, `client_case_id`),
  INDEX `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_adhd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS adhd_assessments_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adhd_assessments';
