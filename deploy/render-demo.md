# Render 展示环境（交接清单）

> 2026-09-27 定：Render 的 `sxk`（专案 A）接一个**展示专用资料库**，不接正式库。
> 这份是给接手的 Claude session 照着做的；使用者要求「不用我去设定」，所以除了下面「前置」那一节，
> 其余都由 session 自己用 API 做完。做完一步就在这份打勾、commit。

## 已经做好的

- [x] 程式码进 `master`（`ab65186`：思源黑体、后台分数、17 支示范片标签档）
- [x] `/media` 上游代理（`src/mediaProxy.ts`，`MEDIA_UPSTREAM`）：Render 没有片子，由伺服器向正式站拿。
      **不能**让浏览器直接连 `https://sxkscreen.com/media/…` —— 正式站整站过 helmet，回
      `Cross-Origin-Resource-Policy: same-origin`，别的网站嵌入的 `<video>`／`<img>` 会被浏览器挡掉。
      资料库里的网址照旧是 `/media/activities/A001.mp4`，不用改。
- [x] `render.yaml` 的 `sxk` 加了 `MEDIA_UPSTREAM=https://sxkscreen.com`（服务若不是从 Blueprint 建的，要用 API 另外设）

## 前置（使用者在 Claude 的环境设定里做，session 自己做不到）

环境设定（session 标题列的云端环境选单 → Edit），改完**开新的 session** 才读得到：

- **Network access** 允许：`api.render.com`、`sxk.onrender.com`、`rds.aliyuncs.com`（阿里云 RDS OpenAPI）
- **环境变数**（不要贴进对话）：
  - `RENDER_API_KEY` —— Render → Account Settings → API Keys。⚠️ Render 的 key 是整个帐号的权限
  - `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET` —— 建议另开 RAM 子帐号，只给 `AliyunRDSFullAccess`
  - `ALI_SMS_ACCESS_KEY_ID`、`ALI_SMS_ACCESS_KEY_SECRET`、`ALI_SMS_SIGN_NAME`、`ALI_SMS_TEMPLATE_CODE` ——
    与正式站 `.env` 同一组。**Render 上若已经有这四项就不用**（先用 API 读 Render 的 env 确认）。
    展示环境的家长也是手机验证码登入，没有它们谁都登不进来

## 步骤（接手的 session 做）

1. **确认 Render 的现况**（`GET /v1/services?name=sxk`）：服务 id、追哪个分支（预期 `master`）、
   `autoDeploy`、区域、现有的 env vars（`GET /v1/services/{id}/env-vars`：`MYSQL_*` 有没有值、`ALI_SMS_*` 在不在）。
   顺便查 Render 的对外 IP（服务的 Outbound 页；API 拿不到就用 Render 文件公布的该区域 IP 段）。
2. **在同一台 RDS 上开展示库**（阿里云 OpenAPI，`DescribeDBInstances` 找到放 `sxk_db` 的那一台）：
   - `CreateDatabase`：`sxk_demo_db`，`utf8mb4`
   - `CreateAccount`：`sxk_demo`（普通帐号，密码随机产生，只存进 Render 的 env）
   - `GrantAccountPrivilege`：`sxk_demo` 只对 `sxk_demo_db` 读写。**不给正式库任何权限**
   - 没有公网地址就 `AllocateInstancePublicConnection`；`ModifySecurityIps` 另开一个白名单分组 `render_demo`，
     只放 Render 的对外 IP。⚠️ 公网地址是整台实例的：正式库在网路上也对这些 IP 可达，防线是帐号权限与密码。
     正式库帐号的密码要够强，这一点要在回报里讲清楚
3. **设 Render 的 env**（`PUT /v1/services/{id}/env-vars`，要带上全部既有的，不然会被清掉）：
   `MYSQL_HOST`（公网地址）、`MYSQL_PORT=3306`、`MYSQL_USER=sxk_demo`、`MYSQL_PASSWORD`、`MYSQL_DATABASE=sxk_demo_db`、
   `MEDIA_UPSTREAM=https://sxkscreen.com`；`PAYWALL_DEMO_OPEN=1` 维持（展示库没有真实资料）；`ALI_SMS_*` 若缺就补
4. **建表与迁移**：全新库＝先 `deploy/schema.sql`、再 `node deploy/migrate.mjs --confirm`（迁移都查过
   `information_schema`，在 schema.sql 之后跑不会撞）。从 Render 跑最省事（白名单已经放了 Render）：
   暂时把 start command 改成先跑这两步再 `npm start`，跑完改回来。迁移结尾的 `_ok`／`_gone` 检查全过才算数
5. **后台帐号**：`deploy/create-admin.mjs` 是互动式的，展示库另写一次性的建法；密码随机产生，交给使用者后请他改
6. **部署**：`POST /v1/services/{id}/deploys`（或 push 触发），等到 live
7. **汇入示范片标签**：用后台 API `POST /api/admin/activities/import`，先 `dryRun: true` 看 `failed`／`warnings` 都是空的，
   再正式汇入 `deploy/activity-tags/2026-09-27-module1-videos.json`（这份是草稿，README 有写待治疗师看过）
8. **验收**（从 session 打 `https://sxk.onrender.com`）：
   - `/api/db/status` 回 `engine: mysql`
   - `/media/activities/A001.jpg` 200、`/media/activities/A001.mp4` 带 `Range: bytes=0-99` 回 206
   - 后台登入 → 活动库 300 支、17 支有片、17 支有 `targetMonth`
   - 首页的字是思源黑体（`/fonts/noto-sans-sc-5.3.0/index.css` 200）
   - 手机验证码登入那一段只有使用者自己能走（验证码发到他的手机）：请他走一次 T1 → T2 → 报告 → 居家训练 → 播一支片
9. 回报使用者：网址、后台帐号、哪些做完、哪些要他在手机上验
