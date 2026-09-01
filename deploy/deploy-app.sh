#!/bin/bash
# ============================================
# 森心康 应用部署脚本（两个产品各跑一次）
#
#   bash deploy-app.sh a            部署专案 A（sxkscreen.com）
#   bash deploy-app.sh b            部署专案 B（t1.sxkscreen.com）
#   bash deploy-app.sh a --build    顺便在主机上构建（不建议，见下）
#
# 【默认不构建】
# 这台主机只有 2 GiB RAM，vite + esbuild 跑起来很容易 OOM，而 OOM 杀掉的可能是
# 正在服务的另一个进程 —— 一次部署顺手弄挂另一个产品。所以默认假设 dist/ 是在
# 本机构建好上传的，这里只装运行期依赖并重启。
#
# 本机构建（注意 VITE_APP_MODE 是**构建期**决定前端渲染什么，必须显式指定）：
#
#   VITE_APP_MODE=full   pnpm run build && scp -r dist/ root@主机:/var/www/sxk/
#   VITE_APP_MODE=t1only pnpm run build && scp -r dist/ root@主机:/var/www/sxk-b/
#
# 认不得的值会让构建直接失败（productConfig.ts 的 resolveMode 是 fail-closed）——
# 打错字不会静静建出一份专案 A 交给合作公司。
# ============================================

set -euo pipefail

PRODUCT="${1:-}"
BUILD_HERE="${2:-}"

case "$PRODUCT" in
  # A 的目录与进程名照现场（它在双产品拆分之前就上线了），不是笔误。
  a) APP_DIR="/var/www/sxk";   PM2_NAME="sxk-app"; VITE_MODE="full"   ;;
  b) APP_DIR="/var/www/sxk-b"; PM2_NAME="sxk-b";   VITE_MODE="t1only" ;;
  *)
    echo "用法: bash deploy-app.sh <a|b> [--build]"
    echo "  a = 专案 A（APP_MODE=full,   :5000）"
    echo "  b = 专案 B（APP_MODE=t1only, :5001）"
    exit 2
    ;;
esac

LOG_DIR="/var/log/sxk"
mkdir -p "$LOG_DIR"
cd "$APP_DIR"

# .env 缺席时就地停下。让它起来只会在几分钟后变成一个更难查的问题：
# 缺 MYSQL_* 会退成展示模式（付费墙不执行），缺 ALI_SMS_* 则家长一个都登不进来。
if [ ! -f .env ]; then
  echo "✗ $APP_DIR/.env 不存在。先建好它再部署 —— 缺 MYSQL_* 会静静退成展示模式，"
  echo "  缺 ALI_SMS_* 则家长登不进来（两者都不会让进程起不来，所以不会有人发现）。"
  exit 1
fi

if [ "$BUILD_HERE" = "--build" ]; then
  echo "===== [1/4] 安装全部依赖（含构建工具）====="
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install

  echo "===== [2/4] 构建（VITE_APP_MODE=$VITE_MODE）====="
  echo "⚠ 在 2 GiB 的主机上构建有 OOM 风险，可能连带杀掉另一个产品的进程。"
  VITE_APP_MODE="$VITE_MODE" pnpm run build
else
  echo "===== [1/4] 安装运行期依赖 ====="
  # dist/server.cjs 是 --packages=external 打包的，依赖不在产物里。
  pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

  echo "===== [2/4] 跳过构建（使用已上传的 dist/）====="
  if [ ! -f dist/server.cjs ] || [ ! -f dist/index.html ]; then
    echo "✗ dist/ 里找不到 server.cjs 或 index.html。"
    echo "  先在本机构建并上传，或者加 --build 在这里构建。"
    exit 1
  fi
fi

echo "===== [3/4] 停止旧进程 ====="
pm2 delete "$PM2_NAME" 2>/dev/null || true

echo "===== [4/4] 启动 $PM2_NAME ====="
pm2 start deploy/ecosystem.config.cjs --only "$PM2_NAME"
pm2 save

echo ""
echo "===== $PM2_NAME 部署完成 ====="
pm2 status
echo ""
echo "日志:  pm2 logs $PM2_NAME"
echo "重启:  pm2 restart $PM2_NAME"
echo ""
echo "开机自启（第一次部署时跑一次，照它印出来的那行 sudo 命令执行）："
echo "  pm2 startup"
echo ""
echo "短信通道自检（需要 devDependencies，--prod 安装下不可用）："
echo "  npx tsx scripts/sms-smoke.ts --check"
