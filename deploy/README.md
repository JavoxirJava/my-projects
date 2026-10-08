# My Projects production

Host: `204.13.232.140`, `https://my-projects.javohir-dev.uz`.
Native Node 24, PM2 fork mode; no builds on the shared VPS.

## Isolation and secrets

- Web OS user `myprojects`, worker `myprojects-worker`, migrator `myprojects-migrator`, CI `myprojects-deploy`.
- Own `my_projects` PostgreSQL DB; `myprojects_app` DML role and `myprojects_migrator` owner. No shared database configuration changes.
- Web `127.0.0.1:4350`, `my-projects.service`, PM2 home `/var/lib/my-projects/pm2`.
- Worker `my-projects-worker.service`, separate PM2 home `/var/lib/my-projects-worker/pm2`.
- Web env `/etc/my-projects/web.env` root:myprojects 0640, without bot token or bootstrap passwords.
- Worker env `/etc/my-projects-worker/runtime.env` root:myprojects-worker 0640, without bootstrap passwords.
- `/etc/my-projects/migrator.env` root-only; systemd loads its DB credentials before dropping UID. Runtime services cannot read it.
- `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `BACKUP_PASSWORD` are first-bootstrap inputs only. Remove them after initialization. Keep `ENCRYPTION_KEY` stable: changing it requires an explicit data re-encryption migration.
- Never place the fixed ZIP password in the same Telegram chat as backups. Keep previous ZIP passwords for previous archives.

## Release and checks

GitHub's `verify` job runs TypeScript, isolated PostgreSQL security tests, Python archive tests, dependency audit, build and packaging. A separate `deploy` job receives only the package. It does not check out or run application code. Production secrets belong to the `production` environment restricted to `master`; action references are pinned to full commit SHAs.

The project-only SSH identity uploads the artifact, then calls:

```
sudo /usr/local/sbin/my-projects-apply-release <40-char-commit> <64-char-package-sha256>
```

The root-owned helper rejects nonregular files and unsafe/duplicate archive paths, bounds compressed and expanded bytes, member counts, memory, CPU and wall time, and preserves disk reserve. Extraction creates ordinary root-owned files in a private staging directory; no archive program or script executes as root. A validated package digest is recorded inside the immutable release. Reusing a revision requires the exact same digest; rebuilding the same commit can produce a different package, so use a new commit when rebuilding rather than rerunning an incompatible artifact.

The helper saves a bounded PostgreSQL recovery dump, invokes migrations as the confined migration UID, atomically switches `/srv/my-projects/current`, restarts only the two My Projects services and checks web revision plus fresh worker heartbeat. Root helpers, units and Nginx configurations are installed only by separate reviewed infrastructure maintenance, never from an incoming release.

Pre-activation failures remove new packages/staging/releases and incomplete dumps. A completed pre-migration dump is retained when a migration fails because it may be needed for recovery. Five recent releases plus current/previous are kept; old dumps beyond the latest fourteen are pruned only after fourteen days. A 10 GiB backup budget stops further deployment rather than silently deleting needed recovery files.

Health failure rolls back only to a previous release containing `SECURITY_VERSION`. Falling back to pre-hardening auth would reopen revoked-session access; if no compatible release exists, the helper stops this project's services and requires recovery. Schema is never silently rolled back. Take and test a separate database restore before any destructive DB recovery.

Local fallback: checks/build, `bash deploy/package.sh <commit>`, SHA256, upload, same helper. `.env*` files are excluded from packages. Never build on VPS.

## Operation

- Web logs: `journalctl -u my-projects`; `/var/lib/my-projects/pm2/logs`.
- Worker logs: `journalctl -u my-projects-worker`; `/var/lib/my-projects-worker/pm2/logs`.
- Health: `curl -fsS http://127.0.0.1:4350/api/health`.
- Own service restart: `systemctl restart my-projects my-projects-worker`.
- Recovery dumps: `/var/backups/my-projects`, root-only. Verify in a separate disposable DB.
- Security event table: fixed event names, timestamp and hashed peer only; 90-day retention. No passwords or tokens. Expired login limiter rows are removed daily after expiration.
- Sessions: seven-day absolute lifetime, thirty-minute idle limit. Dashboard polling does not extend idle time. Password reveal requires authentication within five minutes; the UI can ask for the current password again.
- Restore: AES-256 encrypted single-file ZIP, maximum 20 MiB file and expanded content; current account password and fixed ZIP password required. Preview shows replacement counts.

## Shared VPS boundaries

Preserve SSH/firewall, shared PostgreSQL/Redis, other vhosts/databases, PM2 homes and existing Docker workloads. Nginx updates require `nginx -t` and graceful reload, never shared-service restart. Read parent `SERVER_MIGRATION_PLAN.md` and `test-bot/deploy/vps/AGENT-HANDOFF.md` first. Compare neighboring service PID/start/restart snapshots after maintenance.
