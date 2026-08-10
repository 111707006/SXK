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
-- 合作公司（专案 B 多公司）
-- ============================================================
-- 一套部署同时服务多家合作公司，靠 users.company_id 区隔。
-- 架构决定见 docs/adr/0001-project-b-multi-company.md。

CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 后台显示用的名称。家长端不显示 —— 家长端维持中性品牌。
  `name` VARCHAR(128) NOT NULL,
  -- 进站连结的识别码：https://<域名>/?c=<slug>
  -- UNIQUE 是归属正确性的前提：两家公司共用一个 slug 等于把家长送给错的公司。
  `slug` VARCHAR(64) NOT NULL UNIQUE,
  -- 该公司自己的企业微信群机器人 webhook。未设定时退回全域 WECOM_WEBHOOK_URL。
  `wecom_webhook_url` VARCHAR(512) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 帐号（家长）
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  --
  -- 手机号是主要身分：纯短信验证码登入，不设密码。
  --
  -- **刻意没有全域 UNIQUE。** 家长的身分是（归属，手机号）这一组，不是手机号
  -- 本身 —— 同一个人在两家合作公司进站是**两位家长**，各自独立的孩子档案与
  -- 筛查结果。唯一性建在下面的 uk_company_phone 上，理由见
  -- docs/adr/0002-parent-identity-is-company-plus-phone.md。
  `phone` VARCHAR(20) DEFAULT NULL,
  -- email / password：**旧版邮箱登入的遗迹，已无任何程式码读写这两栏**（#27）。
  -- 刻意留着而不 DROP：那是既有邮箱家长的资料，删掉等于把他们的孩子档案
  -- 与筛查结果一并抹掉。新帐号两栏皆为 NULL。
  `email` VARCHAR(255) DEFAULT NULL UNIQUE,
  `password` VARCHAR(255) DEFAULT NULL,
  `device_id` VARCHAR(255) DEFAULT NULL,
  --
  -- 归属：这位家长属于哪一家合作公司。注册时写入，此后不再改变。
  -- NULL = 未归属（没带识别码、或识别码无效直接进站的家长）。
  --
  -- 归属**只定义在这一栏**。筛查结果、报告、专家预约都已经以 user_id 为外键，
  -- 各自再复制一份归属只会制造两份可能不一致的事实。
  --
  -- ON DELETE SET NULL 而非 CASCADE：删掉一家合作公司不该连带删掉家长与
  -- 孩子的健康资料，那些资料的掌管方是森心康，不是合作公司。
  `company_id` INT UNSIGNED DEFAULT NULL,
  --
  -- 归属并成一个具体的值，未归属为 0。存在的唯一理由是让下面的唯一索引
  -- **对未归属也生效** —— MySQL 的唯一索引允许重复 NULL，直接写
  -- UNIQUE (company_id, phone) 的话，未归属家长完全不受约束，
  -- 而**专案 A 的家长全部都是未归属**（A 没有合作公司）。
  --
  -- 生成栏位而非应用层的「先查再写」：后者在两个请求同时进来时就会漏，
  -- 而漏掉的后果是同一支手机号建出两个帐号，¥19.9 买的解锁权益留在
  -- 家长再也走不回去的那一个上面。
  `company_key` INT UNSIGNED AS (COALESCE(`company_id`, 0)) STORED,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- email 的 UNIQUE 本身已建索引，不另加 INDEX（避免重复索引）
  INDEX `idx_device_id` (`device_id`),
  -- 后台的家长列表永远带 company_id 条件，这个索引是它的主要存取路径
  INDEX `idx_company_created` (`company_id`, `created_at`),
  --
  -- 家长的身分：（归属，手机号）这一组。见 docs/adr/0002-...。
  -- phone 为 NULL 的列不受约束（唯一索引允许重复 NULL），所以既有的
  -- 电子邮件家长不必先补手机号。
  UNIQUE KEY `uk_company_phone` (`company_key`, `phone`),
  CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL
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
  -- specialists.id 的字串形式。刻意保留 VARCHAR 而非改成外键：
  -- 专家停用或被删除之后，这笔预约仍然要说得出「当时预约的是谁」。
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
-- 后台成员（管理中心）
-- ============================================================
-- 刻意与 `users` 分表，不加一个 is_admin 栏位：家长与后台成员是两种主体，
-- 混在一张表里意味着任何一次家长端的写入错误都可能造成后台提权。

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  -- bcrypt 杂凑。此表**不接受**明码退路（家长端为了旧资料而保留的那条）。
  `password` VARCHAR(255) NOT NULL,
  -- 只有两种角色。合作公司无法自行增删员工帐号，由森心康代为处理。
  `role` ENUM('global_admin','company_member') NOT NULL,
  -- global_admin 为 NULL；company_member 必须有值（由应用层保证）
  `company_id` INT UNSIGNED DEFAULT NULL,
  -- 停用：对方有人离职时立刻切断存取。停用后既有 token 也必须失效，
  -- 因此每次请求都要回查这一栏，不能只信 token。
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company` (`company_id`),
  CONSTRAINT `fk_admin_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 全域管理员的公司切换纪录。
