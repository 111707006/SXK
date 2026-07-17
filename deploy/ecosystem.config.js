// PM2 进程配置文件
// 用法: pm2 start ecosystem.config.js

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
      // === 在此填写你的 API Key ===
      // DASHSCOPE_API_KEY: 'sk-xxxxx',
      // GEMINI_API_KEY: 'xxxxx',
      // === 阿里云 RDS MySQL 配置 ===
      // MYSQL_HOST: 'your-rds-host.mysql.rds.aliyuncs.com',
      // MYSQL_PORT: '3306',
      // MYSQL_USER: 'sxk_user',
      // MYSQL_PASSWORD: 'your_password',
      // MYSQL_DATABASE: 'sxk_db',
    },
    error_file: '/var/log/sxk/error.log',
    out_file: '/var/log/sxk/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
