-- ============================================================
-- 迁移：家长的微信 openid wechat_openids（JSAPI 支付，2026-11-08）
-- 日期：2026-11-08
-- ============================================================
--
-- 一张新表，没有任何 ALTER。**完全可以重复执行**：CREATE TABLE IF NOT EXISTS。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】
-- 设 WECHAT_MP_APPSECRET（打开 JSAPI 支付）之前，只有专案 A。没设时程式码不碰这张表。
--
-- 【一列是什么】
-- 一位家长在服务号（appid）底下的 openid —— 服务号网页授权（snsapi_base，静默）拿到的，JSAPI 下单时当付款人。
-- openid 只在同一个 appid 底下有意义，所以 appid 一起存；换服务号就是另一列。
-- 不是登入身分：家长照旧用手机号登入，这一列只在付款时用。

CREATE TABLE IF NOT EXISTS `wechat_openids` (
  `user_id` INT UNSIGNED NOT NULL,
  `appid` VARCHAR(32) NOT NULL,
  `openid` VARCHAR(64) NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `appid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证（deploy/migrate.mjs 跑这几句，_ok 必须回 1）
SELECT COUNT(*) AS wechat_openids_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_openids';
