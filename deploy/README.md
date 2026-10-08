# 森心康 阿里云轻量服务器部署指南

## 一、购买服务器

| 配置项 | 推荐值 |
|--------|--------|
| 地域 | 华东 (上海/杭州) 或就近地域 |
| 系统 | Ubuntu 22.04 |
| 规格 | 2核2G 起步 (推荐 2核4G) |
| 磁盘 | 50G SSD |
| 带宽 | 3-5Mbps |

## 二、服务器初始化

SSH 登录服务器后执行:

```bash
# 上传 setup-server.sh 到服务器后执行
chmod +x setup-server.sh
sudo bash setup-server.sh
```

安装内容: Node.js 20 + pnpm + Nginx + PM2

## 三、上传代码（两个产品，两个目录）

两个产品共用同一份源码，但 `VITE_APP_MODE` 是**构建期**常数（见 `src/productConfig.ts`），
所以 A 和 B 是两份不同的 `dist/` —— 同一个目录跑两个进程办不到。

| 目录 | 产品 | PM2 名称 | `APP_MODE` | 数据库 | 端口 | 域名 |
|---|---|---|---|---|---|---|
| `/var/www/sxk` | 专案 A | `sxk-app` | `full` | `sxk_db` | 5000 | `sxkscreen.com` |
| `/var/www/sxk-b` | 专案 B | `sxk-b` | `t1only` | `sxk_t1_db` | 5001 | `t1.sxkscreen.com` |

**A 已经在服务了**（2026-08-11 实测：`https://sxkscreen.com` 回 200）。它的目录与
进程名不对称，是因为它在双产品拆分之前就上线了。这里照实记录，不改成好看的
`sxk-a` —— 一份与现场不符的文档，会在某个人照着它 `pm2 delete sxk-a` 却什么都
没停掉、然后以为自己停了的时候出事。

只需要新建 B：

```bash
sudo mkdir -p /var/www/sxk-b /var/log/sxk
git clone https://github.com/111707006/SXK.git /var/www/sxk-b
```

## 四、配置环境变量（密钥写入 .env，不要写进 ecosystem.config.cjs）

`ecosystem.config.cjs` 会被 Git 跟踪，密钥写在那里会泄露。改为在项目根目录创建 `.env`（已被 `.gitignore` 排除），`server.ts` 启动时用 dotenv 自动读取：

```bash
nano /var/www/sxk/.env
```

填入以下内容：

```ini
# 阿里 DashScope (千問模型 + ASR)，启用真实 AI 报告与语音识别
DASHSCOPE_API_KEY=sk-xxxxx

# Google Gemini 备用报告引擎（可选，境内不可直连）
# GEMINI_API_KEY=xxxxx

# MySQL（可指向已有的阿里云 RDS，表结构见 deploy/schema.sql）
MYSQL_HOST=xxx.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_USER=sxk_user
MYSQL_PASSWORD=xxxxx
MYSQL_DATABASE=sxk_db

# 登录令牌签名密钥：务必设置一段足够长的随机串，否则每次重启后所有登录都会失效
# 生成方法： openssl rand -hex 32
SESSION_SECRET=在此粘贴一段随机字符串
```

> 数据库：若使用已有的阿里云 RDS，表已存在无需重建；全新库请先执行 `deploy/schema.sql`。
> 已经在跑的库请依日期顺序执行 `deploy/migrations/` 底下还没跑过的迁移，每一份的开头都写明了它可不可以重复执行、以及要在部署前还是部署后跑。
> 用 `node deploy/migrate.mjs` 跑：**预设只检查不改动**，会逐份列出哪些还没跑完；
> 备份完数据库、确认目标主机无误之后再加 `--confirm`。它跑完会验证每一份迁移自己
> 结尾的那几句检查，没有全过就明说「先不要部署」。
> 家长端**没有密码**：登入只有手机号验证码一条路（#27 起）。验证码只存 bcrypt 哈希，
> 且短信通道要 `ALI_SMS_*` 四项齐全才会开放 —— 缺任何一项，家长会收到「短信通道尚未开放」，
> 而不是一个假装送出去的成功。旧版 `schema.sql` 种下的测试账号（test@test.com / 123456）
> 已不再种、也没有任何路由走得到它；既有的那一列留在库里不动。

## 五、部署应用

**先在本机构建再上传** —— 主机只有 2 GiB，vite + esbuild 容易 OOM，而 OOM 杀掉的
可能是正在服务的另一个产品。`VITE_APP_MODE` 必须显式指定，认不得的值会让构建直接
失败（fail-closed，打错字不会静静建出一份专案 A 交给合作公司）：

```bash
# 本机：专案 A
VITE_ICP_BEIAN="沪ICP备2026009790号-3" VITE_APP_MODE=full pnpm run build \
  && scp -r dist root@你的IP:/var/www/sxk/

# 本机：专案 B
VITE_ICP_BEIAN="沪ICP备2026009790号-3" VITE_APP_MODE=t1only pnpm run build \
  && scp -r dist root@你的IP:/var/www/sxk-b/
```

