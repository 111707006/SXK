# Render 展示環境 sxk-demo-b（2026-09-28）：專案 B（T1 篩查，合作機構渠道）的程式＋內建 MySQL 8.0（假資料）。
# 用來看 B→A 交接（ADR-0009）：B 報告頁「到森心康做深度评估」→ sxk-demo（A）；B 後台「发送邀请简讯」。
#
# 與 deploy/demo/Dockerfile（A）只差在 ENV 那一段（產品模式、展示家長的手機、簡訊印在日誌）——
# 其餘一行不差，`test/demoDockerfiles.structure.test.ts` 比對。不用 build arg 切換：寫錯一個字，
# B 會安安靜靜建成一份 A。
#
# 交接要的 HANDOFF_SECRET（兩邊同一串）與對方網址由 render.yaml 在執行時給，建置（烤資料）時交接是關的。
# 邀請簡訊不真的發（SMS_PROVIDER=console）：連結印在 Render 的 Logs 裡。
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
    APP_MODE=t1only \
    VITE_APP_MODE=t1only \
    MYSQL_HOST=127.0.0.1 \
    MYSQL_PORT=3306 \
    MYSQL_USER=sxk \
    MYSQL_PASSWORD=sxk-demo-local-only \
    MYSQL_DATABASE=sxk_demo \
    DEMO_LOGIN_CODE=246810 \
    DEMO_ADMIN_EMAIL=demo@sxkscreen.com \
    DEMO_ADMIN_PASSWORD=sxk-demo-2026 \
    DEMO_PARENT_PHONE=13900000001 \
    SMS_PROVIDER=console \
    SESSION_SECRET=bake-only-replaced-at-runtime

RUN pnpm run build && bash deploy/demo/bake.sh

# 官方 mysql 映像檔自己的 entrypoint 會去初始化 /var/lib/mysql，這裡不要它。
ENTRYPOINT []
CMD ["bash", "deploy/demo/start.sh"]
