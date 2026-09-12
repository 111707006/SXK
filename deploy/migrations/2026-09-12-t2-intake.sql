-- ============================================================
-- 迁移：T2 入口的状态表 t2_intake（票 #56，规格 v2 §4.3）
-- 日期：2026-09-12
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `GET /api/t2/plan` 与 `PUT /api/t2/diagnosis` 会读写
-- 这张表，表不存在时那两处直接回 500 —— 家长的 T1 报告上会少掉整个 T2 入口
--（前端把读取失败当成「暂时读不到」，不会伪装成「没有适用的工具」）。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不碰这张表。
--
-- 【这张表是什么】
-- 家长这一轮第二层深度评估的状态，目前只有一个栏位：入口选的「医师是否已告知诊断方向」
--（十选一，NULL ＝ 未告知）。一位家长一列、改了就覆盖、没有历史 —— 历史在 t2_findings
-- 的快照里（#59）。选了之后题量会变（DIS 表的工具全部提为必做），所以**付费前**就要能存，
-- `/api/t2/diagnosis` 因此在 T2 闸门的白名单上。
--
-- 【为什么不加在 user_data 上】
-- user_data 那一列是前端整包同步的（child／completed_scores／orders／report_history），
-- T2 的东西混进去，每一次存档都可能把它盖掉。
--
-- 【只有专案 A 需要】
-- 专案 B 没有深度评估。两边 schema 保持一致最省事，建了留着无害。

CREATE TABLE IF NOT EXISTS `t2_intake` (
  `user_id` INT UNSIGNED NOT NULL PRIMARY KEY,
  `diagnosis_direction` ENUM('cp','dd','id','ld','adhd','lang','emo','psych','tic','asd') DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_t2_intake_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS t2_intake_table_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_intake';

SELECT COUNT(*) AS t2_intake_diagnosis_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't2_intake'
   AND COLUMN_NAME = 'diagnosis_direction' AND IS_NULLABLE = 'YES';

-- 外键在：家长被后台删掉时这一列跟着走。
SELECT COUNT(*) AS t2_intake_fk_ok
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't2_intake'
   AND CONSTRAINT_NAME = 'fk_t2_intake_user' AND DELETE_RULE = 'CASCADE';
