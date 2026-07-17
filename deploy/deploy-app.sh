#!/bin/bash
# ============================================
# 森心康 应用部署脚本
# 在服务器上执行，完成代码部署与启动
# ============================================

set -e

APP_DIR="/var/www/sxk"
LOG_DIR="/var/log/sxk"

# 创建日志目录
mkdir -p "$LOG_DIR"

echo "===== [1/4] 安装依赖 ====="
cd "$APP_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "===== [2/4] 构建前端 ====="
pnpm run build

echo "===== [3/4] 停止旧进程 ====="
pm2 delete sxk 2>/dev/null || true

echo "===== [4/4] 启动服务 ====="
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "===== 部署完成 ====="
echo "服务状态:"
pm2 status
echo ""
echo "日志: pm2 logs sxk"
echo "重启: pm2 restart sxk"
