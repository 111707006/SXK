-- ============================================================
-- 迁移：t2_tool_results 加一栏 rater_note（客户 10/17 第 5 项，#70，规格 docs/specs/client-changes-2026-10-17.md §6）
-- 日期：2026-10-18
-- ============================================================
--
-- 只加一栏，不删、不改既有栏位（rater 的 ENUM 照旧留着 'teacher'：开关打开以前交的卷要读得出）。
-- **完全可以重复执行**：先查 information_schema，已经有了就跳过（与 2026-09-10 的 LOGO 同一个写法）。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版在开关 T2_RATER_V2 开着、家长选「其他」又写了是谁时，INSERT 会多写这一栏；
-- 栏位不在那一次交卷就 500。开关关着、或没写说明时，INSERT 与旧版一字不差，不碰这一栏。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码不知道这一栏，NULL 留着。
--
-- 【这一栏是什么】
-- 家长在 T2 作答画面选填表人「其他」时可以写一句是谁（例：阿姨）：去头尾空白、最多 10 字，没写就是 NULL。
-- 同一句也在 result（整份 ToolResult）的 raterNote 里 —— 读的一律以 result 为准，这一栏是查询上的方便，
-- 与 rater、pre、answers 拆栏同一个理由（见 2026-09-12 那一份的档头）。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，加了留着无害。

-- 与 deploy/schema.sql 的 CREATE TABLE `t2_tool_results` 一致（test/t2ToolResults.structure.test.ts 比对定义与位置）。
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_tool_results' AND COLUMN_NAME = 'rater_note'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE `t2_tool_results` ADD COLUMN `rater_note` VARCHAR(10) DEFAULT NULL AFTER `rater`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 验证
-- ============================================================
-- 必须回 1。

SELECT COUNT(*) AS t2_tool_results_rater_note_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_tool_results'
   AND COLUMN_NAME = 'rater_note';
