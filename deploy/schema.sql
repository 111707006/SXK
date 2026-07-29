-- 森心康 MySQL 建表脚本
-- 适用于阿里云 RDS MySQL 8.0
--
-- 两个专案各自使用独立数据库，schema 相同：
--   专案 A（完整版，含深度评估付费与商城）:
--     CREATE DATABASE sxk_db    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   专案 B（T1-only，止于联系专家）:
--     CREATE DATABASE sxk_t1_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--
-- 专案 B 不会用到 payments / unlocks，建了留着无害，保持两边 schema 一致最省事。
-- 名词定义见项目根目录 CONTEXT.md。

-- ============================================================
-- 帐号
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 手机号是主要身分：纯短信验证码登入，不设密码
  `phone` VARCHAR(20) DEFAULT NULL UNIQUE,
  -- email / password 为旧版邮箱登入保留；新用户两栏皆为 NULL
  `email` VARCHAR(255) DEFAULT NULL UNIQUE,
  `password` VARCHAR(255) DEFAULT NULL,
  `device_id` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- phone / email 的 UNIQUE 本身已建索引，不另加 INDEX（避免重复索引）
  INDEX `idx_device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_data` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `device_id` VARCHAR(255) DEFAULT NULL,
  `child` JSON DEFAULT NULL,
  `completed_scores` JSON DEFAULT NULL,
  `orders` JSON DEFAULT NULL,
  `report_history` JSON DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_id` (`user_id`),
  INDEX `idx_device_id` (`device_id`),
  CONSTRAINT `fk_user_data_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 短信验证码（纯验证码登入）
-- ============================================================

CREATE TABLE IF NOT EXISTS `sms_codes` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL,
  -- 只存杂凑，不存明码验证码
  `code_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  -- 错误次数，达上限即锁定该笔验证码
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `consumed_at` DATETIME DEFAULT NULL,
  -- 防刷用：同 IP 每日发送上限
  `request_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_phone_created` (`phone`, `created_at`),
  INDEX `idx_ip_created` (`request_ip`, `created_at`),
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 深度评估付费（仅专案 A 使用）
-- ============================================================

-- 付款：一次微信支付交易的纪录。与 unlocks 分开，见 CONTEXT.md。
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  -- 商户订单号，由我方产生，微信以此对帐
  `out_trade_no` VARCHAR(64) NOT NULL UNIQUE,
  -- 微信支付订单号，付款成功后由回调回填
  `transaction_id` VARCHAR(64) DEFAULT NULL,
  -- 金额单位为「分」，避免浮点误差（¥19.9 = 1990）
  `amount_fen` INT UNSIGNED NOT NULL,
  `status` ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  -- 此次付款要解锁的维度
  `dimension_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL,
  INDEX `idx_user` (`user_id`),
  INDEX `idx_transaction` (`transaction_id`),
  INDEX `idx_status_created` (`status`, `created_at`),
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 解锁权益：某使用者对某维度深度评估（T2+T3）的永久使用权。
-- 绑 user + dimension，不绑筛查批次：家长重做筛查后权益依然有效，可免费重做 T2/T3。
CREATE TABLE IF NOT EXISTS `unlocks` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `dimension_id` VARCHAR(64) NOT NULL,
  -- 取得来源：付款，或由客服／行销免费发放
  `source` ENUM('payment','grant') NOT NULL DEFAULT 'payment',
  `payment_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 退款或人工撤销时填入；非 NULL 代表权益已失效
  `revoked_at` DATETIME DEFAULT NULL,
  --
  -- 幂等关键：微信支付回调会重复送达。此唯一键让第二次开通直接失败，
  -- 因此正确的判断是「这笔 unlock 是否已存在」，而不是「付款是否成功」。
  -- 退款后重新购买时，应 UPDATE 既有列把 revoked_at 设回 NULL，而非再 INSERT。
  --
  UNIQUE KEY `uk_user_dimension` (`user_id`, `dimension_id`),
  INDEX `idx_payment` (`payment_id`),
  CONSTRAINT `fk_unlocks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_unlocks_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 专家预约（两个专案都会用，专案 B 是主要场景）
-- ============================================================

CREATE TABLE IF NOT EXISTS `expert_bookings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 专案 B 采匿名流程，未注册时 user_id 为 NULL，以 device_id 追踪
  `user_id` INT UNSIGNED DEFAULT NULL,
  `device_id` VARCHAR(255) DEFAULT NULL,
  -- 专家名单写死在程式中（AnalysisReport.tsx 的 SPECIALISTS）
  `specialist_id` VARCHAR(64) NOT NULL,
  `parent_name` VARCHAR(64) NOT NULL,
  `parent_phone` VARCHAR(20) NOT NULL,
  `child_age_month` INT UNSIGNED DEFAULT NULL,
  `child_gender` VARCHAR(16) DEFAULT NULL,
  -- 提供给专家的 T1 报告摘要
  `report_summary` TEXT,
  `preferred_slot` VARCHAR(64) DEFAULT NULL,
  `status` ENUM('new','contacted','scheduled','done','cancelled') NOT NULL DEFAULT 'new',
  -- 短信／企业微信通知送出的时间
  `notified_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_status_created` (`status`, `created_at`),
  INDEX `idx_parent_phone` (`parent_phone`),
  INDEX `idx_device_id` (`device_id`),
  CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 既有数据库的迁移（sxk_db 已建过旧版 users 时执行）
-- ============================================================
-- 以下皆为「放宽限制」，对旧版应用向后相容（旧版永远会写入 email）。
-- 执行前请先备份 RDS。
--
-- ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(255) DEFAULT NULL;
-- ALTER TABLE `users` MODIFY COLUMN `password` VARCHAR(255) DEFAULT NULL;
-- ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL UNIQUE AFTER `id`;

-- ============================================================
-- 展示用测试帐号
-- ============================================================
-- 刻意保留：让客户与合作方免注册即可试用，对应登录页的「一键填充」按钮。
-- 密码为明文 123456 —— server.ts 的 verifyPassword 对非 bcrypt 值会退回明文比对，
-- 因此这组帐密在任何对外站台上等同人人可登入。这是已知且已接受的取舍。
INSERT IGNORE INTO `users` (`email`, `password`) VALUES ('test@test.com', '123456');
