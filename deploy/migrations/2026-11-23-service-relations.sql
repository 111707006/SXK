-- ============================================================
-- 迁移：服务关系 service_relations、改派纪录 service_relation_changes（#118，ADR-0020，只有专案 A 用到）
-- 日期：2026-11-23
-- ============================================================
--
-- **只加不删**：两张新表（CREATE TABLE IF NOT EXISTS），不动任何既有的表。完全可以重复执行。
-- 旧的归属栏位（users.company_id）与推荐绑定（referrer_bindings）留着不删、照旧写。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开服务关系开关之前**（只有专案 A；B 跑了也无害）。开关关着的程式码不读这两张表。
-- 【旧资料】这份只建表、一列都不写。旧资料转成服务关系是另一份迁移（#123），附预演。
--
-- 【服务关系】家长「现在」由哪个合作单位、哪位推荐人服务；一位家长最多一列，没有列＝森心康直属。可以改派。
-- 【改派纪录】每次变动一列，只增不改：改之前、改之后、谁改的、原因、时间。

CREATE TABLE IF NOT EXISTS `service_relations` (
  -- 一位家长最多一列；没有列＝森心康直属。
  `user_id` INT UNSIGNED NOT NULL PRIMARY KEY,
  -- 现在服务这位家长的合作单位（companies.id）。
  `company_id` INT UNSIGNED NOT NULL,
  -- 现在服务的推荐人（referrers.id）；NULL＝单位里还没标注（只有单位管理者看得到）。
  `referrer_id` INT UNSIGNED NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_service_relations_company` (`company_id`, `referrer_id`),
  INDEX `idx_service_relations_referrer` (`referrer_id`),
  CONSTRAINT `fk_service_relations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  -- 删掉一个单位：这位家长回到森心康直属（与 users.company_id 同理：家长资料不跟着单位删）。
  CONSTRAINT `fk_service_relations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  -- 删掉一位推荐人：回到单位里还没标注。
  CONSTRAINT `fk_service_relations_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `referrers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_relation_changes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 改之前、改之后。单位是 NULL＝没有服务关系（森心康直属）；推荐人是 NULL＝还没标注。
  -- 刻意不设外键：单位或推荐人之后删掉，纪录照样留着。
  `from_company_id` INT UNSIGNED NULL,
  `from_referrer_id` INT UNSIGNED NULL,
  `to_company_id` INT UNSIGNED NULL,
  `to_referrer_id` INT UNSIGNED NULL,
  -- 谁改的：admin＝后台帐号（admin_user_id）；parent＝家长自己（连结、兑换码、换人提示选「换」）；system＝迁移。
  `actor` ENUM('admin','parent','system') NOT NULL,
  -- 原因：连结／兑换码／后台改派／迁移（src/serviceRelations/rules.ts 的 CHANGE_REASONS）。
  `reason` ENUM('link','code','admin','migration') NOT NULL,
  -- actor=admin 时是改的那个后台帐号；其他是 NULL。不设外键，理由同上。
  `admin_user_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_service_relation_changes_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_service_relation_changes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS service_relations_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_relations';
SELECT COUNT(*) AS service_relation_changes_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_relation_changes';
