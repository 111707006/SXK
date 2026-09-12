-- ============================================================
-- 迁移：T2 交卷纪录表 t2_tool_results（票 #57，规格 v2 §9.1）
-- 日期：2026-09-12
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `POST /api/t2/tool-results` 与 `GET /api/t2/tool-results`
-- 会读写这张表，表不存在时那两处直接回 500 —— 家长答完一支工具按交卷会失败，
-- 已完成的清单也读不出来。反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰这张表。
--
-- 【这张表是什么】
-- 家长答完一支工具、按交卷时的一笔纪录。**每次交卷一笔，不覆盖**（§5.1「重做会是新的一笔」）：
-- 同一支工具重做就多一列，「最新且完整的一笔」是读的时候挑的，不是写的时候盖的。
-- 原始答案（pre、answers）与算出来的结果（result ＝ ToolResult）都存；
-- **result 由伺服器算**（src/t2/scoring），前端送上来的只有答案。
--
-- 【为什么 pre／answers 与 result 里的是同一份】
-- ToolResult 本身就带 pre 与 answers。另外拆成两栏是为了不解开 result 也查得到原始作答
--（建常模、追一题的分布），拆的是查询上的方便，不是第二份真相 —— 读的一律以 result 为准。
--
-- 【child_snapshot】
-- 交卷当下孩子档案的快照（名字、出生日期、性别、当天的实足月龄）。user_data 那一列会被
-- 前端整包覆盖，半年后回头看这一笔时档案可能已经改过；快照让「这笔是几个月大时答的」
-- 有据可查。assessed_age_month 是**作答用的**月龄（出题依它），快照里的 ageMonth 是交卷
-- 当天算的，两者可以不同（表单开着跨了月）。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_tool_results` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 交卷当下的孩子档案：{"name","birthDate","gender","ageMonth"}。
  `child_snapshot` JSON NOT NULL,
  -- 22 支工具的代号（src/t2/toolkit 的 ToolId）：'sxk-lang'、'mchat-rf'……
  `tool_id` VARCHAR(16) NOT NULL,
  -- 题库版本（ToolResult.toolkitVersion）。题库换版之后旧列记着旧版本。
  `toolkit_version` VARCHAR(32) NOT NULL,
  -- 作答用的实足月龄（整数月，不进位）。出题与计分都依它。
  `assessed_age_month` SMALLINT UNSIGNED NOT NULL,
  -- 填表人身份 ＝ src/t2/types.ts 的 RATERS。没有治疗师（T2 没有治疗师在场）。
  `rater` ENUM('father','mother','caregiver','teacher','other') NOT NULL,
  -- 前置题答案（ToolResult.pre），原样。
  `pre` JSON NOT NULL,
  -- 逐题答案（ToolResult.answers）：题 key → 值。
  `answers` JSON NOT NULL,
  -- 伺服器算出来的整份 ToolResult（含 sections／overall／native／computedAt）。读的以这栏为准。
  `result` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 读取永远是「这位家长的全部」：一位家长 22 支 × 重做几次，几十列而已。
  INDEX `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_t2_tool_results_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_tool_results_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_tool_results';

-- result 是 JSON 栏位，不是 TEXT：MySQL 会在写入时验证它是合法 JSON。
SELECT COUNT(*) AS t2_tool_results_result_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_tool_results'
   AND COLUMN_NAME = 'result' AND DATA_TYPE = 'json';

-- 外键在：家长被后台删掉时这些列跟着走。
SELECT COUNT(*) AS t2_tool_results_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_tool_results'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';
