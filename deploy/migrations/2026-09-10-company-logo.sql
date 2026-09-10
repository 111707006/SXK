-- ============================================================
-- 迁移：合作公司各自的 LOGO
-- 日期：2026-09-10
-- ============================================================
--
-- 一个新栏位。**可以重复执行**：先查 information_schema，已经有了就跳过，
-- 重跑不会报 Duplicate column name 也不会动到既有资料。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。栏位不存在时，后台「本机构设定」读公司资料会
-- 直接失败（SELECT c.* 取不到这一栏，rowToCompany 读到 undefined），
-- 而那一页正是拿来设定 LOGO 的。先跑迁移，再部署。
--
-- 反过来（先跑迁移、还没部署）是安全的：多一个没有人写入的栏位，
-- 家长端与后台都不会有任何变化。
--
-- 【只有专案 B 需要】
-- 专案 A 一家合作公司都没有（adminCenter.multiCompany = false），
-- `companies` 表在 A 的库里是空的。两边 schema 保持一致最省事，
-- 建了留着无害。
--
-- 【为什么存网址而不是图档】
-- 这个 repo **没有档案上传能力**，外部依赖清册里也没有物件储存服务
-- （见 docs/adr/0003）。所以这里存的是一条网址，只收 `https://` 或站内的
-- `/…` 路径 —— `http://` 的图在 https 的页面上会被浏览器当成混合内容挡掉，
-- 后台看起来存好了、家长那边是一张破图，而且没有人会收到讯息。
-- 规则与干预素材共用同一份（src/utils/assetUrl.ts），不另立一套。

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'companies'
     AND COLUMN_NAME = 'logo_url'
);

SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE `companies` ADD COLUMN `logo_url` VARCHAR(512) DEFAULT NULL COMMENT ''家长端页首与登入卡上的 LOGO 网址。留空则用建置内建的字标。'' AFTER `wecom_webhook_url`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── 验证 ──────────────────────────────────────────────────────
-- 这一句必须回 1。
SELECT COUNT(*) AS companies_logo_url_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'companies'
   AND COLUMN_NAME = 'logo_url';
