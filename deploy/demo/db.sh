# Render 展示環境（sxk-demo）內建的 MySQL 8.0：建置時（bake.sh）與執行時（start.sh）共用這幾個函式。
# 只聽 127.0.0.1、記憶體壓到最小 —— Render 免費方案一台 512 MB，Node 還要用掉一半。
# 由呼叫端 `source`；路徑可用環境變數覆寫（本機演練時指到暫存目錄）。
#
# 為什麼是 MySQL 不是 MariaDB：遷移用了 MySQL 才有的語法（`CAST(… AS JSON)`），驗證句也認 JSON 欄位型別；
# 正式站的 RDS 是 MySQL。2026-09-28 用 MariaDB 試過，到 09-23 那份遷移就停了。
#
# 用戶端一律拿掉 MYSQL_HOST 再以 localhost（＝socket）連：那個環境變數是伺服器本身要用的，
# 但 mysql／mysqladmin 也會讀它而改走 TCP，而 root 在這裡只從 socket 登入。

DEMO_DB_DIR="${DEMO_DB_DIR:-/var/lib/sxk-demo-db}"
DEMO_DB_RUN="${DEMO_DB_RUN:-/run/sxk-demo}"
DEMO_DB_SOCKET="$DEMO_DB_RUN/mysqld.sock"
DEMO_DB_PORT="${DEMO_DB_PORT:-3306}"

db_client_args=(--no-defaults --host=localhost --protocol=socket --socket="$DEMO_DB_SOCKET" -uroot)

db_init() {
  rm -rf "$DEMO_DB_DIR"
  mkdir -p "$DEMO_DB_DIR" "$DEMO_DB_RUN"
  chown mysql:mysql "$DEMO_DB_DIR" "$DEMO_DB_RUN"
  mysqld --no-defaults --initialize-insecure --user=mysql --datadir="$DEMO_DB_DIR" \
    --log-error="$DEMO_DB_RUN/init.err"
}

db_start() {
  mkdir -p "$DEMO_DB_RUN"
  chown mysql:mysql "$DEMO_DB_RUN" "$DEMO_DB_DIR"
  mysqld --no-defaults --user=mysql \
    --datadir="$DEMO_DB_DIR" --socket="$DEMO_DB_SOCKET" --pid-file="$DEMO_DB_RUN/mysqld.pid" \
    --bind-address=127.0.0.1 --port="$DEMO_DB_PORT" --mysqlx=OFF --skip-name-resolve --skip-log-bin \
    --innodb-buffer-pool-size=32M --performance-schema=OFF \
    --max-connections=30 --table-open-cache=200 --table-definition-cache=400 --key-buffer-size=1M \
    --tmp-table-size=4M --max-heap-table-size=4M --thread-cache-size=4 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
    --log-error="$DEMO_DB_RUN/mysqld.err" &
  for _ in $(seq 1 90); do
    if env -u MYSQL_HOST -u MYSQL_TCP_PORT mysqladmin "${db_client_args[@]}" ping >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "[demo-db] MySQL 90 秒内没起来：" >&2
  cat "$DEMO_DB_RUN/mysqld.err" >&2 || true
  return 1
}

db_stop() {
  env -u MYSQL_HOST -u MYSQL_TCP_PORT mysqladmin "${db_client_args[@]}" shutdown
}

db_root() {
  env -u MYSQL_HOST -u MYSQL_TCP_PORT mysql "${db_client_args[@]}" "$@"
}
