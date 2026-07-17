-- 森心康 MySQL 建表脚本
-- 适用于阿里云 RDS MySQL 8.0
-- 执行前请先创建数据库: CREATE DATABASE sxk_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `device_id` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
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

-- 插入默认测试账号 (密码: 123456)
INSERT IGNORE INTO `users` (`email`, `password`) VALUES ('test@test.com', '123456');
