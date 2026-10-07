/** Run with TEST_DATABASE_URL or local .private/database.json and SSH tunnel :15435. Never runs Telegram worker. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
let connection = process.env.TEST_DATABASE_URL;
if (!connection) {
  const config = JSON.parse(readFileSync(".private/database.json", "utf8"));
  const url = new URL(config.MIGRATION_DATABASE_URL);
  url.hostname = "127.0.0.1";
  url.port = process.env.TEST_DB_PORT || "15435";
  connection = url.toString();
}
const result = spawnSync(
  process.execPath,
  ["--test", "tests/integration.test.ts"],
  { stdio: "inherit", env: { ...process.env, TEST_DATABASE_URL: connection } },
);
process.exit(result.status || 0);
