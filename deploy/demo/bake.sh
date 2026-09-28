#!/usr/bin/env bash
# Render 展示環境（sxk-demo）：Docker 建置時跑一次。
#   建庫 → 建表（schema.sql）→ 跑遷移（migrate.mjs，活動庫、手冊內容、示範片都在這一步）
#   → 起伺服器 → 灌假資料（seed.ts）→ 全部關掉。
# 結果留在 DEMO_DB_DIR，烤進映像檔：服務每次重啟都從這一份開始（Render 免費方案閒置會休眠，醒來就是重啟）。
#
# 需要的環境變數（Dockerfile 帶好）：MYSQL_*（指向本機這一顆）、DEMO_LOGIN_CODE、DEMO_ADMIN_PASSWORD、
# NODE_ENV=production，以及已經建好的 dist/。
set -euo pipefail
cd "$(dirname "$0")/../.."
source deploy/demo/db.sh

rm -rf "$DEMO_DB_DIR"
mkdir -p "$DEMO_DB_DIR"
chown mysql:mysql "$DEMO_DB_DIR"
mariadb-install-db --no-defaults --user=mysql --datadir="$DEMO_DB_DIR" \
  --auth-root-authentication-method=socket --skip-test-db > /dev/null
db_start

db_root -e "
  CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD';
  CREATE USER '$MYSQL_USER'@'localhost' IDENTIFIED BY '$MYSQL_PASSWORD';
  GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'127.0.0.1';
  GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'localhost';"
db_root "$MYSQL_DATABASE" < deploy/schema.sql
node deploy/migrate.mjs --confirm

BAKE_PORT=5055
DEPLOY_RUN_PORT=$BAKE_PORT node dist/server.cjs > "$DEMO_DB_RUN/bake-server.log" 2>&1 &
SERVER_PID=$!
node -e "
  const url = 'http://127.0.0.1:$BAKE_PORT/api/db/status';
  (async () => {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(url); const j = await r.json(); if (j.engine === 'mysql') process.exit(0); } catch {}
      await new Promise(res => setTimeout(res, 1000));
    }
    console.error('[bake] 伺服器 60 秒内没接上资料库'); process.exit(1);
  })();
" || { cat "$DEMO_DB_RUN/bake-server.log" >&2; exit 1; }

DEMO_BASE_URL="http://127.0.0.1:$BAKE_PORT" npx tsx deploy/demo/seed.ts \
  || { cat "$DEMO_DB_RUN/bake-server.log" >&2; kill "$SERVER_PID"; exit 1; }

kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
db_stop
wait
echo "[bake] 假资料库烤好了：$DEMO_DB_DIR"
