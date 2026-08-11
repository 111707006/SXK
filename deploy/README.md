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
  && scp -r dist root@你的IP:/var/www/sxk-a/

# 本机：专案 B
VITE_ICP_BEIAN="沪ICP备2026009790号-3" VITE_APP_MODE=t1only pnpm run build \
  && scp -r dist root@你的IP:/var/www/sxk-b/
```

> 备案号末尾的 `-3` 是网站序号（同一主体下的第三个网站），**必须照抄** ——
> 漏掉就与工信部的记录对不上，抽查时等同没挂。

> ⚠️ `VITE_ICP_BEIAN` 是**构建期**常数，设在服务器的 `.env` 里不会有任何效果。
> 备案通过却没在页面底部挂号码，阿里云的处理是要求整改乃至关停接入 ——
> 也就是说漏了这一项，域名会打不开。未设定时整段不渲染（见 `src/components/BeianFooter.tsx`）。

主机上各跑一次（脚本会检查 `.env` 与 `dist/` 在不在，缺了就地停下）：

```bash
cd /var/www/sxk-a && bash deploy/deploy-app.sh a
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
