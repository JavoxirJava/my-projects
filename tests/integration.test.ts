import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
test(
  "database API: auth, encrypted accounts, durable snapshots and restore",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = process.env.TEST_DATABASE_URL!;
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    const schema = "test_mp_" + randomBytes(6).toString("hex");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = scoped.toString();
    process.env.DB_POOL_MAX = "1";
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.ADMIN_PASSWORD = "testing-password-123";
    process.env.BACKUP_PASSWORD = "testing-zip-password";
    process.env.ADMIN_LOGIN = "tester";
    process.env.APP_URL = "http://localhost:4350";
    const { POST, GET, PUT } =
      await import("../src/app/api/[...path]/route.ts");
    const { pool } = await import("../src/lib/db.ts");
    const { decrypt } = await import("../src/lib/crypto.ts");
    const { restore } = await import("../src/lib/backups.ts");
    const { transaction } = await import("../src/lib/db.ts");
    let cookie = "";
    async function call(
      method: string,
      path: string,
      body?: unknown,
      origin = true,
    ) {
      const req = new Request("http://localhost:4350/api/" + path, {
        method,
        headers: {
          ...(origin ? { origin: "http://localhost:4350" } : {}),
          "Content-Type": "application/json",
          cookie,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return (method === "GET" ? GET : method === "PUT" ? PUT : POST)(req, {
        params: Promise.resolve({ path: path.split("/") }),
      });
    }
    try {
      assert.equal((await call("GET", "state")).status, 401);
      assert.equal(
        (
          await call(
            "POST",
            "auth/login",
            { login: "tester", password: process.env.ADMIN_PASSWORD },
            false,
          )
        ).status,
        403,
      );
      const signed = await call("POST", "auth/login", {
        login: "tester",
        password: process.env.ADMIN_PASSWORD,
      });
      assert.equal(signed.status, 200);
      cookie = signed.headers.get("set-cookie")!.split(";")[0];
      const group = (
        await (
          await call("POST", "groups", { name: "Sinov", color: "#123456" })
        ).json()
      ).group;
      const created = await call("POST", "projects", {
        name: "Integration idea",
        groupId: group.id,
        accounts: [
          { label: "Admin", password: "clear-secret", login: "owner" },
        ],
      });
      assert.equal(created.status, 200);
      const p = (await created.json()).project;
      assert.equal(p.accounts[0].password, "");
      assert.equal(p.accounts[0].hasPassword, true);
      const row = (
        await pool.query("SELECT data FROM projects WHERE id=$1", [p.id])
      ).rows[0].data;
      assert(!JSON.stringify(row).includes("clear-secret"));
      assert.equal(decrypt(row.accounts[0].password), "clear-secret");
      const reveal = await call(
        "GET",
        `projects/${p.id}/accounts/${p.accounts[0].id}/reveal`,
      );
      assert.equal((await reveal.json()).password, "clear-secret");
      assert.equal(
        (await call("PUT", `projects/${p.id}`, { ...p, name: "Changed" }))
          .status,
        200,
      );
      const latest = (
        await pool.query(
          "SELECT snapshot FROM backups ORDER BY id DESC LIMIT 1",
        )
      ).rows[0];
      const snapshot = JSON.parse(decrypt(latest.snapshot));
      assert.equal(snapshot.projects[0].accounts[0].password, "clear-secret");
      assert.equal(snapshot.projects[0].name, "Changed");
      await transaction((db) => restore(db, snapshot));
      assert.equal(
        (await pool.query("SELECT count(*) FROM projects")).rows[0].count,
        "1",
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM backups")).rows[0].count,
        "5",
      );
      assert.equal((await call("GET", "state")).status, 200);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
