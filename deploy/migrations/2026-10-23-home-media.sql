-- ============================================================
-- 迁移：首页素材 home_media（客户 10/22，issue #87／#88，规格 docs/specs/client-changes-2026-10-22-2-media.md）
-- 日期：2026-10-23
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **打开开关 HOME_MEDIA 之前**（只有专案 A）。开关关着时程式码不碰这张表；开着而表不在，后台「首页素材」
-- 会 500、公开端点回空（首页照旧是固定示范片）。
--
-- 【一列是什么】
-- 一张开屏（slot='splash'）或一张首页轮播（slot='banner'），图片或短片。档案放在主机的媒体目录
-- （MEDIA_DIR/home/），url 带 ?v= 版本。开屏只取启用中排序最前的一张。全站一套，不属于任何一家合作公司。

CREATE TABLE IF NOT EXISTS `home_media` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `slot` ENUM('splash','banner') NOT NULL,
  `kind` ENUM('image','video') NOT NULL,
  `url` VARCHAR(255) NOT NULL,
  -- 短片的封面（后台浏览器抽的一格）；图片是 NULL。
  `poster_url` VARCHAR(255) NULL,
  -- 点下去去哪里：站内路径或 https 网址（src/homeMedia/shape.ts 的 isSafeMediaLink）；NULL＝不连。
  `link` VARCHAR(500) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_home_media_slot` (`slot`, `active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
