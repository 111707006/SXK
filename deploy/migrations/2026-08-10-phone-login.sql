-- ============================================================
-- 迁移：手机号、验证码表、归属合并唯一索引（issue #17，#25 的前置）
-- 日期：2026-08-10
-- ============================================================
--
-- ⚠️ **执行前请先备份 RDS。** 这份迁移会改动 `users` 的索引。
--
-- ⚠️ **这份迁移必须在部署新版程式码之前跑完。**
--
-- 新版的手机号登入会查 `users.company_key` 并写 `users.phone`。栏位不存在时
-- 那两句 SQL 会失败 —— 家长会看到「登录失败，请稍后再试」，不会拿到 token，
-- 也不会有半个帐号写进去。**声音是大的，但家长登不进来。** 顺序反了不会静默
-- 坏掉，但会是一段所有人都登不进来的时间，先跑这份再部署。
--
--   mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> \
--     < deploy/migrations/2026-08-10-phone-login.sql
--
-- （`deploy/migrate.mjs` 只跑 2026-08-06 那一份，这份与 2026-08-09 一样用
--   mysql 客户端直接执行。）
--
-- 【可重复执行吗】
-- `sms_codes` 是 CREATE TABLE IF NOT EXISTS，重跑无害。
-- 中段的 ALTER TABLE 只能跑一次，重跑会报下列错误 —— 那代表它已经跑过了：
--   1060 Duplicate column name        （栏位已存在）
--   1061 Duplicate key name           （索引已存在）
--   1091 Can't DROP ...; check that column/key exists（要拿掉的索引本来就没有）
-- MySQL 8 没有 ADD COLUMN IF NOT EXISTS，所以这里不假装它是幂等的。
--
-- 【这是 expand 步骤】
-- 新栏位与新表加在既有结构旁边，旧的电子邮件登入完全不受影响：email 与
-- password 只是从 NOT NULL 放宽为可空，旧版程式码永远会写入这两栏。
-- 拿掉电子邮件登入是另一张票（#27）的事，不在这里做。

-- ── 1. 手机号栏位 ────────────────────────────────────────────────
-- 家长的主要身分。纯短信验证码登入，不设密码。
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL AFTER `id`;

-- ── 2. 拿掉全域唯一 ──────────────────────────────────────────────
--
-- 早期的 deploy/schema.sql 把 phone 建成 `VARCHAR(20) DEFAULT NULL UNIQUE`，
-- MySQL 会把那个索引命名为 `phone`。全域唯一在单库多公司的架构下是错的：
-- 同一支手机号在两家合作公司是**两位家长**（docs/adr/0002-...）。留着它，
-- 张太太到乙公司登入会进到她在甲公司的既有帐号，于是乙公司在后台永远看不到
-- 她，她的新筛查覆盖掉小明在甲公司的档案，而甲公司看得到那次结果。
--
-- 全新的资料库不会有这个索引，这一句会报 1091 —— 那是正常的，继续往下跑。
ALTER TABLE `users` DROP INDEX `phone`;

-- ── 3. 电子邮件与密码放宽为可空 ──────────────────────────────────
-- 新家长两栏皆为 NULL。对旧版应用向后相容 —— 旧版永远会写入 email。
ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `users` MODIFY COLUMN `password` VARCHAR(255) DEFAULT NULL;

-- ── 4. 归属合并生成栏位 + 唯一索引 ───────────────────────────────
--
-- 唯一性限缩在归属范围内，且**对未归属也必须生效**。
--
-- 直接写 `UNIQUE (company_id, phone)` 是不够的：MySQL 的唯一索引允许重复
-- NULL，而未归属家长的 company_id 就是 NULL —— **专案 A 的家长全部都是未归属**。
-- 放着不管等于专案 A 没有手机号唯一性，而 A 卖的解锁权益绑在 user_id 上：
-- 重复建帐号＝家长付了 ¥19.9 下次登入就没了。
--
-- 所以把未归属并成一个具体的值 0，唯一索引建在生成栏位上。
-- 用生成栏位而非应用层的「先查再写」，是因为后者在两个请求同时进来时就会漏。
--
-- 外键仍挂在原本的 `company_id` 上（fk_users_company，2026-08-06 那份建的），
-- 生成栏位不影响它 —— 删掉一家公司时 company_id 被设为 NULL，company_key
-- 自动跟着变成 0，那位家长落回未归属。
--
-- ⚠️ **必须是 VIRTUAL，不能是 STORED。**
--
-- 这一句原本写的是 STORED，而它在任何一个已经有 fk_users_company 的库上都会
-- 失败：`ERROR 1215 (HY000): Cannot add foreign key constraint`。MySQL 手册
-- （CREATE TABLE and Generated Columns）写得很明白：
--
--   「A foreign key constraint on the base column of a stored generated column
--     cannot use CASCADE, SET NULL, or SET DEFAULT as ON UPDATE or ON DELETE
--     referential actions.」
--
-- company_id 正是 company_key 的来源栏位，而 fk_users_company 是
-- ON DELETE SET NULL —— 两个条件同时成立，MySQL 直接拒绝。1215 这个错误码
-- 会把人送去查型别、字符集与索引，而问题跟那些一个都无关。
--
-- VIRTUAL 不受这条限制（它是读的时候才算，SET NULL 不必去改一个存下来的值）。
-- 唯一索引照样建得起来、照样生效，删公司时 company_key 照样跟着变 0 ——
-- 以 MySQL 8.0.45 实测过上面「验证（二）」的全部四项，行为与 STORED 无异。
ALTER TABLE `users`
  ADD COLUMN `company_key` INT UNSIGNED
  AS (COALESCE(`company_id`, 0)) VIRTUAL AFTER `company_id`;

