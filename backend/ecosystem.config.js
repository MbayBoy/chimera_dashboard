module.exports = {
  apps: [
    {
      name: 'chimera-backend',
      script: 'server.js',

      // Cluster Mode: set PM2_INSTANCES=max in env for multi-core
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: process.env.PM2_INSTANCES === 'max' ? 'cluster' : 'fork',

      watch: false,
      ignore_watch: ['node_modules', 'logs', 'backups', '*.log'],

      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',

      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        ENABLE_CRON_JOBS: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        ENABLE_CRON_JOBS: 'true'
      },

      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',

      kill_timeout: 30000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      source_map_support: false,
      node_args: '--max-old-space-size=512'
    }
  ]
};