-- 「看得到所有公司」若是日常状态，误看永远不会被发现；切换是一个明确的动作，
-- 明确的动作才留得下痕迹。
CREATE TABLE IF NOT EXISTS `admin_company_switches` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT UNSIGNED NOT NULL,
  -- selection = 'unassigned' 时为 NULL（切到「未归属家长」视野）
  `company_id` INT UNSIGNED DEFAULT NULL,
  `selection` ENUM('company','unassigned') NOT NULL,
  `request_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_admin_created` (`admin_user_id`, `created_at`),
  CONSTRAINT `fk_switches_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 专家（隶属于合作公司）
-- ============================================================
-- 从写死在 AnalysisReport.tsx 的三位森心康医师，变成各公司自备的资料。

CREATE TABLE IF NOT EXISTS `specialists` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `title` VARCHAR(128) DEFAULT NULL,
  -- 专长与资历分开：前者是「他看什么」，后者是「他凭什么」，家长端分段呈现
  `specialty` TEXT,
  `experience` TEXT,
  `avatar_url` VARCHAR(512) DEFAULT NULL,
  -- 可预约时段，字串阵列，例如 ["周四上午","周五下午"]
  `slots` JSON DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company_active` (`company_id`, `active`),
  CONSTRAINT `fk_specialists_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 干预素材库（仅专案 A 使用，T2 深度评估）
-- ============================================================
-- 以（维度，年龄段，严重度）为索引键的一张 90 格的表：9 × 5 × 2。
-- 内容以**图文为主、影片链接为辅**——因此这张表不需要任何文件上传或对象储存，
-- 决定与理由见 docs/adr/0003-intervention-materials-are-images-and-text.md。
--
-- 刻意**没有 company_id**：素材是森心康的干预内容，不是家长资料，
-- 也不属于任何一家合作公司。取资料仍须经过 src/admin/adminStore.ts 这个单一入口。

CREATE TABLE IF NOT EXISTS `intervention_materials` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 九维之一。字串而非外键：维度是程式码里的常数（src/data.ts），不是资料表。
  `dimension_id` VARCHAR(64) NOT NULL,
  -- 年龄段 A–E，来自 src/t1Data.ts。
  `age_band_id` VARCHAR(8) NOT NULL,
  -- 与报告上的判定同一组字串。normal 不在其中：没被标记的维度不需要干预素材。
  `severity` ENUM('borderline','delay') NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  -- 分解步骤，有序阵列：[{"imageUrl":"…","instruction":"…"}, …]
  -- 阵列顺序就是家长照着做的顺序，因此顺序是资料的一部分，不是显示时才决定的事。
  `steps` JSON NOT NULL,
  -- 选填的影片链接。NULL = 这一格没有影片，不是「还没填」。
  `video_url` VARCHAR(512) DEFAULT NULL,
  -- 停用而非删除：家长端不再取到它，但内容还在，可以再打开。
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 一格一笔。少了这个唯一键，同一格会有两笔素材，而配对逻辑（issue #26）
  -- 取到哪一笔要看资料库的心情——两个孩子会拿到不同的训练步骤。
  UNIQUE KEY `uk_material_cell` (`dimension_id`, `age_band_id`, `severity`),
  INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 既有数据库的迁移（sxk_db 已建过旧版 users 时执行）
-- ============================================================
-- 多公司相关（专案 B）：companies 必须先建立，users.company_id 才加得上去。
--
-- ALTER TABLE `users` ADD COLUMN `company_id` INT UNSIGNED DEFAULT NULL AFTER `device_id`;
-- ALTER TABLE `users` ADD INDEX `idx_company_created` (`company_id`, `created_at`);
-- ALTER TABLE `users` ADD CONSTRAINT `fk_users_company`
--   FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL;
--
-- 既有家长一律留在 company_id = NULL（未归属）。**不可**批次指派给任何一家公司 ——
-- 那等于把一批人的健康资料送给一家他们从未接触过的机构。

-- 手机号登入相关（#17 / #25）：手机号栏位、归属合并唯一索引、验证码表。
-- 完整的迁移与验证语句见：
--   deploy/migrations/2026-08-10-phone-login.sql
--
-- ⚠️ 那份迁移会 DROP 掉旧版建过的**全域** phone UNIQUE 索引。全域唯一在单库
-- 多公司的架构下是错的（见 docs/adr/0002-...），留着会让家长在乙公司登入时
-- 进到她在甲公司的既有帐号。

-- ============================================================
-- 展示用测试帐号：已于 #27 移除
-- ============================================================
-- 原本这里会种一列 test@test.com / 明文 123456，对应登录页的「一键填充」按钮。
-- 电子邮件登入下线之后，那一列既进不来（没有路由收它）也不该留着 ——
-- 一组印在登录页上的明文帐密，配上「储存值不像雜湊就当明文比」的旧退路，
-- 等于任何对外站台都人人可登入。两者都在 #27 一起消失。
--
-- 已经跑过旧版 schema 的资料库里那一列还在，**本档不删它** ——
-- 这份脚本不碰既有资料列。要清掉的话请自行确认后手动执行：
--   DELETE FROM `users` WHERE `email` = 'test@test.com';
-- 它现在是一列没有任何登入路径走得到的资料。
