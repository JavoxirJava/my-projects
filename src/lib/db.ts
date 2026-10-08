import pg from "pg";
import { hashPassword, encrypt } from "./crypto.ts";
// Keep one pool across Next.js development module reloads.
const globalDatabase = globalThis as typeof globalThis & {
  myProjectsPool?: pg.Pool;
};
function createPool() {
  const instance = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX) || 4,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  instance.on("error", (error) =>
    console.error(
      "Idle database connection error",
      (error as NodeJS.ErrnoException).code || error.name,
    ),
  );
  return instance;
}
export const pool = (globalDatabase.myProjectsPool ??= createPool());
export type DB = Pick<pg.PoolClient, "query">;
let ready: Promise<void> | undefined;
export function init() {
  return (ready ??= (async () => {
    const installed = await pool.query(
      "SELECT to_regclass('app_config') AS name",
    );
    if (installed.rows[0]?.name) return;
    await pool.query(
      `CREATE TABLE IF NOT EXISTS app_config (id int PRIMARY KEY CHECK(id=1), data jsonb NOT NULL); CREATE TABLE IF NOT EXISTS projects(id uuid PRIMARY KEY,data jsonb NOT NULL); CREATE TABLE IF NOT EXISTS groups(id uuid PRIMARY KEY,data jsonb NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id text PRIMARY KEY,expires_at timestamptz NOT NULL); CREATE TABLE IF NOT EXISTS login_limits(id text PRIMARY KEY,attempts int NOT NULL DEFAULT 0,reset_at timestamptz NOT NULL); CREATE TABLE IF NOT EXISTS backups(id bigserial PRIMARY KEY,snapshot text NOT NULL,password text NOT NULL,status text NOT NULL DEFAULT 'pending',attempts int NOT NULL DEFAULT 0,next_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,error text); CREATE TABLE IF NOT EXISTS runtime(key text PRIMARY KEY,value jsonb NOT NULL); CREATE TABLE IF NOT EXISTS notifications(id text PRIMARY KEY,message text NOT NULL,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());`,
    );
    const exists = await pool.query("SELECT id FROM app_config WHERE id=1");
    if (!exists.rowCount) {
      if (!process.env.ADMIN_PASSWORD || !process.env.BACKUP_PASSWORD)
        throw new Error("Bootstrap passwords are required");
      await pool.query(
        "INSERT INTO app_config(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING",
        [
          {
            login: process.env.ADMIN_LOGIN || "admin",
            passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
            backupPassword: encrypt(process.env.BACKUP_PASSWORD),
          },
        ],
      );
    }
  })().catch((error) => {
    ready = undefined;
    throw error;
  }));
}
export async function transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  await init();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(84237521)");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function config(db: DB = pool) {
  return (await db.query("SELECT data FROM app_config WHERE id=1")).rows[0]
    .data;
}

// DDL runs only as the migrator. Web/worker retain their DML-only role.
export async function migrate() {
  await init();
  await transaction(async (db) => {
    await db.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS verified_at timestamptz NOT NULL DEFAULT now();
      CREATE INDEX IF NOT EXISTS login_limits_reset_idx ON login_limits(reset_at);
      CREATE TABLE IF NOT EXISTS security_events(id bigserial PRIMARY KEY, event text NOT NULL, peer_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at);
      UPDATE app_config SET data=jsonb_set(data,'{authVersion}','1') WHERE NOT data ? 'authVersion';
      DELETE FROM sessions WHERE auth_version=0;
    `);
  });
}
