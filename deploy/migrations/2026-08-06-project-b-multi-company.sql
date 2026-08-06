-- ============================================================
-- 迁移：专案 B 多合作公司（issues #1–#13）
-- 日期：2026-08-06
-- ============================================================
--
-- ⚠️ **这份迁移必须在部署新版程式码之前跑完。**
--
-- 新版的 createUser 是 `INSERT INTO users (email, password, company_id)`。
-- company_id 不存在时这句会失败，而 server.ts 的注册路由会把 SQL 错误
-- 当成「资料库不可用」退回记忆体模式，然后回 {success: true} ——
-- 家长看到注册成功、拿到 token，但帐号没有进资料库，重启就消失。
-- 那不是报错，是静默的资料遗失。先跑这份，再部署。
--
-- 执行前请先备份。
--
--   mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> \
--     < deploy/migrations/2026-08-06-project-b-multi-company.sql
--
-- 【可重复执行吗】
-- CREATE TABLE 都是 IF NOT EXISTS，重跑无害。
-- 中段三行 ALTER TABLE 只能跑一次，重跑会报
-- "Duplicate column name / Duplicate key name" —— 那代表它已经跑过了，可以忽略。
-- MySQL 8 没有 ADD COLUMN IF NOT EXISTS，所以这里不假装它是幂等的。

-- ── 1. 合作公司。必须最先建立，users.company_id 的外键指向它 ──────────
CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  -- 进站连结的识别码：https://<域名>/?c=<slug>
  -- UNIQUE 是归属正确性的前提：两家公司共用一个 slug 等于把家长送给错的公司。
  `slug` VARCHAR(64) NOT NULL UNIQUE,
  `wecom_webhook_url` VARCHAR(512) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. 家长的归属 ────────────────────────────────────────────────
--
-- 既有家长一律留在 company_id = NULL（未归属）。
-- **不可**批次指派给任何一家公司 —— 那等于把一批人的健康资料送给一家
-- 他们从未接触过的机构。未归属的家长只有全域管理员看得到，不会消失。
--
-- ON DELETE SET NULL 而非 CASCADE：删掉一家合作公司不该连带删掉家长与
-- 孩子的健康资料，那些资料的掌管方是森心康，不是合作公司。
ALTER TABLE `users` ADD COLUMN `company_id` INT UNSIGNED DEFAULT NULL;
ALTER TABLE `users` ADD INDEX `idx_company_created` (`company_id`, `created_at`);
ALTER TABLE `users` ADD CONSTRAINT `fk_users_company`
  FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL;

-- ── 3. 后台帐号 ──────────────────────────────────────────────────
-- 刻意没有预设帐号：一个有预设密码的后台等于没有后台。
-- 第一个 global_admin 的建立步骤见 docs/进度-专案B多公司.md。
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  -- bcrypt 杂凑。此表**不接受**明码退路（家长端为了旧资料而保留的那条）。
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('global_admin','company_member') NOT NULL,
  -- global_admin 为 NULL；company_member 必须有值（由应用层保证）
  `company_id` INT UNSIGNED DEFAULT NULL,
  -- 停用要立刻生效，因此每次请求都回查这一栏，不能只信 token。
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company` (`company_id`),
  CONSTRAINT `fk_admin_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. 公司切换纪录 ──────────────────────────────────────────────
-- 「看得到所有公司」若是日常状态，误看永远不会被发现；
-- 切换是一个明确的动作，明确的动作才留得下痕迹。
CREATE TABLE IF NOT EXISTS `admin_company_switches` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT UNSIGNED NOT NULL,
  `company_id` INT UNSIGNED DEFAULT NULL,
  `selection` ENUM('company','unassigned') NOT NULL,
  `request_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_admin_created` (`admin_user_id`, `created_at`),
  CONSTRAINT `fk_switches_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. 专家（隶属于合作公司）─────────────────────────────────────
-- 从写死在 AnalysisReport.tsx 的三位森心康医师，变成各公司自备的资料。
-- 这张表是空的时候，专案 B 的报告页不显示预约区块，而是说明「尚未开放」。
CREATE TABLE IF NOT EXISTS `specialists` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `title` VARCHAR(128) DEFAULT NULL,
  -- 专长与资历分开：前者是「他看什么」，后者是「他凭什么」，家长端分段呈现
  `specialty` TEXT,
  `experience` TEXT,
  `avatar_url` VARCHAR(512) DEFAULT NULL,
  `slots` JSON DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company_active` (`company_id`, `active`),
  CONSTRAINT `fk_specialists_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. 验证 ──────────────────────────────────────────────────────
-- 这一句必须回 1。回 0 就代表第 2 步没成功，**先不要部署** ——
-- 部署上去的话，家长的注册会静默地写不进资料库。
SELECT COUNT(*) AS users_company_id_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'users'
   AND COLUMN_NAME = 'company_id';

-- 这一句必须回 4。
SELECT COUNT(*) AS new_tables_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('companies', 'admin_users', 'admin_company_switches', 'specialists');
