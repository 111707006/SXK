-- ============================================================
-- 迁移：微信分账 profit_sharing_receivers、profit_sharing_orders（ADR-0017，开关 PROFIT_SHARING）
-- 日期：2026-11-17
-- ============================================================
--
-- **只加不删**：两张新表（CREATE TABLE IF NOT EXISTS），不动任何既有的表。完全可以重复执行。
--
--   node deploy/migrate.mjs            ← 只检查
--   node deploy/migrate.mjs --confirm  ← 真的执行
--
-- 【什么时候跑】**打开开关 PROFIT_SHARING 之前**（只有专案 A）。旧版程式码不读这两张表。
--
-- 【接收方】每个对方（合作公司／推荐人）登记一个微信分账接收方；微信那边加成功才算数（wx_added_at）。
-- 【分账单】开单时带了分账标记的订单各一列；付款成功、过了退款期才向微信请求分账，一笔订单只分一次、剩下的同时解冻。

CREATE TABLE IF NOT EXISTS `profit_sharing_receivers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 对方是谁：company＝合作公司（companies.id）；referrer＝推荐人（referrers.id）。一个对方一个接收方。
  `party_kind` ENUM('company','referrer') NOT NULL,
  `ref_id` INT UNSIGNED NOT NULL,
  -- MERCHANT_ID：对方的微信支付商户号；PERSONAL_OPENID：个人在服务号底下的 openid（钱进微信零钱）。
  `account_type` ENUM('MERCHANT_ID','PERSONAL_OPENID') NOT NULL,
  `account` VARCHAR(64) NOT NULL,
  -- 商户全称（MERCHANT_ID 必填，送给微信前加密）；个人不存姓名。
  `name` VARCHAR(128) NULL,
  `relation_type` VARCHAR(32) NOT NULL DEFAULT 'PARTNER',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  -- 微信那边「添加分账接收方」成功的时间；NULL＝还没加成功，不能分。
  `wx_added_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_party` (`party_kind`, `ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `profit_sharing_orders` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 一笔订单一列（payments.id）。开单时带了 profit_sharing 的订单才有这一列。
  `payment_id` BIGINT UNSIGNED NOT NULL,
  -- awaiting：开单时记下、等付款与退款期；created：金额算好、微信还没受理；processing：微信处理中；
  -- finished：分完（个别接收方失败写在 error）；failed：没分出去（看 error）。
  `state` ENUM('awaiting','created','processing','finished','failed') NOT NULL DEFAULT 'awaiting',
  -- share＝请求分账（剩下的同时解冻）；unfreeze＝没有可分的，只解冻。
  `kind` ENUM('share','unfreeze') NULL,
  -- 第几次送（失败重试换一个商户分账单号 PS<订单 id>A<第几次>）。
  `attempt` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `out_order_no` VARCHAR(64) NULL,
  -- 微信分账单号；NULL＝微信没受理过。
  `wx_order_id` VARCHAR(64) NULL,
  -- 每一方该拿多少、这次分了多少、没分的原因（src/profitSharing/plan.ts 的 PlanLine[]）。
  `detail` JSON NULL,
  `shared_fen` INT UNSIGNED NOT NULL DEFAULT 0,
  -- 该给对方、但没从微信分出去的（超过最高分账比例、对方没登记接收方、分账失败）：线下结。
  `offline_fen` INT UNSIGNED NOT NULL DEFAULT 0,
  `error` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_payment` (`payment_id`),
  UNIQUE KEY `uniq_out_order_no` (`out_order_no`),
  INDEX `idx_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 驗證（deploy/migrate.mjs 跑這幾句，_ok 必須回 1）
SELECT COUNT(*) AS profit_sharing_receivers_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profit_sharing_receivers';
SELECT COUNT(*) AS profit_sharing_orders_table_ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profit_sharing_orders';