> 备案号末尾的 `-3` 是网站序号（同一主体下的第三个网站），**必须照抄** ——
> 漏掉就与工信部的记录对不上，抽查时等同没挂。

> ⚠️ `VITE_ICP_BEIAN` 是**构建期**常数，设在服务器的 `.env` 里不会有任何效果。
> 备案通过却没在页面底部挂号码，阿里云的处理是要求整改乃至关停接入 ——
> 也就是说漏了这一项，域名会打不开。未设定时整段不渲染（见 `src/components/BeianFooter.tsx`）。
>
> **2026-09-01 实测：子域 `t1.sxkscreen.com` 的页脚没有备案号，主站有。**
> 两边跑的是同一份代码、同一个 `BeianFooter`，所以原因只有一个 —— 专案 B 那次
> 构建漏了 `VITE_ICP_BEIAN=`。照上面的指令重构一次 B 并重新部署即可，无需改代码。
> 这正是「未设定就整段不渲染」的代价：漏了不会报错，只是页脚少一行。

> ⚠️ 服务器的 `.env` 另外还要设一个 **`ICP_BEIAN`**（没有 `VITE_` 前缀）：
>
> ```
> ICP_BEIAN="沪ICP备2026009790号-3"
> ```
>
> 它给**服务器自己吐出的那几页 HTML** 用 —— 家长扫码带走的报告页（`/r/:token`）
> 与链接失效页。那些页面不是 React 产生的，读不到构建期常数。
> 两个变量值一样，但一个设在本机构建时、一个设在服务器 `.env`，
> 因为本专案是在本机构建再 scp 上去的，产物离开本机之后就改不动了。
> 漏掉 `ICP_BEIAN` 的症状：家长端页脚有备案号，扫码打开的报告页没有。

### 示范片与封面（只有专案 A；Keep 规格 K05）

片子与封面**不在 `dist/` 里、也不进 git**：`dist/` 每次部署整个换掉。它们放在主机的
`/var/www/sxk/media/activities/`，由 `server.ts` 挂在 `/media`（网址 `/media/activities/A001.mp4`）。
目录可以用 `.env` 的 `MEDIA_DIR` 改，预设就是 `<进程目录>/media` ＝ `/var/www/sxk/media`，不用设。
专案 B 没有这条路，不用传。

第一次上线，或客户补了片子：

```bash
# ① 本机：从客户的 zip 产出 media/activities/（要 ffmpeg／ffprobe）；--check 确认要传的就是清单上那几支
npx tsx scripts/t2-prepare-media.ts --zip <T2视频_20260923.zip 的路径>
npx tsx scripts/t2-prepare-media.ts --check --zip <T2视频_20260923.zip 的路径>

# ② 本机 → 主机（2026-09-24 那一批：17 支片＋17 张封面，约 24 MB）
ssh root@你的IP mkdir -p /var/www/sxk/media
scp -r media/activities root@你的IP:/var/www/sxk/media/
```

③ 跑迁移（`2026-09-24-activity-media.sql` 把十七支的网址、封面、片长写进活动库），④ 部署程式码。

> **片子先传、迁移后跑。** 反过来，片库会列出十七支打不开的片。③ 跑完到 ④ 部署完之间，旧版程式码
> 没有 `/media`（会回 `index.html`），封面与片子是破的 —— 两步接着做。
>
> scp 只会覆盖、不会删：清单拿掉的片（例如客户要换掉某一支）要到主机上手动删那两个档。
>
> 部署完验：`curl -I https://sxkscreen.com/media/activities/A001.mp4` 回 200、`Content-Type: video/mp4`；
> 加 `-H 'Range: bytes=0-1'` 回 206（iPhone 播 mp4 靠它）。

**后台直接上传（2026-10-08 起）**：客户在后台「示范片与标签」分页自己传，写进同一个 `/var/www/sxk/media/activities/`，
不用再走上面的 scp。要先做两件事：

1. nginx 预设一次只收 1 MB —— 把 `deploy/nginx.conf` 里「后台上传示范片与封面」那一段 `location` 加进
   `/etc/nginx/sites-enabled/sxk`（放在 `location /` 前后都可以，正则 location 优先），`sudo nginx -t && sudo systemctl reload nginx`。
   没加的话，上传会在画面上显示「档案太大，主机拒收」。
2. 跑 Node 的使用者要能写 `/var/www/sxk/media/activities/`（`ls -ld` 看一下，不对就 `chown`）。

传上去的网址带版本（`?v=…`），换片后家长不会看到快取里的旧片。备份：这个目录不在 git 里，要另外备份。

### B→A 交接（ADR-0009；规格 `docs/specs/b-to-a-handoff.md`）

B 的家长在报告页按「到森心康做深度评估」，不用再登入就到 A、带着孩子档案与 T1 成绩停在 T2 入口。
两个数据库**不合并**：A 在那一刻用交接码向 B（`127.0.0.1:5001`，不经公网）拿资料。交接码不过期、可以重复用
（使用者 2026-09-28），B 的帐号删掉就失效。后台另有「发送邀请简讯」：全域管理员勾选家长一次发送（见下）。

