#!/bin/bash
# ============================================
# 森心康 轻量应用服务器初始化脚本
# 系统: Ubuntu 22.04 / Debian 12
# ============================================

set -e

echo "===== [1/5] 系统更新 ====="
apt update && apt upgrade -y

echo "===== [2/5] 安装 Node.js 20.x ====="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "===== [3/5] 安装 pnpm ====="
npm install -g pnpm

echo "===== [4/5] 安装 Nginx ====="
apt install -y nginx
systemctl enable nginx
systemctl start nginx

echo "===== [5/5] 安装 PM2 ====="
npm install -g pm2

echo ""
echo "===== 安装完成 ====="
echo "Node.js: $(node -v)"
echo "pnpm:    $(pnpm -v)"
echo "Nginx:   $(nginx -v 2>&1)"
echo "PM2:     $(pm2 -v)"
echo ""
echo "下一步: 上传项目代码到 /var/www/sxk/"
