-- ============================================================
-- 迁移：T2 家庭活动的打卡与提醒 t2_checkins、t2_practice_prefs（Keep 规格 K06、K07，§4.4）
-- 日期：2026-09-24
-- ============================================================
--
-- 两张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `/api/t2/checkins`、`/api/t2/practice-prefs`（含 `.ics`）会读写
-- 这两张表，表不存在时那几处直接回 500 —— 家长按「做完了，打卡」会失败。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰这两张表。
--
-- 【t2_checkins：做完一次记一笔】
-- 同一支活动一天可以打好几次卡，所以没有唯一键。日期由伺服器照 Asia/Shanghai 算
--（src/t2/weeks.ts），不收前端送来的日期；week_start 是那一周的星期一，与 t2_weekly_plans 同一个算法。
-- findings_id 记打卡当下这位家长最新的报告快照（还没生成过报告是 NULL）。**不设外键**：
-- 快照只会随家长一起被删（那时这些打卡也跟着走），而「这一笔算不算进计划」看的是活动是否在
-- 那一周的四支里，不靠它。
-- progress 记的是脚本「怎么看出有进步」勾了第几条（0 起）—— ⚠️ 存的是**位置**，后台改了那几条的
-- 顺序或删掉一条，旧的打卡会对到另一条。
-- 心情与进步**现在只记录**，配对不看它们（规格 §9 第 6 题，暂采）。
--
-- 【t2_practice_prefs：提醒】
-- 一位家长一列：每周哪几天（0 = 星期一 … 6 = 星期日）、几点（只收 08:30／12:30／19:30／20:30）。
-- 提醒不是我们发的：这一列画在打卡日历上，并产生 `.ics` 给手机日历去提醒。
--
-- 【家长资料】
-- 两张都是家长资料：外键 ON DELETE CASCADE（ADR-0006 删家长是硬删）。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_checkins` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `activity_id` VARCHAR(8) NOT NULL,
  -- 打卡当下最新的报告快照；片库里的活动也记，算不算进计划由活动是否在那一周的四支里决定。
  `findings_id` BIGINT UNSIGNED NULL,
  -- Asia/Shanghai 的日历日与那一周的星期一（src/t2/weeks.ts）。
  `checkin_date` DATE NOT NULL,
  `week_start` DATE NOT NULL,
  `mood` ENUM('engaged','ok','reluctant') NULL,
  -- 勾了脚本「怎么看出有进步」的第几条（0 起）。
  `progress` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_date` (`user_id`, `checkin_date`),
  CONSTRAINT `fk_t2_checkins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `t2_practice_prefs` (
  `user_id` INT UNSIGNED NOT NULL PRIMARY KEY,
  -- 0 = 星期一 … 6 = 星期日
  `reminder_days` JSON NOT NULL,
  -- 'HH:MM'，只收 08:30／12:30／19:30／20:30。
  `reminder_time` CHAR(5) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_t2_practice_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_checkins_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_checkins';

-- progress 是 JSON 栏位，不是 TEXT。
SELECT COUNT(*) AS t2_checkins_progress_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_checkins'
   AND COLUMN_NAME = 'progress' AND DATA_TYPE = 'json';

-- 查一段日期吃的索引。
SELECT COUNT(*) AS t2_checkins_index_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_checkins'
   AND INDEX_NAME = 'idx_user_date' AND SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'user_id';

-- 家长被后台删掉时，打卡跟着走。
SELECT COUNT(*) AS t2_checkins_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_checkins'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';

SELECT COUNT(*) AS t2_practice_prefs_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_practice_prefs';

SELECT COUNT(*) AS t2_practice_prefs_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_practice_prefs'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';
