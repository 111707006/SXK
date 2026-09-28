# Render 展示環境 sxk-demo（2026-09-28）：專案 A 的程式＋映像檔裡內建一顆 MySQL 8.0（假資料）。
#
# 為什麼長這樣：使用者要一個「不用設定」的展示站 —— 不接阿里雲、不接正式庫、不申請簡訊。
# 所以資料庫跟著服務一起跑、資料在建置時就烤好（deploy/demo/bake.sh 對著真的伺服器灌 seed.ts），
# 登入用固定的展示碼（src/demoLogin.ts：只在資料庫是本機時收，正式站設了會起不來）。
# 示範片由伺服器向正式站拿（MEDIA_UPSTREAM，src/mediaProxy.ts）。
#
# 底是官方 mysql:8.0（Oracle Linux 9，glibc 2.34），Node 22 從官方 node 映像檔整包複製過來 ——
# 正式站 RDS 是 MySQL；MariaDB 不認 `CAST(… AS JSON)`，遷移跑不完（2026-09-28 試過）。
#
# 資料不會留下來：Render 免費方案閒置約 15 分鐘會休眠，醒來＝重啟＝回到烤好的那一份。
# 這裡的帳密都只對映像檔裡那顆只聽 127.0.0.1 的資料庫有效，而那裡面沒有任何真實資料。

# 本機演練時可以換底（例如加了公司代理憑證的 mysql:8.0）；Render 上用預設值。
ARG MYSQL_BASE=mysql:8.0

FROM node:22-bookworm-slim AS node

FROM ${MYSQL_BASE}
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
  && node --version \
  && corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production \
    APP_MODE=full \
    VITE_APP_MODE=full \
    MYSQL_HOST=127.0.0.1 \
    MYSQL_PORT=3306 \
    MYSQL_USER=sxk \
    MYSQL_PASSWORD=sxk-demo-local-only \
    MYSQL_DATABASE=sxk_demo \
    DEMO_LOGIN_CODE=246810 \
    DEMO_ADMIN_EMAIL=demo@sxkscreen.com \
    DEMO_ADMIN_PASSWORD=sxk-demo-2026 \
    DEMO_PARENT_PHONE=13900000000 \
    PAYWALL_DEMO_OPEN=1 \
    MEDIA_UPSTREAM=https://sxkscreen.com \
    SESSION_SECRET=bake-only-replaced-at-runtime

RUN pnpm run build && bash deploy/demo/bake.sh

# 官方 mysql 映像檔自己的 entrypoint 會去初始化 /var/lib/mysql，這裡不要它。
ENTRYPOINT []
CMD ["bash", "deploy/demo/start.sh"]
