-- ============================================================
-- 迁移：权益分 T2／T3 两种范围（票 #45，T2 整份买一次）
-- 日期：2026-09-11
-- ============================================================
--
-- **可以重复执行**：加栏位前先查 information_schema，索引的增删靠 migrate.mjs
-- 的错误码容忍（ER_DUP_KEYNAME／ER_CANT_DROP_FIELD_OR_KEY）。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- **部署新版程式码之前**。新版的 `/api/unlocks` 与 T2 闸门会 SELECT `scope`，
-- 栏位不存在时那两处直接回 500 —— 家长会停在「无法读取已解锁维度」。
-- 反过来（先跑迁移、还没部署）是安全的：旧版程式码从来不写也不读 `scope`，
-- 既有的 t3 权益照常运作。
--
-- 【为什么要有 scope】
-- 定价改了：T2 是**整份买一次**，T3 才绑维度（规格 §9、v1 §8.2）。
-- 旧表每一列都绑一个维度，因为当时九个维度各卖一份深度评估。
-- 这是「先扩后缩」的扩：旧栏位不删、旧验法不改，t3 那一半原封不动。
--
-- 【既有列一律 t3】
-- 它们是按维度买的，定义上就是 t3。新栏位用 `NOT NULL DEFAULT 't3'` 加上去，
-- 既有列在 ALTER 当下就全部填好 t3；底下那句 UPDATE 是把这件事写明白，
-- 重跑也不会动到任何东西。
-- DEFAULT 留着不拿掉：万一日后有程式码忘了带 scope，那一列会变成 t3 权益，
-- 也就是**拿不到 T2**。方向是对的 —— 忘了带的后果该是少给，不是多给。
--
-- 【为什么要多一个 entitlement_key】
-- `dimension_id` 改成可 null 之后，原本的 `UNIQUE (user_id, dimension_id)`
-- 对 T2 完全失效：MySQL 的唯一键**不管 NULL**，同一位家长可以有无限多列
-- t2 权益。而那个唯一键正是整条付费流程的幂等关键（微信回调会重送最多 15 次，
-- 回跳查单还会再撞一次）。
-- 所以补一个衍生栏位把 NULL 换成 `'*'` 这个哨兵值 —— 维度 id 全是 snake_case
-- 的英数字，撞不到它 —— 再对 (user_id, scope, entitlement_key) 建唯一键。
-- 这样「同一位家长的同一种权益只有一列」重新成为**资料库层级**的保证，
-- 而不是只写在程式码的注解里。

-- ── 1. unlocks.scope ────────────────────────────────────────
SET @has_scope := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'unlocks'
     AND COLUMN_NAME = 'scope'
);

SET @sql := IF(
  @has_scope = 0,
  'ALTER TABLE `unlocks` ADD COLUMN `scope` ENUM(''t2'',''t3'') NOT NULL DEFAULT ''t3'' COMMENT ''t2＝整份深度评估，一位家长一列，dimension_id 为 NULL；t3＝单一维度'' AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 既有列都是按维度买的。ADD COLUMN 的 DEFAULT 已经填好，这一句是写明白。
UPDATE `unlocks` SET `scope` = 't3' WHERE `scope` IS NULL OR `scope` = '';

-- ── 2. unlocks.dimension_id 改可 null ───────────────────────
-- t2 的列没有维度可填。重跑一次只是把同样的定义再写一遍，无害。
ALTER TABLE `unlocks` MODIFY COLUMN `dimension_id` VARCHAR(64) DEFAULT NULL;

-- ── 3. 唯一键换成认得 scope、也认得 NULL 的那一把 ──────────
SET @has_key_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'unlocks'
     AND COLUMN_NAME = 'entitlement_key'
);

SET @sql := IF(
  @has_key_col = 0,
  'ALTER TABLE `unlocks` ADD COLUMN `entitlement_key` VARCHAR(64) AS (IFNULL(`dimension_id`, ''*'')) STORED COMMENT ''唯一键用的衍生值：t2 的列在这里是 *，因为 MySQL 的唯一键不管 NULL''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- **先加新的，再拿掉旧的。** 两把键可以并存，所以这个顺序没有代价；
-- 反过来就有：MySQL 的 DDL 会各自 commit，旧键一旦先拿掉，新键那一句若因为
-- 锁等待逾时之类的理由失败，这张表会停在「一把唯一键都没有」的状态 ——
-- 而 grantUnlock 的 ON DUPLICATE KEY UPDATE 在那种表上会安静地退化成普通 INSERT，
-- 微信回调重送几次就发几份权益，没有任何错误讯息。
--
-- 重跑会报 ER_DUP_KEYNAME，migrate.mjs 容忍它。
ALTER TABLE `unlocks` ADD UNIQUE KEY `uk_user_scope_entitlement` (`user_id`, `scope`, `entitlement_key`);

-- 旧键：全新的库（schema.sql 已经是新的）没有这一把，会报 1091。
-- migrate.mjs 容忍 ER_CANT_DROP_FIELD_OR_KEY，那是预期内的。
ALTER TABLE `unlocks` DROP INDEX `uk_user_dimension`;

-- ── 4. payments 跟着分 scope ────────────────────────────────
-- 结算时唯一知道「这笔买的是什么」的地方就是付款那一列（settlePayment 只拿得到
-- 订单号）。不带 scope 的话，T2 的付款结算出来只能是一笔 t3 权益 —— 家长付了钱
-- 却打不开 T2。`dimension_id` 同样改可 null：T2 的付款没有维度，
-- 硬塞一个假维度进去会在对帐时变成查不出来的脏资料。
SET @has_pay_scope := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payments'
     AND COLUMN_NAME = 'scope'
);

SET @sql := IF(
  @has_pay_scope = 0,
  'ALTER TABLE `payments` ADD COLUMN `scope` ENUM(''t2'',''t3'') NOT NULL DEFAULT ''t3'' COMMENT ''这笔付款买的是整份 T2 还是单一维度 T3'' AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `payments` MODIFY COLUMN `dimension_id` VARCHAR(64) DEFAULT NULL;

-- ── 验证 ──────────────────────────────────────────────────────
-- 每一句都必须回 1。

SELECT COUNT(*) AS unlocks_scope_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unlocks' AND COLUMN_NAME = 'scope';

SELECT COUNT(*) AS unlocks_dimension_nullable_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unlocks'
   AND COLUMN_NAME = 'dimension_id' AND IS_NULLABLE = 'YES';

SELECT COUNT(*) AS unlocks_entitlement_key_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unlocks' AND COLUMN_NAME = 'entitlement_key';

-- 新的唯一键有三个栏位，期望值 3 写在 migrate.mjs 的 EXACT_EXPECTED。
SELECT COUNT(*) AS unlocks_unique_key_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unlocks'
   AND INDEX_NAME = 'uk_user_scope_entitlement';

-- 旧的那一把必须不在了。
SELECT COUNT(*) AS unlocks_old_unique_key_gone
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unlocks'
   AND INDEX_NAME = 'uk_user_dimension';

SELECT COUNT(*) AS payments_scope_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'scope';

SELECT COUNT(*) AS payments_dimension_nullable_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
   AND COLUMN_NAME = 'dimension_id' AND IS_NULLABLE = 'YES';

-- 没有任何一列的 scope 是空的（既有列全部落在 t3）。
SELECT COUNT(*) AS unlocks_without_scope_gone
  FROM `unlocks` WHERE `scope` IS NULL OR `scope` = '';
