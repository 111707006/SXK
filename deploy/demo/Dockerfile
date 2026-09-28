# Render 展示環境 sxk-demo（2026-09-28）：專案 A 的程式＋映像檔裡內建一顆 MariaDB（假資料）。
#
# 為什麼長這樣：使用者要一個「不用設定」的展示站 —— 不接阿里雲、不接正式庫、不申請簡訊。
# 所以資料庫跟著服務一起跑、資料在建置時就烤好（deploy/demo/bake.sh 對著真的伺服器灌 seed.ts），
# 登入用固定的展示碼（src/demoLogin.ts：只在資料庫是本機時收，正式站設了會起不來）。
# 示範片由伺服器向正式站拿（MEDIA_UPSTREAM，src/mediaProxy.ts）。
#
# 資料不會留下來：Render 免費方案閒置約 15 分鐘會休眠，醒來＝重啟＝回到烤好的那一份。
# 這裡的帳密都只對映像檔裡那顆只聽 127.0.0.1 的資料庫有效，而那裡面沒有任何真實資料。

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends mariadb-server \
  && rm -rf /var/lib/apt/lists/* /var/lib/mysql

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

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

CMD ["bash", "deploy/demo/start.sh"]
