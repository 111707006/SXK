// PM2 进程配置文件
// 用法: pm2 start ecosystem.config.js
//
// 密钥不要写在这里（本文件会被 git 跟踪，写入会泄露）。
// 请在 /var/www/sxk/.env 中配置密钥，server.ts 启动时会用 dotenv 自动读取：
//
//   DASHSCOPE_API_KEY=sk-xxxxx          # 阿里 DashScope（千问模型 + ASR），启用真实 AI
//   GEMINI_API_KEY=xxxxx                # 可选备用报告引擎
//   MYSQL_HOST=xxx.mysql.rds.aliyuncs.com
//   MYSQL_PORT=3306
//   MYSQL_USER=sxk_user
//   MYSQL_PASSWORD=xxxxx
//   MYSQL_DATABASE=sxk_db
//   SESSION_SECRET=一段足够长的随机字符串   # 登录令牌签名密钥，务必设置以便重启后会话不失效

module.exports = {
  apps: [
    {
      name: 'sxk',
      script: 'dist/server.cjs',
      cwd: '/var/www/sxk',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DEPLOY_RUN_PORT: 5000,
      },
      error_file: '/var/log/sxk/error.log',
      out_file: '/var/log/sxk/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
