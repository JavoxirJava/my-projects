# My Projects production

Host: `204.13.232.140`, `https://my-projects.javohir-dev.uz`.
Native Node 24; no Docker and no builds on the shared VPS.

## Isolation

- OS runtime `myprojects`, migration `myprojects-migrator`, CI `myprojects-deploy`.
- Existing PostgreSQL instance: own `my_projects` DB, `myprojects_app` DML role and `myprojects_migrator` owner. Runtime connection cap 12.
- Web `127.0.0.1:4350`; systemd `my-projects.service`; own PM2 home `/var/lib/my-projects/pm2`.
- `/srv/my-projects/releases/<commit>` and atomic `current` symlink.
- Secrets `/etc/my-projects/runtime.env` (root:myprojects 0640); migrator env root-only, systemd loads it before dropping UID. Never commit secrets.
- Own Nginx vhost and TLS certificate with auto-renewal and scoped graceful reload.

## Release

GitHub verifies types/tests and builds, packages standalone web plus worker and production dependencies. Project-specific SSH key uploads then invokes root-owned `/usr/local/sbin/my-projects-apply-release <40-char-sha>`.

Helper validates archive paths/types and revision, extracts as runtime UID, locks code root-owned, creates a PostgreSQL dump, migrates as confined non-root UID, atomically activates and checks health revision. Failure rolls back code, never schema. Incoming provisioning scripts/units/helpers are never installed as root by CI.

Local fallback: run checks/build, `bash deploy/package.sh $(git rev-parse HEAD)`, upload artifact, invoke same helper. Never build on VPS.

Logs: `journalctl -u my-projects` and `/var/lib/my-projects/pm2/logs`.
Health: `curl -fsS http://127.0.0.1:4350/api/health`.
Restart only own app: `systemctl reload my-projects`.
Predeployment dumps: `/var/backups/my-projects` root-only. Test restore into a separate DB before replacing live data.

## Shared VPS boundaries

Never restart shared PostgreSQL/Redis/Nginx or other services. Nginx updates require `nginx -t` and graceful reload. Preserve SSH/firewall, existing vhosts/databases, other PM2 homes and existing Docker workloads. Read parent workspace `SERVER_MIGRATION_PLAN.md` and `test-bot/deploy/vps/AGENT-HANDOFF.md` first.
