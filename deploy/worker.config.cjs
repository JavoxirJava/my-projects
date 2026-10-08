const fs = require('node:fs');
const root = fs.realpathSync('/srv/my-projects/current');
const revision = fs.readFileSync(root + '/REVISION', 'utf8').trim();
module.exports = { apps: [{
  name: 'my-projects-worker', cwd: root, interpreter: '/opt/node/bin/node',
  node_args: '--env-file=/etc/my-projects-worker/runtime.env', script: 'scripts/worker.ts',
  instances: 1, exec_mode: 'fork', autorestart: true, kill_timeout: 45000,
  min_uptime: '15s', max_restarts: 10, restart_delay: 5000, time: true,
  max_memory_restart: '220M', env: { NODE_ENV: 'production', REVISION: revision }
}] };
