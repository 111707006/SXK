-- ============================================================
-- 迁移：示范片与封面上架（Keep 规格 K05，§6）
-- 日期：2026-09-24
-- ============================================================
--
-- 十七支活动（A001–A006、A009–A019）写入示范片网址、封面网址与片长。只有 UPDATE，
-- 不改结构（poster_url、video_seconds 两栏由 2026-09-23-activity-content.sql 加）。
-- **完全可以重复执行**：
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【片子放在哪里】（规格 §6.2 甲、§9 第 1 题，使用者 2026-09-24 定）
-- 正式站主机的静态目录：/var/www/sxk/media/activities/A001.mp4、A001.jpg，由 server.ts 的
-- `/media` 服务（只在专案 A 挂）。网址是站内路径 /media/activities/A001.mp4，与后台验网址的规则
-- 相同（src/utils/assetUrl.ts：https:// 或站内 /…）。片子与封面由 scripts/t2-prepare-media.ts
-- 从客户的 NEWT2/T2视频_20260923.zip 产出到本机 media/（不进 git），**先传上主机，再跑这份迁移**：
-- 反过来的话，片库会列出十七支打不开的片。日后搬到物件储存，改的是这几栏的网址，程式码不动。
--
-- 【哪几支没上】
-- 007：档案与 006 位元组相同（画面是「红灯停绿灯行」），准备脚本用 sha256 挡下，等客户补「走直线」。
-- 008：客户在档名标了「不太好」。A020 与模组二以后：没有片，走图文。
--
-- 【重跑不盖掉后台填过的、也不把后台清掉的填回来】
-- migrate.mjs --confirm 每次都把每一份迁移从头跑一遍。规则与手册文字（2026-09-23 那份）相同：
-- NULL ＝ 从没设过，空字串 ＝ 后台刻意清掉的（src/admin/adminStore.ts 清掉示范片与封面存 ''）。
--   - video_url、poster_url：只填 NULL。内容团队换成别的网址不会被盖回来，下架的片（''）也不会自己回来。
--   - video_seconds：后台清掉存 NULL，所以另外要那支片还是清单上这一支（或也还没设）才补；
--     片被清掉或换成别的网址时不补，活动库里不会有「有片长、没有片」的一列。
-- 既有资料：这份之前，后台清掉示范片存的是 NULL；那种列会被当成「从没设过」填上（十七支之外的不受影响）。
-- 从这一版起清掉存 ''，就不会再被填回来。
--
-- 【内容从哪里来】
-- 标记之间的 UPDATE 与验证句由 scripts/t2-prepare-media.ts 从 src/t2/activityMedia.ts 印出，
-- **不要手改**：test/activityMedia.test.ts 会重印一次比对。
--
-- 【活动库仍不吃 company_id】
-- 活动是森心康的内容（ADR-0005），列在 test/adminScope.structure.test.ts 的 GLOBAL_TABLES。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估、没有活动，也没有 `/media`。在 B 的库上跑，UPDATE 找得到列就写
-- （两边 schema 一致），但 B 没有任何画面读它，无害。

-- ── 示範片 BEGIN（scripts/t2-prepare-media.ts 產生，請勿手改）
UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A001.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A001.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A001.mp4'), 10, `video_seconds`)
WHERE `id` = 'A001';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A002.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A002.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A002.mp4'), 10, `video_seconds`)
WHERE `id` = 'A002';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A003.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A003.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A003.mp4'), 10, `video_seconds`)
WHERE `id` = 'A003';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A004.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A004.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A004.mp4'), 10, `video_seconds`)
WHERE `id` = 'A004';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A005.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A005.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A005.mp4'), 10, `video_seconds`)
WHERE `id` = 'A005';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A006.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A006.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A006.mp4'), 10, `video_seconds`)
WHERE `id` = 'A006';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A009.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A009.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A009.mp4'), 10, `video_seconds`)
WHERE `id` = 'A009';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A010.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A010.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A010.mp4'), 5, `video_seconds`)
WHERE `id` = 'A010';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A011.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A011.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A011.mp4'), 10, `video_seconds`)
WHERE `id` = 'A011';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A012.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A012.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A012.mp4'), 10, `video_seconds`)
WHERE `id` = 'A012';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A013.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A013.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A013.mp4'), 10, `video_seconds`)
WHERE `id` = 'A013';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A014.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A014.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A014.mp4'), 10, `video_seconds`)
WHERE `id` = 'A014';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A015.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A015.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A015.mp4'), 10, `video_seconds`)
WHERE `id` = 'A015';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A016.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A016.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A016.mp4'), 10, `video_seconds`)
WHERE `id` = 'A016';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A017.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A017.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A017.mp4'), 10, `video_seconds`)
WHERE `id` = 'A017';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A018.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A018.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A018.mp4'), 10, `video_seconds`)
WHERE `id` = 'A018';

UPDATE `activities` SET
  `video_url` = IF(`video_url` IS NULL, '/media/activities/A019.mp4', `video_url`),
  `poster_url` = IF(`poster_url` IS NULL, '/media/activities/A019.jpg', `poster_url`),
  `video_seconds` = IF(`video_seconds` IS NULL AND (`video_url` IS NULL OR `video_url` = '/media/activities/A019.mp4'), 10, `video_seconds`)
WHERE `id` = 'A019';

-- 清單上的每一支都填過了（後台清掉的空字串也算，那是刻意的）。_gone 必須回 0（migrate.mjs 的命名約定）。
SELECT 17 - COUNT(*) AS activity_media_missing_gone
  FROM `activities`
 WHERE `id` IN ('A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A009', 'A010', 'A011', 'A012', 'A013', 'A014', 'A015', 'A016', 'A017', 'A018', 'A019')
   AND `video_url` IS NOT NULL
   AND `poster_url` IS NOT NULL;
-- ── 示範片 END
