const fs = require('node:fs');
const path = require('node:path');
const root = fs.realpathSync('/srv/my-projects/current');
const revision = fs.readFileSync(path.join(root, 'REVISION'), 'utf8').trim();
const common = { cwd: root, interpreter: '/opt/node/bin/node', node_args: '--env-file=/etc/my-projects/runtime.env', instances: 1, exec_mode: 'fork', autorestart: true, kill_timeout: 45000, min_uptime: '15s', max_restarts: 10, restart_delay: 5000, time: true, env: { NODE_ENV: 'production', REVISION: revision } };
module.exports = { apps: [
  { ...common, name: 'my-projects-web', script: 'server.js', max_memory_restart: '400M', env: { ...common.env, PORT: '4350', HOSTNAME: '127.0.0.1' } },
  { ...common, name: 'my-projects-worker', script: 'scripts/worker.ts', max_memory_restart: '220M' }
] };
