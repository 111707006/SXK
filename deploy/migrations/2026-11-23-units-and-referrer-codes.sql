-- ============================================================
-- 迁移：合作单位的类型、推荐人代号（#117，ADR-0020，专案 A）
-- 日期：2026-11-23
-- ============================================================
--
-- **只加不删**：companies 一个有预设值的新栏、referrers 一个可为 NULL 的新栏与一个唯一索引
-- （加之前先看 information_schema）。完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**部署新版程式码之前**。新版后台读推荐人时会 JOIN companies 的 kind、读 referrers 的 code；
-- 栏位不在，后台「兑换码与优惠券」与清分读推荐人会失败。A、B 两个库都跑（B 的程式码不读这两栏，跑了无害、
-- 两边 schema 保持一致）。
--
-- 【companies.kind】合作单位的类型：institution＝机构（底下可以有好几位推荐人）、therapist＝个人治疗师
-- （恰好一位推荐人，他同时是单位管理者）。旧列一律是机构（栏位预设）；B 的每一家也都是机构。
-- 【referrers.code】推荐人个人连结的代号：`?c=<单位代号>&t=<推荐人代号>`。格式同进站代号，在同一个单位里唯一
-- （UNIQUE (company_id, code)；NULL 不算重复，所以旧的推荐人都还没有代号也没关系）。

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'kind'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `companies` ADD COLUMN `kind` ENUM(''institution'',''therapist'') NOT NULL DEFAULT ''institution'' AFTER `logo_url`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrers' AND COLUMN_NAME = 'code'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `referrers` ADD COLUMN `code` VARCHAR(64) NULL AFTER `company_id`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrers' AND INDEX_NAME = 'uk_referrers_company_code'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `referrers` ADD UNIQUE KEY `uk_referrers_company_code` (`company_id`, `code`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS companies_kind_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'kind';
SELECT COUNT(*) AS referrers_code_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrers' AND COLUMN_NAME = 'code';
SELECT COUNT(DISTINCT INDEX_NAME) AS referrers_code_unique_ok FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrers' AND INDEX_NAME = 'uk_referrers_company_code';
