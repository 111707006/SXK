-- ============================================================
-- 迁移：T2 每周活动表 t2_weekly_plans（票 #60，规格 v2 §9.1）
-- 日期：2026-09-12
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `GET /api/t2/weekly-plan` 会读写这张表，表不存在时
-- 那一处直接回 500 —— 家长在报告页看不到本周的四支活动。反过来（先跑迁移、还没部署）
-- 是安全的：旧版程式码从来不碰这张表。
--
-- 【一周一笔】
-- 查的那周没有，就用最新的 T2Findings 快照＋当周实足月龄＋前四周派过的编号算一份存起来；
-- 之后同一周回同一份。**所以 (user_id, week_start) 是唯一的** —— 家长在同一周里重整两次
-- 页面必须拿到同一份四支活动，而配对函式对「前四周派过的」会扣分，重算一次就可能换掉一支。
-- 唯一索引是这件事的最后一道保险：两个并发请求同时算完时，第二笔会撞索引而不是多存一列。
--
-- 【为什么记 findings_id】
-- 这一周的活动是照**那一份快照**配的。家长下周重新生成报告（新的快照、可能不同的判定）时，
-- 这一周已经派出去的四支不该跟着变 —— 报告是写下后不改的，照它配出来的活动也是。
-- 外键指向 t2_findings：快照被删（家长帐号删除的连锁）时这几周也跟着走。
--
-- 【activities 这一栏存什么】
-- §9.1 写的是 {id, reason}[]。实际存的是它的超集：
--   {"picks":[{"id":"A017","dimension":"LANG","reason":{...}}],"preparing":["SEN"]}
-- 多两样东西，各有理由：
--   - dimension：模组 7 同时属于语言、注意力、社交、认知四个维度，光看活动不知道这一支
--     是为哪个维度挑的，而画面上的那句「因为……所以练……」要说得出来。
--   - preparing：某个维度配不到活动时画面说「准备中」并导向专家。从 picks 反推会把
--     「有候选但没抢到名额」误判成「准备中」（三个红灯维度时四个名额发不完）。
-- 活动的内容（标题、时长、器材、图文步骤）**不存**：那是活动库的事，内容团队改一支活动的
-- 步骤之后，家长这周打开看到的应该是改好的版本。存进来就等于给每一周复制一份活动库。
-- 记在勘误档。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_weekly_plans` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 这一周照哪一份报告快照配的。
  `findings_id` BIGINT UNSIGNED NOT NULL,
  -- 这一周的星期一（Asia/Shanghai）。算法在 src/t2/weeks.ts，伺服器与画面共用一份。
  `week_start` DATE NOT NULL,
  -- 见档头「activities 这一栏存什么」。
  `activities` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 一周一笔（档头）。同时也是「这位家长这一周有没有」那支查询吃的索引。
  UNIQUE KEY `uniq_user_week` (`user_id`, `week_start`),
  CONSTRAINT `fk_t2_weekly_plans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_t2_weekly_plans_findings` FOREIGN KEY (`findings_id`) REFERENCES `t2_findings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_weekly_plans_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_weekly_plans';

-- 一周一笔：唯一索引在。
SELECT COUNT(*) AS t2_weekly_plans_unique_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_weekly_plans'
   AND INDEX_NAME = 'uniq_user_week' AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1;

-- activities 是 JSON 栏位，不是 TEXT。
SELECT COUNT(*) AS t2_weekly_plans_activities_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_weekly_plans'
   AND COLUMN_NAME = 'activities' AND DATA_TYPE = 'json';

-- 两支外键：家长被后台删掉、或快照被删时，这几周跟着走。
SELECT COUNT(*) AS t2_weekly_plans_fk_user_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_weekly_plans'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';

SELECT COUNT(*) AS t2_weekly_plans_fk_findings_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_weekly_plans'
   AND REFERENCED_TABLE_NAME = 't2_findings' AND DELETE_RULE = 'CASCADE';
