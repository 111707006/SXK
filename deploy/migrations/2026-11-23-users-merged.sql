-- ============================================================
-- 迁移：家长帐号的「停用」与「并入哪一个」（#116，ADR-0020）
-- 日期：2026-11-23
-- ============================================================
--
-- 只加两个栏位，没有 DROP、没有改资料。**A、B 两个库都跑**（同一份 schema；B 用不到，但程式码查得到这两栏）。
-- **先于新版程式码部署**：登入查帐号（src/db/mysql.ts 的 findUserByPhone）会读这两栏，栏位不在时登入失败。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【可重复执行吗】可以：栏位已存在时 MySQL 回 1060（ER_DUP_FIELDNAME），migrate.mjs 当成「已经跑过」略过。
--
-- 【一列是什么】
-- disabled_at：非 NULL ＝这个帐号被停用（专案 A 合并重复手机号时，被并掉的那一个），登不进来。
-- merged_into：并入哪一个帐号（users.id）。登入时找到被并掉的帐号，就改登入它并入的那一个。
-- 被并掉的帐号**不删**：它的筛查档案等其他资料原地留着，要查得回来。
--
-- 【A 的手机号唯一】不在这里。deploy/migrations 底下每一份都会在 B 跑，而 B 照旧是（归属，手机号）唯一。
-- A 的唯一键由合并脚本在合并完之后加（deploy/merge-duplicate-phones.mjs，见 deploy/README.md）。

ALTER TABLE `users` ADD COLUMN `disabled_at` DATETIME NULL AFTER `company_key`;
ALTER TABLE `users` ADD COLUMN `merged_into` INT UNSIGNED NULL AFTER `disabled_at`;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS users_disabled_at_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'disabled_at';
SELECT COUNT(*) AS users_merged_into_ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'merged_into';
