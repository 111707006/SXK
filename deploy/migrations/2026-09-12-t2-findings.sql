-- ============================================================
-- 迁移：T2 报告快照表 t2_findings（票 #59，规格 v2 §9.1）
-- 日期：2026-09-12
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `POST /api/t2/findings` 与 `GET /api/t2/findings/latest`
-- 会读写这张表，表不存在时那两处直接回 500 —— 家长按「生成报告」会失败。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰这张表。
--
-- 【这张表是什么】
-- 家长按「生成」时的快照，与 T1 报告同一个哲学：**写下后不改**。一次生成一列，
-- 不覆盖、不重算 —— 门槛改版（rules_version 换了）之后回头看半年前那份报告，
-- 读到的仍是当时那一份。所以 rules_version 与 toolkit_version 各自一栏：
-- 报告上要写得出「这份是依哪一版的题库与门槛算的」，而那不该靠解开 findings 的 JSON 去翻。
--
-- 【为什么 prose 可以是 NULL】
-- 三段备援（Qwen → Doubao → DashScope）全挂、或模型写出来的东西过不了验证器时，
-- 走模板退路（is_ai_generated = 0）。模板本身也是一份完整的 T2ReportProse，所以
-- 正常路径上 prose 总是有东西；NULL 留给「连模板都产不出来」这种今天不存在的路径，
-- 与「这一列坏了」区分得开。
--
-- 【ai_engine 记的是「哪一个引擎」，也记「为什么退了」】
-- is_ai_generated = 1 时是产出这份文字的模型代号（'qwen-3-5-plus-260215'……）；
-- = 0 时记的是退路的来源（'template:<引擎>' ＝ 那个引擎写了但没过验证；
-- 'template:all_engines_failed' ＝ 三段全挂）。排查「家长为什么拿到模板报告」时
-- 这一栏是唯一的线索，混成一个 'fallback_template' 就查不出是哪一种。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_findings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 门槛版本（T2Findings.rulesVersion）。门槛改版后旧快照记着旧版本，且不重算。
  `rules_version` VARCHAR(32) NOT NULL,
  -- 题库版本（T2Findings.toolkitVersion）。
  `toolkit_version` VARCHAR(32) NOT NULL,
  -- 整份 T2Findings（§5.8）：九个维度、每支工具最新且完整的一笔、T1 九码、诊断方向、
  -- 30 天内重做的那几支（redos）。报告、活动配对、SMART 目标都只读它。
  `findings` JSON NOT NULL,
  -- 整份 T2ReportProse（§6.3）：总览、逐维度、气质段、每周计划引言、结语。
  `prose` JSON NULL,
  -- 1 ＝ 模型写的且过了验证器；0 ＝ 模板退路。
  `is_ai_generated` TINYINT(1) NOT NULL DEFAULT 0,
  -- 见档头「ai_engine 记的是……」。
  `ai_engine` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 读取只有两种：「这位家长最新的一笔」与「某一笔」。前者吃这个索引。
  INDEX `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_t2_findings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_findings_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_findings';

-- findings 是 JSON 栏位，不是 TEXT：MySQL 会在写入时验证它是合法 JSON。
SELECT COUNT(*) AS t2_findings_findings_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_findings'
   AND COLUMN_NAME = 'findings' AND DATA_TYPE = 'json';

-- prose 可为 NULL（档头）。
SELECT COUNT(*) AS t2_findings_prose_nullable_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_findings'
   AND COLUMN_NAME = 'prose' AND IS_NULLABLE = 'YES';

-- 外键在：家长被后台删掉时这些列跟着走。
SELECT COUNT(*) AS t2_findings_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_findings'
   AND REFERENCED_TABLE_NAME = 'users' AND DELETE_RULE = 'CASCADE';
