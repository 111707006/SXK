-- ============================================================
-- 迁移：B 的家长免登入转到 A 做 T2 —— handoff_codes、handoff_imports、handoff_invites
-- （ADR-0009、docs/specs/b-to-a-handoff.md）
-- 日期：2026-09-28
-- ============================================================
--
-- 三张新表。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS；最后一段把同一天较早那一版（还没上线过）
-- 建出来的 handoff_codes 补成现在的样子，也可以重跑。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前，两个资料库（sxk_db、sxk_t1_db）都要跑。** 新版的 `/api/handoff/*` 与后台的邀请简讯
-- 会读写这几张表，表不存在时直接回 500。反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰它们。
-- 交接功能要设了 HANDOFF_SECRET 才会打开，没设就等于这几张表永远是空的。
--
-- 【handoff_codes：发出端（专案 B）用】
-- 一组交接码一列。码本身是 24 位元组乱数，**只存 SHA-256** —— 这一列若是明码，任何一份备份都等同
-- 一把能替那位家长在 A 登入的钥匙。**不过期、可以重复用**（使用者 2026-09-28：「只要登入 B 的就不用限制时间」）：
-- expires_at 一律 NULL（栏位留着，哪天要加时效只改写入那一句），每兑换一次记 use_count 与 last_used_at ——
-- 后台据此知道这位家长已经到过 A。
--
-- 【handoff_imports：接收端（专案 A）用】
-- 一次转入一列：A 的帐号、B 的帐号（另一个资料库，所以没有外键）、来源公司**当下的快照**、同意的版本、
-- 资料有没有真的带进去（A 已经有筛查就不覆盖，只记来源）。日后谈分润、算转换率都看这一张。
--
-- 【handoff_invites：发出端（专案 B）的后台用】
-- 后台发一则「到森心康做深度评估」的邀请简讯一列：发给谁、谁按的、用的是哪一组交接码、送出去没有。
-- 同一位家长 7 天内只发一封，看的就是这一张。
--
-- 【家长资料】
-- 三张都是家长资料：外键 ON DELETE CASCADE（ADR-0006 删家长是硬删）。
--
-- 【两边都建】
-- A、B 共用同一份 schema；各自只用得到其中几张，其余留着是空的、无害。

CREATE TABLE IF NOT EXISTS `handoff_codes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 交接码的 SHA-256（hex）。
  `code_hash` CHAR(64) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  -- button＝B 报告页的按钮；sms＝后台发的邀请简讯。
  `kind` ENUM('button','sms') NOT NULL,
  -- 家长按下时看到的同意文字版本。
  `consent_version` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- NULL＝不过期（现在全部都是）。
  `expires_at` DATETIME NULL,
  `use_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_used_at` DATETIME NULL,
  UNIQUE KEY `uk_handoff_code_hash` (`code_hash`),
  INDEX `idx_handoff_codes_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_handoff_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `handoff_imports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- B 的帐号 id（sxk_t1_db.users.id）。
  `source_user_id` INT UNSIGNED NOT NULL,
  -- 来源公司当下的快照；B 的家长可能未归属，三栏都是 NULL。
  `source_company_id` INT UNSIGNED NULL,
  `source_company_slug` VARCHAR(64) NULL,
  `source_company_name` VARCHAR(255) NULL,
  `kind` ENUM('button','sms') NOT NULL,
  `consent_version` VARCHAR(32) NULL,
  -- 1＝孩子档案与 T1 成绩带进去了；0＝A 已经有筛查，没有覆盖，只记来源。
  `imported` TINYINT(1) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_handoff_imports_user` (`user_id`, `created_at`),
  INDEX `idx_handoff_imports_company` (`source_company_id`, `created_at`),
  CONSTRAINT `fk_handoff_imports_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `handoff_invites` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 这一则简讯里的那组交接码；送失败就没有码（NULL）。
  `code_id` INT UNSIGNED NULL,
  -- 谁按的（后台帐号）；帐号删掉留 NULL，纪录还在。
  `admin_user_id` INT UNSIGNED NULL,
  `status` ENUM('sent','failed') NOT NULL,
  -- 失败时简讯通道回的原因（截短）。
  `detail` VARCHAR(255) NULL,
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_handoff_invites_user` (`user_id`, `sent_at`),
  CONSTRAINT `fk_handoff_invites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_handoff_invites_code` FOREIGN KEY (`code_id`) REFERENCES `handoff_codes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_handoff_invites_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 同一天较早那一版（还没上线过）的 handoff_codes 补成现在的样子 ──
-- 那一版 expires_at 是 NOT NULL、没有 use_count／last_used_at（另有一栏 redeemed_at，留着不用）。
-- 新建的表这三句什么都不改。

ALTER TABLE `handoff_codes` MODIFY COLUMN `expires_at` DATETIME NULL;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes' AND COLUMN_NAME = 'use_count'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `handoff_codes` ADD COLUMN `use_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `expires_at`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes' AND COLUMN_NAME = 'last_used_at'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `handoff_codes` ADD COLUMN `last_used_at` DATETIME NULL AFTER `use_count`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS handoff_codes_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes';

SELECT COUNT(*) AS handoff_codes_unique_hash_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes'
   AND INDEX_NAME = 'uk_handoff_code_hash' AND NON_UNIQUE = 0;

SELECT COUNT(*) AS handoff_codes_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_handoff_codes_user'
   AND DELETE_RULE = 'CASCADE';

SELECT COUNT(*) AS handoff_codes_no_expiry_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes'
   AND COLUMN_NAME = 'expires_at' AND IS_NULLABLE = 'YES';

SELECT COUNT(*) AS handoff_codes_use_count_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_codes' AND COLUMN_NAME = 'use_count';

SELECT COUNT(*) AS handoff_imports_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_imports';

SELECT COUNT(*) AS handoff_imports_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_handoff_imports_user'
   AND DELETE_RULE = 'CASCADE';

SELECT COUNT(*) AS handoff_invites_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_invites';

SELECT COUNT(*) AS handoff_invites_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_handoff_invites_user'
   AND DELETE_RULE = 'CASCADE';
