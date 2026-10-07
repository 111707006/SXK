-- ============================================================
-- 迁移：三支活动的人物配置改照脚本总册（T2 v3 规格 P15）
-- 日期：2026-10-07
-- ============================================================
--
-- 客户 2026-10-06 的《居家训练影片导引脚本·总册·300 支》与手册（9/23）只有三支的人物配置不同：
-- A017、A030 手册「全家」、A040 手册「亲子」，脚本都是「亲子或全家」。脚本较新，以它为准。
-- 2026-09-23-activity-content.sql 的 people 只填 NULL，已经上过那份的资料库不会跟着变，所以另写这一份。
--
-- **完全可以重复执行**，而且只改「还是手册原文」的那几列：内容团队在后台改过的不盖掉。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 内容由 test/activityContent.test.ts 对 scripts/t2/activityContent.ts 的 peopleOverrides 比对（三支、两边原文）。
-- 只有专案 A 需要。专案 B 的 schema 一样有 activities 表，在 B 跑找得到列就写，但 B 没有画面读它，无害。

UPDATE `activities` SET `people` = '亲子或全家' WHERE `id` = 'A017' AND `people` = '全家';
UPDATE `activities` SET `people` = '亲子或全家' WHERE `id` = 'A030' AND `people` = '全家';
UPDATE `activities` SET `people` = '亲子或全家' WHERE `id` = 'A040' AND `people` = '亲子';

-- 还留着手册原文的列数。_gone 必须回 0（migrate.mjs 的命名约定）。
SELECT COUNT(*) AS activity_people_handbook_gone
  FROM `activities`
 WHERE (`id` = 'A017' AND `people` = '全家')
    OR (`id` = 'A030' AND `people` = '全家')
    OR (`id` = 'A040' AND `people` = '亲子');
