#!/usr/bin/env bash
# Render 展示環境（sxk-demo）的啟動指令：先起映像檔裡那一顆 MariaDB（bake.sh 烤好的假資料），再起伺服器。
# 資料不會留下來：服務重啟（Render 免費方案閒置休眠後醒來也算）就回到映像檔裡那一份。
set -euo pipefail
cd "$(dirname "$0")/../.."
source deploy/demo/db.sh
db_start
exec node dist/server.cjs