**没设 `HANDOFF_SECRET` ＝ 功能关闭**：B 的报告页不出现那张卡、A 的 `/handoff` 回登入页。
ADR-0009「待定」第 1 项（合作公司同意在他们的报告页放这颗按钮）有答案之前，**先不要设**。

要开的时候：

```bash
# ① 两个库都跑迁移（A、B 共用同一份 schema）：建 handoff_codes、handoff_imports
cd /var/www/sxk   && node deploy/migrate.mjs            # 看清单 → 备份 → 加 --confirm
cd /var/www/sxk-b && node deploy/migrate.mjs

# ② 产生一把共用的密钥（A、B 两边的 .env 填同一串）
openssl rand -hex 32
```

```ini
# /var/www/sxk/.env（专案 A，接收端）
HANDOFF_SECRET=上面那一串
HANDOFF_SOURCE_ORIGIN=http://127.0.0.1:5001

# /var/www/sxk-b/.env（专案 B，发出端）
HANDOFF_SECRET=上面那一串
HANDOFF_TARGET_ORIGIN=https://sxkscreen.com
# HANDOFF_CONSENT_VERSION=handoff-consent-v1   # 改了按钮下那行同意文字才换
```

```ini
# /var/www/sxk-b/.env（专案 B）——后台的「发送邀请简讯」要用：阿里云另外审过的推广范本
# 范本里网址写死、只有交接码是变数，例：
#   您好，孩子的筛查结果可以带到森心康继续做深度评估，点击 https://sxkscreen.com/handoff#invite=${code} 进入，不用重新登录。拒收请回复R
ALI_SMS_INVITE_TEMPLATE_CODE=SMS_xxxxxxx
```

③ nginx 的 B 那一段要有 `location /internal/ { return 404; }`（见 `deploy/nginx.conf`；A 直接打 5001，不受影响）。
④ 两边都重新部署（`deploy-app.sh a`、`deploy-app.sh b`）。

> 设错会**起不来**，不会半开：密钥短于 32 字、有密钥没网址、对外网址不是 https，`server.ts` 启动就丢错。
>
> 部署完验：
> `curl https://t1.sxkscreen.com/api/handoff/config` 回 `{"enabled":true,...}`；
> `curl -X POST https://t1.sxkscreen.com/internal/handoff/redeem` 回 nginx 的 404；
> 用一位 B 的测试家长做完筛查、按那颗按钮，应该直接落在 sxkscreen.com 的 T1 报告、捲到 T2 入口。
>
> 关掉：两边的 `.env` 拿掉 `HANDOFF_SECRET` 再重启（已经发出去的连结跟着失效）。已经转过去的家长留在 A（那是他们自己的帐号了）。
>
> 后台发邀请：B 的管理中心用全域管理员登入 → 选定一家合作公司（或未归属）→ 家长列表勾选 →「发送邀请简讯」。
> 同一位家长 7 天一封；没手机、没做筛查、已经去过 A 的勾不起来。**简讯按条计费、送出收不回。**
> ADR-0009 待定第 2 项（没勾过同意的旧家长能不能发）法务答复之前，建议先不要对旧家长发。

主机上各跑一次（脚本会检查 `.env` 与 `dist/` 在不在，缺了就地停下）：

```bash
cd /var/www/sxk && bash deploy/deploy-app.sh a
cd /var/www/sxk-b && bash deploy/deploy-app.sh b

# 第一次部署跑一次开机自启，照它印出来的那行 sudo 命令执行
pm2 startup
```

> 实在要在主机上构建：`bash deploy/deploy-app.sh a --build`（脚本会先警告 OOM 风险）。

## 六、配置 Nginx

```bash
# 复制 Nginx 配置
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sxk
sudo ln -s /etc/nginx/sites-available/sxk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 编辑域名 (替换 your-domain.com 为你的域名或 IP)
sudo nano /etc/nginx/sites-available/sxk

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

## 七、配置防火墙

在阿里云控制台 → 轻量应用服务器 → 防火墙，添加规则:

| 端口 | 协议 | 说明 |
|------|------|------|
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 22 | TCP | SSH (默认已开) |

## 八、SSL 证书 (可选但建议)

```bash
# 方式1: 阿里云免费 SSL 证书
# 控制台 → SSL证书 → 申请免费证书 → 下载 Nginx 格式

# 方式2: Let's Encrypt 免费证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 九、常用运维命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs sxk

# 重启服务
pm2 restart sxk

# 重新部署 (更新代码后)
cd /var/www/sxk
git pull  # 或重新上传代码
pnpm install
pnpm run build
pm2 restart sxk

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

## 十、DashScope API Key 获取

1. 访问 https://dashscope.console.aliyun.com/
2. 开通 DashScope 服务
3. 在「API-KEY 管理」中创建 Key
4. 复制到 ecosystem.config.cjs 的 DASHSCOPE_API_KEY
