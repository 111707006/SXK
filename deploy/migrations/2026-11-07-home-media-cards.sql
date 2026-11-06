-- ============================================================
-- 迁移：home_media 的 slot 多两个值 card_t1、card_training（客户 11/03 第 7 页，规格 docs/specs/client-changes-2026-11-03.md）
-- 日期：2026-11-07
-- ============================================================
--
-- 只把 ENUM 加长（原本两个值的顺序与意思不变），不删、不改既有资料。**完全可以重复执行**：MODIFY 成同一个定义没有副作用。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**（只有专案 A，要先跑过 2026-10-23-home-media.sql）。新版后台「首页素材」多两块：
-- 首页 T1 卡与「线上家庭个性化训练」卡的图；没跑这份就上传，INSERT 会因 ENUM 不认得而 500。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码只写 splash／banner。
--
-- 【两个新值】
-- card_t1、card_training：只收图片，取启用中排序最前的一张；没有就首页照旧用内建的图。

-- 与 deploy/schema.sql 的 CREATE TABLE `home_media` 的 slot 一致（test/homeMediaShape.test.ts 比对）。
ALTER TABLE `home_media` MODIFY `slot` ENUM('splash','banner','card_t1','card_training') NOT NULL;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS home_media_card_slots_ok FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'home_media' AND COLUMN_NAME = 'slot'
   AND COLUMN_TYPE = 'enum(''splash'',''banner'',''card_t1'',''card_training'')';