-- phone 为 NULL 的列不受此索引约束（唯一索引允许重复 NULL），
-- 所以既有的电子邮件家长全部不受影响，不必先补手机号。
ALTER TABLE `users` ADD UNIQUE KEY `uk_company_phone` (`company_key`, `phone`);

-- ── 5. 短信验证码 ────────────────────────────────────────────────
-- 只存杂凑，不存明码。这张表里的一列若是明码，任何一份资料库备份、
-- 任何一次慢查询日志，都等同一把可以登入任何帐号的钥匙。
CREATE TABLE IF NOT EXISTS `sms_codes` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  -- 错误次数，达上限即锁定该笔，家长必须重新索取。
  -- 六位数字只有一百万种，没有上限的话在有效期内慢慢猜是划得来的。
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  -- 已消费时间。非 NULL 代表这组验证码用过了，不得再用第二次。
  `consumed_at` DATETIME DEFAULT NULL,
  -- 防刷用的来源键。存的是**收敛过的值**而不是原始位址 —— IPv4-mapped 併回
  -- 纯 IPv4，IPv6 截到 /64（见 server.ts 的 normalizeRequestIp）。
  `request_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 冷却期与当日上限查的是「这支手机号最近／今天索取了几次」，走这个索引。
  INDEX `idx_phone_created` (`phone`, `created_at`),
  -- 防刷：同一个来源 IP 的索取次数。
  INDEX `idx_ip_created` (`request_ip`, `created_at`),
  -- 清理过期资料用。
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 验证
-- ============================================================
-- 测试环境刻意不连资料库（test/setup/testEnv.ts 把 MYSQL_* 清空），
-- 所以唯一性没有任何一支测试证明得了 —— **下面这几句就是那个证明所在。**

-- 这一句必须回 1：手机号栏位在。
SELECT COUNT(*) AS users_phone_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone';

-- 这一句必须回 1，且 EXTRA 要看得到 STORED GENERATED。
SELECT COUNT(*) AS users_company_key_generated_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_key'
   AND EXTRA LIKE '%GENERATED%';

-- 这一句必须回两列：company_key 在第 1 位、phone 在第 2 位，且 NON_UNIQUE = 0。
SELECT SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_company_phone'
 ORDER BY SEQ_IN_INDEX;

-- 这一句必须回 0：旧的全域唯一索引不该还在。
SELECT COUNT(*) AS global_phone_unique_gone
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'users' AND INDEX_NAME = 'phone';

-- 这一句必须回 1：验证码表在。
SELECT COUNT(*) AS sms_codes_ok
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sms_codes';

-- ============================================================
-- 验证（二）：唯一索引对**未归属**真的生效
-- ============================================================
--
-- 上面几句只证明索引存在。索引存在不等于对未归属生效 —— 那正是
-- `UNIQUE (company_id, phone)` 会通过前几句、却完全挡不住重复的地方。
-- 所以这一段是**实际写进去看它挡不挡**，整段包在交易里，最后全部回滚。
--
-- ⚠️ 请**另开一个 mysql 互动工作阶段贴上这一段**，不要跟上面一起用
--    `mysql < file` 跑：中间那两句是刻意要失败的，mysql 客户端遇错会直接
--    结束，后面的 ROLLBACK 就跑不到（连线中断时 InnoDB 会自行回滚，
--    资料仍然是安全的，但你会看不到后半段的结果）。
--
-- START TRANSACTION;
--
-- INSERT INTO `companies` (`name`, `slug`)
--   VALUES ('迁移验证甲', '__migration-check-a'), ('迁移验证乙', '__migration-check-b');
-- SET @a = (SELECT id FROM companies WHERE slug = '__migration-check-a');
-- SET @b = (SELECT id FROM companies WHERE slug = '__migration-check-b');
--
-- -- (1) 同一支手机号在两家公司各一位家长：这两句**都必须成功**。
-- --     失败了代表唯一性被建成全域的，张太太到乙公司会进到她在甲公司的帐号。
-- INSERT INTO `users` (`phone`, `company_id`) VALUES ('19900000002', @a);
-- INSERT INTO `users` (`phone`, `company_id`) VALUES ('19900000002', @b);
--
-- -- (2) 未归属范围内同一支手机号只能有一个：第一句成功，
-- --     第二句**必须失败**，错误码 1062 Duplicate entry '0-19900000003'。
-- --     第二句要是成功了，唯一索引对未归属没生效 —— **先不要部署**。
-- --     专案 A 的家长全部都是未归属，那等于 A 完全没有手机号唯一性。
-- INSERT INTO `users` (`phone`, `company_id`) VALUES ('19900000003', NULL);
-- INSERT INTO `users` (`phone`, `company_id`) VALUES ('19900000003', NULL);
--
-- -- (3) 既有的电子邮件家长 phone 全是 NULL，不该被这个索引挡住：
-- --     这两句**都必须成功**（唯一索引允许重复 NULL）。
-- INSERT INTO `users` (`email`, `password`) VALUES ('__check1@example.com', 'x');
-- INSERT INTO `users` (`email`, `password`) VALUES ('__check2@example.com', 'x');
--
-- ROLLBACK;
--
-- -- 回滚之后确认什么都没留下：这一句必须回 0。
-- SELECT COUNT(*) AS leftovers FROM `users` WHERE `phone` LIKE '199000000%';
