-- ============================================================
-- 迁移：B 的家长免登入转到 A 做 T2 —— handoff_codes、handoff_imports（ADR-0009、docs/specs/b-to-a-handoff.md）
-- 日期：2026-09-28
-- ============================================================
--
-- 两张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前，两个资料库（sxk_db、sxk_t1_db）都要跑。** 新版的 `/api/handoff/*` 会读写这两张表，
-- 表不存在时直接回 500。反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰它们。
-- 交接功能要设了 HANDOFF_SECRET 才会打开，没设就等于这两张表永远是空的。
--
-- 【handoff_codes：发出端（专案 B）用】
-- 一组交接码一列。码本身是 32 位元组乱数，**只存 SHA-256** —— 这一列若是明码，任何一份备份都等同
-- 一把能替那位家长在 A 登入的钥匙。到期与「已用」都由资料库的时钟判断（同 sms_codes）。
--
-- 【handoff_imports：接收端（专案 A）用】
-- 一次转入一列：A 的帐号、B 的帐号（另一个资料库，所以没有外键）、来源公司**当下的快照**、同意的版本、
-- 资料有没有真的带进去（A 已经有筛查就不覆盖，只记来源）。日后谈分润、算转换率都看这一张。
--
-- 【家长资料】
-- 两张都是家长资料：外键 ON DELETE CASCADE（ADR-0006 删家长是硬删）。
--
-- 【两边都建】
-- A、B 共用同一份 schema；各自只用得到其中一张，另一张留着是空的、无害。

CREATE TABLE IF NOT EXISTS `handoff_codes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 交接码的 SHA-256（hex）。
  `code_hash` CHAR(64) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  -- button＝B 报告页的按钮（2 分钟）；sms＝简讯邀请（72 小时，第二期）。
  `kind` ENUM('button','sms') NOT NULL,
  -- 家长按下时看到的同意文字版本。
  `consent_version` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `redeemed_at` DATETIME NULL,
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

SELECT COUNT(*) AS handoff_imports_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoff_imports';

SELECT COUNT(*) AS handoff_imports_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_handoff_imports_user'
   AND DELETE_RULE = 'CASCADE';
