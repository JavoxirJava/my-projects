import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";

test(
  "session rotation, admission limits and restore preserve security boundaries",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const admin = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await admin.connect();
    const schema = "test_security_" + randomBytes(6).toString("hex");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    process.env.DB_POOL_MAX = "4";
    process.env.APP_URL = "https://vault.test";
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.ADMIN_LOGIN = "tester";
    process.env.ADMIN_PASSWORD = "original-password-123";
    process.env.BACKUP_PASSWORD = "fixed-backup-password";
    const { pool, migrate, config } = await import("../src/lib/db.ts");
    const {
      issueSession,
      sessionCookie,
      authenticated,
      sessionId,
      cookieName,
      rateLimit,
    } = await import("../src/lib/auth.ts");
    const { hashPassword, verifyPassword, tokenHash } =
      await import("../src/lib/crypto.ts");
    const { POST, PUT, GET } =
      await import("../src/app/api/[...path]/route.ts");
    const { createZip } = await import("../src/lib/backups.ts");
    const { ZipWriter, Uint8ArrayWriter, TextReader } =
      await import("@zip.js/zip.js");
    let cookie = "",
      peer = "198.51.100.1";
    const request = (path: string, method = "GET", body?: BodyInit) =>
      new Request("https://vault.test/api/" + path, {
        method,
        headers: {
          origin: "https://vault.test",
          cookie,
          "x-real-ip": peer,
          ...(body instanceof FormData
            ? {}
            : { "content-type": "application/json" }),
        },
        body,
      });
    const call = (path: string, method = "GET", body?: BodyInit) =>
      (method === "GET" ? GET : method === "PUT" ? PUT : POST)(
        request(path, method, body),
        { params: Promise.resolve({ path: path.split("/") }) },
      );
    try {
      await migrate();
      await migrate(); // repeat migrations must not revoke newly valid sessions
      const old = await config();
      assert(
        await verifyPassword(process.env.ADMIN_PASSWORD, old.passwordHash),
      );
      const oldToken = await issueSession(request("auth/login"), old);
      cookie = sessionCookie(oldToken).split(";")[0];
      assert.equal(cookieName, "__Host-mp_session");
      assert.match(sessionCookie(oldToken), /; Secure$/);
      assert(!sessionCookie(oldToken).includes("Domain="));
      assert.equal((await call("state")).status, 200);
      const dup = new Request("https://vault.test/api/state", {
        headers: { cookie: cookie + "; " + cookie },
      });
      assert.equal(sessionId(dup), null);
      assert.equal(await authenticated(dup), false);

      // Hold the real password-rotation transaction while the old verified login is queued.
      const rotation = await pool.connect();
      const newHash = await hashPassword("changed-password-123");
      await rotation.query("BEGIN");
      await rotation.query("SELECT pg_advisory_xact_lock(84237521)");
      await rotation.query("UPDATE app_config SET data=$1 WHERE id=1", [
        { ...old, passwordHash: newHash, authVersion: old.authVersion + 1 },
      ]);
      await rotation.query("DELETE FROM sessions");
      const staleLogin = issueSession(request("auth/login"), old);
      const rejected = assert.rejects(staleLogin, { status: 401 });
      await rotation.query("COMMIT");
      rotation.release();
      await rejected;
      assert.equal((await call("state")).status, 401);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM sessions"))
          .rows[0].count,
        0,
      );
      const signed = await call(
        "auth/login",
        "POST",
        JSON.stringify({ login: "tester", password: "changed-password-123" }),
      );
      assert.equal(signed.status, 200);
      assert.equal(signed.headers.getSetCookie().length, 2);
      cookie = signed.headers.getSetCookie()[0].split(";")[0];
      await migrate();
      assert.equal((await call("state")).status, 200);

      // Even an IP already throttled cannot make a declared oversized body get consumed.
      const ipReq = request("auth/login", "POST", "{}");
      for (let i = 0; i < 10; i++) {
        try {
          await rateLimit(ipReq, "login.ip", 10, 900);
        } catch {}
      }
      let reads = 0;
      const stream = new ReadableStream(
        {
          pull(controller) {
            reads++;
            controller.enqueue(new Uint8Array(9000));
            controller.close();
          },
        },
        { highWaterMark: 0 },
      );
      const huge = new Request("https://vault.test/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://vault.test",
          "content-length": "9000",
          "content-type": "application/json",
          "x-real-ip": peer,
        },
        body: stream,
        duplex: "half",
      } as RequestInit);
      const oversized = await POST(huge, {
        params: Promise.resolve({ path: ["auth", "login"] }),
      });
      assert.equal(oversized.status, 413);
      assert.equal(reads, 0);
      peer = "198.51.100.2";
      const chunked = await call(
        "auth/login",
        "POST",
        JSON.stringify({ password: "x".repeat(9000) }),
      );
      assert.equal(chunked.status, 413);

      const snapshot = JSON.stringify({
        format: "my-projects",
        version: 1,
        projects: [{ name: "Restored" }],
        groups: [],
      });
      const plainWriter = new ZipWriter(new Uint8ArrayWriter());
      await plainWriter.add("my-projects.txt", new TextReader(snapshot), {
        useWebWorkers: false,
      });
      const plain = await plainWriter.close();
      const form = (
        bytes: Uint8Array,
        currentPassword = "changed-password-123",
      ) => {
        const data = new FormData();
        data.set("file", new Blob([new Uint8Array(bytes)]), "backup.zip");
        data.set("password", "fixed-backup-password");
        data.set("currentPassword", currentPassword);
        return data;
      };
      assert.equal((await call("restore", "POST", form(plain))).status, 400);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM projects"))
          .rows[0].count,
        0,
      );
      const encrypted = await createZip(snapshot, "fixed-backup-password");
      assert.equal(
        (await call("restore", "POST", form(encrypted, "wrong"))).status,
        403,
      );
      const preview = await call("restore/preview", "POST", form(encrypted));
      assert.equal(preview.status, 200);
      assert.equal((await preview.json()).projects, 1);
      assert.equal(
        (await call("restore", "POST", form(encrypted))).status,
        200,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM projects"))
          .rows[0].count,
        1,
      );

      // Recent-auth expiry protects reveal independently of session expiry.
      await pool.query(
        "UPDATE login_limits SET reset_at=now()-interval '1 second'",
      );
      const created = await call(
        "projects",
        "POST",
        JSON.stringify({
          name: "Protected",
          accounts: [{ label: "Owner", password: "vault-value" }],
        }),
      );
      const project = (await created.json()).project;
      const revealPath = `projects/${project.id}/accounts/${project.accounts[0].id}/reveal`;
      await pool.query(
        "UPDATE sessions SET verified_at=now()-interval '6 minutes'",
      );
      assert.equal((await call(revealPath)).status, 428);
      assert.equal(
        (
          await call(
            "auth/verify",
            "POST",
            JSON.stringify({ password: "changed-password-123" }),
          )
        ).status,
        200,
      );
      assert.equal(
        (await (await call(revealPath)).json()).password,
        "vault-value",
      );
      const changed = await call(
        "settings",
        "PUT",
        JSON.stringify({
          currentPassword: "changed-password-123",
          password: "final-password-123",
        }),
      );
      assert.equal(changed.status, 200);
      assert.equal((await call("state")).status, 401);
      await pool.query(
        "UPDATE login_limits SET reset_at=now()-interval '1 second'",
      );
      const finalLogin = await call(
        "auth/login",
        "POST",
        JSON.stringify({ login: "tester", password: "final-password-123" }),
      );
      assert.equal(finalLogin.status, 200);
      cookie = finalLogin.headers.getSetCookie()[0].split(";")[0];
      const currentVersion = (await config()).authVersion;
      const currentId = tokenHash(cookie.split("=")[1]);
      await pool.query("UPDATE sessions SET auth_version=$1 WHERE id=$2", [
        currentVersion - 1,
        currentId,
      ]);
      assert.equal((await call("state")).status, 401);
      await pool.query("UPDATE sessions SET auth_version=$1 WHERE id=$2", [
        currentVersion,
        currentId,
      ]);

      // Dashboard polling never revives or extends an idle session.
      await pool.query(
        "UPDATE sessions SET last_seen_at=now()-interval '10 minutes'",
      );
      const before = (await pool.query("SELECT last_seen_at FROM sessions"))
        .rows[0].last_seen_at;
      assert.equal((await call("state")).status, 200);
      assert.equal(
        (
          await pool.query("SELECT last_seen_at FROM sessions")
        ).rows[0].last_seen_at.getTime(),
        before.getTime(),
      );
      await pool.query(
        "UPDATE sessions SET last_seen_at=now()-interval '31 minutes'",
      );
      assert.equal((await call("state")).status, 401);
      const eventRows = (
        await pool.query("SELECT event,peer_hash FROM security_events")
      ).rows;
      assert(eventRows.some((row) => row.event === "backup.restored"));
      assert(!JSON.stringify(eventRows).includes("changed-password"));
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
