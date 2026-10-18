-- ============================================================
-- 迁移：后台导出纪录 admin_exports（#69，规格 docs/specs/client-changes-2026-10-17.md §3.1）
-- 日期：2026-10-18
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版后台「家长 → 汇总 → 导出」每导出一次就写一列；表不在，导出会失败（500），
-- 档案不会给出去（少一笔纪录的导出等于没人知道资料出去过）。先跑迁移、还没部署是安全的：旧版不碰它。
--
-- 【两个库都要跑】
-- 专案 A、B 的后台都有汇总与导出（使用者 2026-10-18）。
--
-- 【一列记什么】
-- 谁（admin_user_id）、何时（created_at）、范围（scope_kind＋company_id：公司成员是自家；全域管理员是当下切到的
-- 那一家或「未归属」）、哪一种导出（kind）、几笔（row_count）、用了哪组筛选（filters，JSON 字串）。
-- 不存导出的内容本身。

CREATE TABLE IF NOT EXISTS `admin_exports` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT UNSIGNED NOT NULL,
  `scope_kind` ENUM('company','unassigned') NOT NULL,
  `company_id` INT UNSIGNED DEFAULT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `row_count` INT UNSIGNED NOT NULL,
  `filters` VARCHAR(255) DEFAULT NULL,
  `request_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_admin_exports_admin` (`admin_user_id`, `created_at`),
  INDEX `idx_admin_exports_company` (`company_id`, `created_at`),
  CONSTRAINT `fk_admin_exports_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 验证
-- ============================================================
-- 每一句都必须回 1。

SELECT COUNT(*) AS admin_exports_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_exports';

SELECT COUNT(*) AS admin_exports_row_count_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_exports'
   AND COLUMN_NAME = 'row_count';

SELECT COUNT(*) AS admin_exports_fk_admin_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_exports'
   AND REFERENCED_TABLE_NAME = 'admin_users';
