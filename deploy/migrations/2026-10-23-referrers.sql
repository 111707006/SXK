-- ============================================================
-- 迁移：推荐人 referrers、推荐绑定 referrer_bindings；admin_users 角色多 referrer
-- （客户 10/22，issue #93，规格 docs/specs/client-changes-2026-10-22-3-plan.md）
-- 日期：2026-10-23
-- ============================================================
--
-- **只加不删**：两张新表（CREATE TABLE IF NOT EXISTS）＋ admin_users.role 的列举值多一个 'referrer'
-- （MODIFY 只加值，既有的列不受影响；重复执行结果一样）。程式码退回时资料库不必跟着退：旧版程式码不认得
-- 'referrer' 的帐号，那些帐号登入不了（adminAuth 只认两种角色）——那正是要的。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**部署新版程式码之前**（只有专案 A 用到；B 跑了也无害）。新版后台登入时会 LEFT JOIN referrers，
-- 表不在会让**所有**后台登入失败。

ALTER TABLE `admin_users` MODIFY COLUMN `role` ENUM('global_admin','company_member','referrer') NOT NULL;

CREATE TABLE IF NOT EXISTS `referrers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 推荐人用来登入后台的帐号（角色 referrer）；一个帐号一位推荐人。
  `admin_user_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  -- 渠道商／治疗师
  `kind` ENUM('channel','therapist') NOT NULL,
  -- 可选：隶属哪一家合作公司（代填建帐号时，家长的归属＝这一家；没有就是未归属）。
  `company_id` INT UNSIGNED NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_referrers_admin_user` (`admin_user_id`),
  CONSTRAINT `fk_referrers_admin_user` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_referrers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `referrer_bindings` (
  -- 一位家长只绑一位推荐人：第一次用掉某位推荐人的兑换码（或被代填）就固定，之后不改（家长为主键）。
  `user_id` INT UNSIGNED NOT NULL PRIMARY KEY,
  `referrer_id` INT UNSIGNED NOT NULL,
  `source` ENUM('code','proxy') NOT NULL,
  -- 兑换码的编号（source=code）；代填是 NULL。
  `ref_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_referrer_bindings_referrer` (`referrer_id`),
  CONSTRAINT `fk_referrer_bindings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_referrer_bindings_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `referrers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS referrers_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrers';
SELECT COUNT(*) AS referrer_bindings_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrer_bindings';
SELECT COUNT(*) AS admin_users_referrer_role_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users' AND COLUMN_NAME = 'role' AND COLUMN_TYPE LIKE '%referrer%';
