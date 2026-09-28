# Render 展示环境（交接清单）

> **2026-09-28 使用者改定：Render 的 `sxk`（专案 A）直接共用正式库 `sxk_db`**（取代 09-27 的「另开展示库」）。
> 这份是给接手的 Claude session 照着做的；使用者要求「不用我去设定」，所以除了下面「前置」那一节，
> 其余都由 session 自己用 API 做完。做完一步就在这份打勾、commit。
>
> 共用正式库的代价已经跟使用者讲过、使用者接受：Render 的伺服器在境外，读的是正式站的儿童资料
> （个人信息出境）；在 Render 上登入、作答、打卡的资料都写进正式库，后台家长列表会看到。
> 下面几条是为了**不让这个决定再多出别的后果**，不能省。

## 已经做好的

- [x] 程式码进 `master`（`ab65186`：思源黑体、后台分数、17 支示范片标签档；`0a61030`：下面的媒体代理）
- [x] `/media` 上游代理（`src/mediaProxy.ts`，`MEDIA_UPSTREAM`）：Render 没有片子，由伺服器向正式站拿。
      **不能**让浏览器直接连 `https://sxkscreen.com/media/…` —— 正式站整站过 helmet，回
      `Cross-Origin-Resource-Policy: same-origin`，别的网站嵌入的 `<video>`／`<img>` 会被浏览器挡掉。
      资料库里的网址照旧是 `/media/activities/A001.mp4`，不用改。
- [x] `render.yaml` 的 `sxk` 加了 `MEDIA_UPSTREAM=https://sxkscreen.com`（服务若不是从 Blueprint 建的，要用 API 另外设）

## 前置（使用者在 Claude 的环境设定里做，session 自己做不到）

环境设定（session 标题列的云端环境选单 → Edit），改完**开新的 session** 才读得到：

- **Network access** 允许：`api.render.com`、`sxk.onrender.com`、`rds.aliyuncs.com`、`rds.cn-shanghai.aliyuncs.com`
- **环境变数**（不要贴进对话）：
  - `RENDER_API_KEY` —— https://dashboard.render.com/u/settings#api-keys 。⚠️ Render 的 key 是整个帐号的权限。
    2026-09-28 使用者在对话里贴过一把，那一把要当作外泄、删掉重开。
    **也可能放在环境的「API credentials」**（Bearer、Allowed websites `api.render.com`）：那样 session 里看不到这个变数，
    但打 `https://api.render.com/v1/...` 时代理会自动带上 `Authorization`。先不带标头打一次 `GET /v1/services`，回 200 就是这一种
  - `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET` —— RAM 子帐号，只给 `AliyunRDSFullAccess`
  - `ALI_SMS_ACCESS_KEY_ID`、`ALI_SMS_ACCESS_KEY_SECRET`、`ALI_SMS_SIGN_NAME`（森心康）、`ALI_SMS_TEMPLATE_CODE`（SMS_337550877）——
    与正式站 `.env` 同一组。**Render 上若已经有这四项就不用**（先用 API 读 Render 的 env 确认）

## 步骤（接手的 session 做）

1. **确认 Render 的现况**（`GET /v1/services?name=sxk`）：服务 id、追哪个分支（预期 `master`）、
   `autoDeploy`、区域、现有的 env vars（`GET /v1/services/{id}/env-vars`：`MYSQL_*` 有没有值、`ALI_SMS_*` 在不在）。
   顺便查 Render 的对外 IP（服务的 Outbound 页；API 拿不到就用 Render 文件公布的该区域 IP 段）。
2. **给 Render 一个专用的资料库帐号**（阿里云 OpenAPI，`DescribeDBInstances` 找到放 `sxk_db` 的那一台）：
   - `CreateAccount`：`sxk_render`（普通帐号，密码随机产生，只存进 Render 的 env）。**不要**拿正式站 `.env` 那个帐号给 Render：
     分开的帐号才能单独撤掉，Render 那边出事不必连正式站一起换密码
   - `GrantAccountPrivilege`：`sxk_render` 只对 `sxk_db` 读写（`ReadWrite`）。`sxk_t1_db`（专案 B）不给
   - 没有公网地址就 `AllocateInstancePublicConnection`；`ModifySecurityIps` 另开一个白名单分组 `render_demo`，
     只放 Render 的对外 IP。**不要**放 `0.0.0.0/0`
3. **设 Render 的 env**（`PUT /v1/services/{id}/env-vars`，要带上全部既有的，不然会被清掉）：
   - `MYSQL_HOST`（公网地址）、`MYSQL_PORT=3306`、`MYSQL_USER=sxk_render`、`MYSQL_PASSWORD`、`MYSQL_DATABASE=sxk_db`
   - `MEDIA_UPSTREAM=https://sxkscreen.com`
   - ⚠️ **`PAYWALL_DEMO_OPEN=0`**（`render.yaml` 已经改成 `0`；服务若不是从 Blueprint 建的，Render 上的值要用 API 另外改）。
     开着的话任何一位正式站家长在 Render 登入，T2 深度评估就免费，而作答结果写进正式库。
     副作用：Render 上的付费墙照常挡人、而 Render 收不了款（网域没备案）—— 要在 Render 看 T2，用已经付过费的帐号，
     或由后台对那个帐号发权益
   - `ALI_SMS_*` 若缺就补
4. **不要跑迁移**：正式库的结构由阿里云那边的部署流程负责（`deploy/README.md` 第五节）。Render 上的程式码若比正式库新、
   需要新的迁移，**停下来问使用者**，不要从 Render 对正式库跑 `migrate.mjs --confirm`。
   可以跑只检查的 `node deploy/migrate.mjs`（不带 `--confirm`）确认正式库是最新的
5. **后台帐号**：正式站已经有，不另建
6. **部署**：`POST /v1/services/{id}/deploys`（或 push 触发），等到 live
7. **示范片标签不要自动汇入**：共用正式库之后，汇入＝正式站的家长每周活动立刻跟着变。
   `deploy/activity-tags/2026-09-27-module1-videos.json` 还是草稿（README 写待治疗师看过），要使用者明说「汇入」才做；
   做的时候照样先 `dryRun: true`
8. **验收**（从 session 打 `https://sxk.onrender.com`）：
   - `/api/db/status` 回 `engine: mysql`
   - `/media/activities/A001.jpg` 200、`/media/activities/A001.mp4` 带 `Range: bytes=0-99` 回 206
   - 未登入打 `/api/unlocks` 回 **401**（＝付费闸门有在执行）。回 200、`available: false` 表示
     `PAYWALL_DEMO_OPEN` 还开着或资料库没接上 —— 两种都不能交差
   - 首页的字是思源黑体（`/fonts/noto-sans-sc-5.3.0/index.css` 200）
   - 手机验证码登入那一段只有使用者自己能走（验证码发到他的手机）：请他走一次登入 → 报告 → 居家训练 → 播一支片
9. 回报使用者：网址、哪些做完、哪些要他在手机上验；并提醒他 Render 上产生的资料都在正式库里
