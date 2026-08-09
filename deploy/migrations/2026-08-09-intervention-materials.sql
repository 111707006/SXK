-- ============================================================
-- 迁移：干预素材库（issue #20）
-- 日期：2026-08-09
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**（CREATE TABLE IF NOT EXISTS），
-- 重跑不会报错也不会动到既有资料。
--
--   mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> \
--     < deploy/migrations/2026-08-09-intervention-materials.sql
--
-- 【什么时候跑】
-- 部署新版程式码之前或之后都可以。表不存在时，后台的素材库分页会以
-- 「读取素材库失败」呈现——不会伪装成「一格素材都还没建立」。这两件事在
-- 画面上分得开是刻意的：分不开的话，没跑迁移会被当成「还没有人建素材」，
-- 然后一路带到家长端。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估，也就没有干预包。两边 schema 保持一致最省事，
-- 建了留着无害（deploy/schema.sql 对 payments / unlocks 是同样的处置）。

CREATE TABLE IF NOT EXISTS `intervention_materials` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 九维之一。字串而非外键：维度是程式码里的常数（src/data.ts），不是资料表。
  `dimension_id` VARCHAR(64) NOT NULL,
  -- 年龄段 A–E，来自 src/t1Data.ts。
  `age_band_id` VARCHAR(8) NOT NULL,
  -- 与报告上的判定同一组字串。normal 不在其中：没被标记的维度不需要干预素材。
  `severity` ENUM('borderline','delay') NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  -- 分解步骤，有序阵列：[{"imageUrl":"…","instruction":"…"}, …]
  `steps` JSON NOT NULL,
  `video_url` VARCHAR(512) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 一格一笔。少了这个唯一键，同一格会有两笔素材，而配对逻辑（issue #26）
  -- 取到哪一笔要看资料库的心情——两个孩子会拿到不同的训练步骤。
  UNIQUE KEY `uk_material_cell` (`dimension_id`, `age_band_id`, `severity`),
  INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 这一句必须回 1。
SELECT COUNT(*) AS intervention_materials_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'intervention_materials';
