# Render 展示环境

> **2026-09-28 定案：假资料库。** Render 上另开一个服务 `sxk-demo`，MySQL 8.0 跟着服务一起跑、假资料在建置时烤好。
> 不接阿里云、不接正式库、不申请简讯、不用在 Claude 的环境设定里放任何金钥。
> （取代同日稍早的「共用正式库」与 09-27 的「另开展示库」两版：那两版都要使用者去阿里云与 Claude 的环境设定里操作，
> 使用者做不到；原本的 `sxk` 服务不动，`PAYWALL_DEMO_OPEN` 已改成 0。）

> **2026-09-28 加上 `sxk-demo-b`**：专案 B 的展示站，用来看 B→A 交接（ADR-0009）—— B 报告页「到森心康做深度评估」
> 按下去直接登入 `sxk-demo`、停在 T2 入口；B 后台「发送邀请简讯」。两个站读同一个环境变数群组 `sxk-demo-handoff`
> 里的交接密钥（Render 自动产生）。

## 使用者要做的（一次）

Render 主控台 https://dashboard.render.com ：

- 若这个 repo 当初就是用 **Blueprint** 接的：进 **Blueprints** → 点这个 repo 的 Blueprint → **Manual Sync**（或等它自己同步），
  清单里会多出 `sxk-demo`、`sxk-demo-b` 与环境变数群组 `sxk-demo-handoff` → **Apply**。
- 若不是：**New +** → **Blueprint** → 选 `111707006/SXK` → Render 读 `render.yaml` → 勾 `sxk-demo`、`sxk-demo-b` → **Apply**。

第一次建置约 5–10 分钟（下载 MySQL 映像档、装相依、建前端、烤资料库），两个站各建各的。完成后网址是
`https://sxk-demo.onrender.com`（A）与 `https://sxk-demo-b.onrender.com`（B）。

⚠️ 两个站靠网址互相找：`sxk-demo` 的 `HANDOFF_SOURCE_ORIGIN` 指向 B、`sxk-demo-b` 的 `HANDOFF_TARGET_ORIGIN` 指向 A。
Render 若因为名字被占用而配了别的子网域（例如 `sxk-demo-b-x1y2.onrender.com`），到那个服务的 **Environment** 把对方的网址改掉。

## 怎么用

| | |
|---|---|
| 网址 | `https://sxk-demo.onrender.com` |
| 家长登入 | 任何 11 位手机号，验证码 **246810**（不会真的发简讯） |
| 已经做完的展示家长 | 手机 **13900000000**：30 个月的「小安」，T1 动作发展需关注、T2 粗大动作量表做完、报告与本周活动都在 |
| 后台 | `https://sxk-demo.onrender.com/admin`，帐号 `demo@sxkscreen.com`、密码 `sxk-demo-2026` |
| 示范片 | 由伺服器向 `https://sxkscreen.com/media/` 拿（`MEDIA_UPSTREAM`，`src/mediaProxy.ts`） |
| T2 付费墙 | 展示开关打开（`PAYWALL_DEMO_OPEN=1`），付费墙上有「略过」入口 —— 资料是假的 |

### 看 B→A 交接（`sxk-demo-b`）

| | |
|---|---|
| B 家长端 | `https://sxk-demo-b.onrender.com/?c=demo`，手机 **13900000001**、验证码 **246810**：「小安」T1 做完 → 「评估报告」→「查看实时综合评估报告」→ 往下滑到「到森心康做深度评估」→ 按下去 |
| 会看到 | 直接到 `sxk-demo`、已经登入、孩子与 T1 带过去了、停在 T2 入口（不用再输验证码） |
| B 后台 | `https://sxk-demo-b.onrender.com/admin`，同一组帐密；右上角选「示范合作机构」→ 家长列表的「深度评估邀请」栏与勾选 → 「发送邀请简讯」 |
| 简讯连结 | 展示站不真的发简讯：到 Render 的 `sxk-demo-b` → **Logs**，搜 `[SMS/console]`，那一行的网址就是简讯里的连结；打开会先看到同意画面 |
| 三位 B 家长 | 13900000001「小安」（T1 做完）、13900000002「小乐」（T1 做完，可邀请）、13900000003「小宁」（还没做筛查） |

两个站都休眠时，先打开 B 等它醒来，再按按钮 —— A 向 B 拿资料只等 5 秒。

⚠️ **资料不会留下来**：Render 免费方案闲置约 15 分钟会休眠，醒来就是重启，回到烤好的那一份。第一次打开要等约 50 秒唤醒。

## 怎么做到的

- `deploy/demo/Dockerfile`：官方 `mysql:8.0` ＋ 从官方 node 映像档复制来的 Node 22；设定都写在 `ENV`（帐密只对映像档里那颗只听 127.0.0.1 的资料库有效）。
  不用 MariaDB：迁移用了 MySQL 才有的 `CAST(… AS JSON)`，2026-09-28 试过跑不完；正式站 RDS 也是 MySQL
- 2026-09-28 本机实测（`docker run --memory=512m`）：4 秒起来、闲置约 185 MB、浏览过一轮约 200 MB；
  浏览器走过「展示家长登入 → T1 报告 → 付费墙略过 → T2 问卷清单 → T2 报告与居家训练」
- `deploy/demo/bake.sh`：建置时跑一次 —— 建库 → `schema.sql` → `migrate.mjs --confirm` → 起伺服器 → `seed.ts` → 关掉
- `deploy/demo/seed.ts`：**走真的端点**灌资料（登入、存档、交卷、生成报告、配每周活动），只有后台帐号直接写 SQL；
  示范片标签用后台的批量汇入端点汇 `deploy/activity-tags/2026-09-27-module1-videos.json`
- `deploy/demo/start.sh`：执行时先起 MySQL 再起伺服器
- 固定验证码 `DEMO_LOGIN_CODE`（`src/demoLogin.ts`）：**只在 `MYSQL_HOST` 是本机时收**，正式站设了会起不来；
  设了之后索取验证码不送简讯、不套防刷，其余照正式那一条走
- `render.yaml` 的 `sxk-demo`：Docker、免费方案、新加坡；只放 `SESSION_SECRET`（Render 自动产生）与交接设定
- `sxk-demo-b`：`deploy/demo/Dockerfile.b`，与 A 那一份只差 ENV（`APP_MODE=t1only`、展示家长的手机、`SMS_PROVIDER=console`），
  `test/demoDockerfiles.structure.test.ts` 挡住两份分岔；`seed.ts` 看 `APP_MODE` 灌 B 的那一份（示范合作机构 `demo`、三位家长）
- 2026-09-28 本机演练（两个容器各 512 MB、各带一颗 MySQL）：B 家长从画面登入 → 报告 → 按卡 → A 已登入停在 T2 入口；
  B 后台选机构 → 勾选 → 发送 → 日志里的连结 → A 同意画面 → 已登入。两个容器闲置各约 200 MB

## 要改展示资料

改 `deploy/demo/seed.ts`（或标签档）→ push 到 `master` → Render 重新建置就是新的一份。
