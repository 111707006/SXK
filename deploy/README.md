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

## 三、上传代码

```bash
# 在服务器上创建项目目录
sudo mkdir -p /var/www/sxk
sudo chown $USER:$USER /var/www/sxk

# 本地打包上传 (在本地执行)
scp SXK--main-v3.zip root@你的IP:/var/www/sxk/

# 服务器上解压
cd /var/www/sxk
unzip SXK--main-v3.zip
```

## 四、配置环境变量

```bash
# 编辑 ecosystem.config.js，填入你的 API Key
nano /var/www/sxk/deploy/ecosystem.config.js

# 需要配置的 Key:
# DASHSCOPE_API_KEY  - 阿里 DashScope (千問模型 + ASR)
# GEMINI_API_KEY     - Google Gemini (可选备用)
```

## 五、部署应用

```bash
# 复制部署脚本到项目根目录
cp deploy/deploy-app.sh .
cp deploy/ecosystem.config.js .

# 执行部署
chmod +x deploy-app.sh
bash deploy-app.sh
```

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
4. 复制到 ecosystem.config.js 的 DASHSCOPE_API_KEY
