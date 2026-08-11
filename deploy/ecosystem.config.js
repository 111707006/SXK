// PM2 进程配置：两个产品，两个进程。
//
// 用法: pm2 start ecosystem.config.js          （两个都起）
//       pm2 start ecosystem.config.js --only sxk-a
//
// 【为什么是两个进程而不是一个】
// `VITE_APP_MODE` 在**构建期**决定前端 bundle 渲染什么，`APP_MODE` 在**运行期**
// 决定进程注册哪些路由（见 server.ts 的 resolveAppMode）。前者是构建期的，
// 所以 A 和 B 是两份不同的 dist/ —— 同一份产物跑两个进程办不到。
//
// 因此两个产品各自有独立的目录、独立的 .env、独立的数据库、独立的端口：
//
//   /var/www/sxk     APP_MODE=full     MYSQL_DATABASE=sxk_db      :5000  (sxk-app)
//   /var/www/sxk-b   APP_MODE=t1only   MYSQL_DATABASE=sxk_t1_db   :5001  (sxk-b)
//
// 【为什么 A 的目录与进程名不对称】
// A 在双产品拆分之前就上线了，现在 sxkscreen.com 上跑的就是它：目录
// /var/www/sxk、PM2 名称 sxk-app、cluster 模式。这里照实写，**不改成好看的
// sxk-a** —— 一份与现场不符的配置文件，会在某个人照着它执行 `pm2 delete sxk-a`
// 却什么都没停掉、然后以为自己停了的时候出事。要搬家是另一件事，搬完再改这里。
//
// 【密钥不要写在这里】
// 本文件会被 git 跟踪，写进来就等于提交到版本库。每个产品目录各自建一份 .env
// （已被 .gitignore 排除），server.ts 启动时用 dotenv 自动读取：
//
//   DASHSCOPE_API_KEY=sk-xxxxx
//   MYSQL_HOST=xxx.mysql.rds.aliyuncs.com
//   MYSQL_PORT=3306
//   MYSQL_USER=sxk_user
//   MYSQL_PASSWORD=xxxxx
//   MYSQL_DATABASE=sxk_db            ← A 与 B 必须不同
//   SESSION_SECRET=一段足够长的随机字符串
//   ALI_SMS_ACCESS_KEY_ID=LTAI...    ← 四项缺一，家长就登不进来
//   ALI_SMS_ACCESS_KEY_SECRET=...
//   ALI_SMS_SIGN_NAME=森心康
//   ALI_SMS_TEMPLATE_CODE=SMS_xxxxxxxxx
//
// ⚠️ 从阿里云控制台复制粘贴的值会带进看不见的定位字元。贴完跑一次：
//      npx tsx scripts/sms-smoke.ts --check
//
// 【APP_MODE 写在这里，不写在 .env】
// 它不是密钥，而且它决定这个进程「是哪一个产品」—— 放在版本库里看得见的地方，
// 比散在两台机器的 .env 里更难搞错。写错的值会让进程直接起不来（fail-closed），
// 但两个 .env 互相复制时把 MYSQL_DATABASE 也一起带过去，是不会有任何声响的。

const base = {
  script: 'dist/server.cjs',
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: '512M',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
};

module.exports = {
  apps: [
    {
      ...base,
      // 专案 A：深度评估 + 付费解锁 + 商城端点全部注册。
      // 名称与目录照现场（见文件头），不是笔误。
      name: 'sxk-app',
      cwd: '/var/www/sxk',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        DEPLOY_RUN_PORT: 5000,
        APP_MODE: 'full',
      },
      error_file: '/var/log/sxk/a-error.log',
      out_file: '/var/log/sxk/a-out.log',
    },
    {
      ...base,
      // 专案 B：那些端点不注册，路径等同不存在；后台是多公司模式。
      name: 'sxk-b',
      cwd: '/var/www/sxk-b',
      env: {
        NODE_ENV: 'production',
        DEPLOY_RUN_PORT: 5001,
        APP_MODE: 't1only',
      },
      error_file: '/var/log/sxk/b-error.log',
      out_file: '/var/log/sxk/b-out.log',
    },
  ],
};
