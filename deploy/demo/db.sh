# Render 展示環境（sxk-demo）內建的 MariaDB：建置時（bake.sh）與執行時（start.sh）共用這幾個函式。
# 只聽 127.0.0.1、記憶體壓到最小 —— Render 免費方案一台 512 MB，Node 還要用掉一半。
# 由呼叫端 `source`；路徑可用環境變數覆寫（本機演練時指到暫存目錄）。

DEMO_DB_DIR="${DEMO_DB_DIR:-/var/lib/sxk-demo-db}"
DEMO_DB_RUN="${DEMO_DB_RUN:-/run/sxk-demo}"
DEMO_DB_SOCKET="$DEMO_DB_RUN/mysqld.sock"
DEMO_DB_PORT="${DEMO_DB_PORT:-3306}"

db_start() {
  mkdir -p "$DEMO_DB_RUN"
  chown mysql:mysql "$DEMO_DB_RUN" "$DEMO_DB_DIR"
  mariadbd --no-defaults --user=mysql \
    --datadir="$DEMO_DB_DIR" --socket="$DEMO_DB_SOCKET" --pid-file="$DEMO_DB_RUN/mysqld.pid" \
    --bind-address=127.0.0.1 --port="$DEMO_DB_PORT" --skip-name-resolve --skip-log-bin \
    --innodb-buffer-pool-size=32M --innodb-log-file-size=16M --performance-schema=OFF \
    --max-connections=30 --table-open-cache=200 --key-buffer-size=1M \
    --tmp-table-size=4M --max-heap-table-size=4M --thread-cache-size=4 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
    --log-error="$DEMO_DB_RUN/mysqld.err" &
  for _ in $(seq 1 60); do
    if mariadb-admin --no-defaults --socket="$DEMO_DB_SOCKET" -uroot ping >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "[demo-db] MariaDB 60 秒内没起来：" >&2
  cat "$DEMO_DB_RUN/mysqld.err" >&2 || true
  return 1
}

db_stop() {
  mariadb-admin --no-defaults --socket="$DEMO_DB_SOCKET" -uroot shutdown
}

db_root() {
  mariadb --no-defaults --socket="$DEMO_DB_SOCKET" -uroot "$@"
}
