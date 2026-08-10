-- ============================================================
-- 迁移：预约的服务类型（issue #21，四种咨询）
-- 日期：2026-08-10
-- ============================================================
--
-- 家长可以约四种服务：线上咨询说明（既有）、线上干预训练指导、线下干预训练、
-- 线下咨询。四种共用 `expert_bookings` 这一张表、同一个通知、同一个后台分页 ——
-- 差别只有新加的这一个栏位。
--
--   mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> \
--     < deploy/migrations/2026-08-10-booking-service-type.sql
--
-- 或直接跑 `node deploy/migrate.mjs --confirm`（它会跑 migrations/ 底下全部，
-- 并检查每一份结尾的 `..._ok` 验证句必须回 1）。
--
-- 【什么时候跑】
-- **部署新版程式码之前。** 顺序反了会是一段所有预约都写不进去的时间：新版的
-- INSERT 会带 service_type，栏位不存在时那一句会失败，家长看到「预约提交失败」。
-- 声音是大的（不是静默的资料遗失），但那段时间没有人约得成。
--
-- 反过来（先跑迁移、还没部署）完全无害：旧版的 INSERT 不带这一栏，
-- DEFAULT 会把它填成 'online_consult'，而那正是旧版唯一能约的那一种。
--
-- 【可重复执行吗】
-- 不行。MySQL 8 没有 ADD COLUMN IF NOT EXISTS，重跑会报：
--   1060 Duplicate column name 'service_type'   （栏位已存在）
--   1061 Duplicate key name 'idx_service_created'（索引已存在）
-- 那两个错误码代表它已经跑过了，不是坏了。
--
-- 【既有资料】
-- 既有的每一列都是线上咨询说明 —— 那是这个功能之前唯一存在的那一种。
-- DEFAULT 会把它们全部填成 'online_consult'，**不需要**另外一句 UPDATE，
-- 也**不可以**凭猜测把某些旧列改成别的类型。
--
-- 【线下的地点不在这里】
-- 据点资讯常变，写进系统只会多一张要维护的表。既有的 status 流转本来就是为
-- 「由客服接手安排」设计的：new → contacted → scheduled → done。
-- 这份迁移刻意**没有**任何地点栏位。
--
-- ⚠️ 请先备份：
--   mysqldump -h <MYSQL_HOST> -u <MYSQL_USER> -p <MYSQL_DATABASE> > backup.sql

-- ── 1. 服务类型栏位 ──────────────────────────────────────────────
-- 字串与 src/utils/serviceTypes.ts 的 ServiceType 逐字对应。两边分岔的话，
-- 应用层写得进去的值会被 MySQL 截成空字串（非严格模式）或整句失败（严格模式）。
ALTER TABLE `expert_bookings`
  ADD COLUMN `service_type`
    ENUM('online_consult','online_training','offline_training','offline_consult')
    NOT NULL DEFAULT 'online_consult'
    AFTER `preferred_slot`;

-- ── 2. 客服照类型分工用的索引 ────────────────────────────────────
ALTER TABLE `expert_bookings`
  ADD INDEX `idx_service_created` (`service_type`, `created_at`);

-- ============================================================
-- 验证
-- ============================================================

-- 这一句必须回 1：栏位在，而且预设值是既有的那一种。
-- 预设值错了不会有任何声音 —— 旧版程式码送出的预约会落到一个错的类型，
-- 客服照着它分工，而画面上一切正常。
SELECT COUNT(*) AS bookings_service_type_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'expert_bookings'
   AND COLUMN_NAME = 'service_type'
   AND COLUMN_DEFAULT = 'online_consult';

-- 这一句必须回 1：四种都在 ENUM 里，一种不多一种不少。
-- 少一种的话，家长按下那一种会拿到「预约提交失败」；多一种代表这份迁移与
-- src/utils/serviceTypes.ts 已经分岔了。
-- 内层的单引号写成两个（SQL 的转义方式）；刻意不用双引号包字串 ——
-- 开了 ANSI_QUOTES 的连线会把它当成识别字，那时这一句会以「找不到栏位」失败，
-- 而错误讯息与 enum 本身无关。
SELECT CASE WHEN COLUMN_TYPE =
         'enum(''online_consult'',''online_training'',''offline_training'',''offline_consult'')'
       THEN 1 ELSE 0 END AS bookings_service_enum_ok
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'expert_bookings'
   AND COLUMN_NAME = 'service_type';

-- 这一句必须回 1：索引在。
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS bookings_service_index_ok
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'expert_bookings'
   AND INDEX_NAME = 'idx_service_created';

-- 这一句必须回 0：没有任何一列的类型是空的。
-- 既有资料由 DEFAULT 填成 online_consult，一列都不该漏。
SELECT COUNT(*) AS bookings_untyped_gone
  FROM `expert_bookings`
 WHERE `service_type` IS NULL OR `service_type` = '';
