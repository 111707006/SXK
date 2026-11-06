-- ============================================================
-- 迁移：后台可编辑的条款 legal_documents（客户 11/03 第 14 页，规格 docs/specs/client-changes-2026-11-03.md）
-- 日期：2026-11-07
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **打开开关 LEGAL_DOCS 之前**（只有专案 A）。开关关着时程式码不碰这张表；开着而表不在，后台「条款」存档会 500、
-- 家长端读回「没存过」（照旧是内建条款）。
--
-- 【一列是什么】
-- 一份条款的 Markdown（service＝服务及免责条款、privacy＝隐私保护条款）。没有这一列＝家长端画程式码里内建的条款。
-- updated_at 存 UTC（程式写 UTC_TIMESTAMP()），家长端落款的「最后更新日期」照 Asia/Shanghai 换算。
-- 改了不要求家长重新勾同意（使用者 2026-11-06），所以没有版本号、没有历史；全站一套，不属于任何一家合作公司。

CREATE TABLE IF NOT EXISTS `legal_documents` (
  `doc_key` ENUM('service','privacy') NOT NULL PRIMARY KEY,
  `markdown` MEDIUMTEXT NOT NULL,
  -- UTC（src/db/legalDocs.ts 写 UTC_TIMESTAMP()）
  `updated_at` DATETIME NOT NULL,
  -- 最后一次存档的后台帐号（admin_users.id）；帐号删了留着数字，不设外键
  `updated_by` INT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS legal_documents_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'legal_documents';
