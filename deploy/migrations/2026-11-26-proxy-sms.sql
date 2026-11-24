-- ============================================================
-- 迁移：代填短信的发送纪录 proxy_sms（使用者 2026-11-24，只有专案 A 用到）
-- 日期：2026-11-26
-- ============================================================
--
-- **只加不删**，完全可以重复执行。
-- 【什么时候跑】打开 PROXY_SMS 之前（B 跑了无害）。开关关着的程式码不读写这张表。

CREATE TABLE IF NOT EXISTS `proxy_sms` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 谁送出的代填（或按了重发）。不设外键：后台帐号删掉，纪录照样留着。
  `admin_user_id` INT UNSIGNED NOT NULL,
  -- pending＝占位还没有结果（程序中断会留下，当作送过）。手机号不另存，看 users。
  `status` ENUM('pending','sent','failed') NOT NULL,
  `detail` VARCHAR(200) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_proxy_sms_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_proxy_sms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证（deploy/migrate.mjs 跑这一句，_ok 必须回 1）
SELECT COUNT(*) AS proxy_sms_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proxy_sms';
