import { randomUUID } from "node:crypto";
import { pool, init, transaction, config } from "../../../lib/db.ts";
import {
  encrypt,
  decrypt,
  verifyPassword,
  hashPassword,
} from "../../../lib/crypto.ts";
import {
  authenticated,
  sameOrigin,
  login,
  logout,
  sessionCookie,
} from "../../../lib/auth.ts";
import { projectSchema, groupSchema } from "../../../lib/model.ts";
import {
  queueBackup,
  maskProject,
  readZip,
  restore,
} from "../../../lib/backups.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
async function handle(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const route = path.join("/"),
      method = req.method;
    await init();
    if (route === "health" && method === "GET") {
      await pool.query("SELECT 1");
      return json({
        ok: true,
        revision: process.env.REVISION || "development",
      });
    }
    if (method !== "GET") sameOrigin(req);
    if (route === "auth/login" && method === "POST") {
      const token = await login(req, await req.json());
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
    }
    if (!(await authenticated(req)))
      return json({ error: "Kirish talab qilinadi" }, 401);
    if (route === "auth/logout" && method === "POST") {
      await logout(req);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", true) });
    }
    if (route === "state" && method === "GET") {
      const [projects, groups, cfg, backups, worker] = await Promise.all([
        pool.query(
          "SELECT data FROM projects ORDER BY data->>'updatedAt' DESC",
        ),
        pool.query("SELECT data FROM groups ORDER BY data->>'name'"),
        config(),
        pool.query(
          'SELECT id,status,created_at AS "createdAt",sent_at AS "sentAt",error FROM backups ORDER BY id DESC LIMIT 30',
        ),
        pool.query("SELECT value FROM runtime WHERE key='heartbeat'"),
      ]);
      return json({
        projects: projects.rows.map((r) => maskProject(r.data)),
        groups: groups.rows.map((r) => r.data),
        settings: {
          login: cfg.login,
          zipPasswordConfigured: !!cfg.backupPassword,
          telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
          telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
        },
        backups: backups.rows,
        worker: { lastHeartbeatAt: worker.rows[0]?.value?.at || null },
        user: { login: cfg.login },
      });
    }
    if (
      path[0] === "projects" &&
      path[2] === "accounts" &&
      path[4] === "reveal" &&
      method === "GET"
    ) {
      const p = (
        await pool.query("SELECT data FROM projects WHERE id=$1", [path[1]])
      ).rows[0]?.data;
      const a = p?.accounts.find((a: any) => a.id === path[3]);
      if (!a) return json({ error: "Hisob topilmadi" }, 404);
      return json({ password: a.password ? decrypt(a.password) : "" });
    }
    if (
      path[0] === "projects" &&
      ((path.length === 1 && method === "POST") ||
        (path.length === 2 && method === "PUT"))
    ) {
      const input = projectSchema.parse(await req.json());
      if (input.monitor.enabled && !input.monitor.url)
        return json({ error: "Monitoring manzilini kiriting" }, 400);
      const project = await transaction(async (db) => {
        const old = path[1]
          ? (await db.query("SELECT data FROM projects WHERE id=$1", [path[1]]))
              .rows[0]?.data
          : null;
        if (path[1] && !old)
          throw Object.assign(new Error("Loyiha topilmadi"), { status: 404 });
        if (
          input.groupId &&
          !(
            await db.query("SELECT id FROM groups WHERE id=$1", [input.groupId])
          ).rowCount
        )
          throw new Error("Guruh topilmadi");
        const now = new Date().toISOString();
        const data = {
          ...input,
          id: old?.id || randomUUID(),
          createdAt: old?.createdAt || now,
          updatedAt: now,
          links: input.links.map((a) => ({ ...a, id: a.id || randomUUID() })),
          tasks: input.tasks.map((a) => ({ ...a, id: a.id || randomUUID() })),
          accounts: input.accounts.map((a) => ({
            ...a,
            id: a.id || randomUUID(),
            password: a.password
              ? encrypt(a.password)
              : old?.accounts.find((o: any) => o.id === a.id)?.password || "",
          })),
          monitor: {
            ...input.monitor,
            ...(old &&
            old.monitor.url === input.monitor.url &&
            old.monitor.enabled === input.monitor.enabled &&
            old.monitor.expectedStatus === input.monitor.expectedStatus
              ? {
                  status: old.monitor.status,
                  lastCheckedAt: old.monitor.lastCheckedAt,
                  error: old.monitor.error,
                }
              : { status: "unknown" }),
          },
        };
        await db.query(
          "INSERT INTO projects(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
          [data.id, data],
        );
        await queueBackup(db);
        return maskProject(data);
      });
      return json({ project });
    }
    if (path[0] === "projects" && path.length === 2 && method === "DELETE") {
      await transaction(async (db) => {
        await db.query("DELETE FROM projects WHERE id=$1", [path[1]]);
        await queueBackup(db);
      });
      return json({ ok: true });
    }
    if (path[0] === "groups" && ["POST", "PUT", "DELETE"].includes(method)) {
      const input =
        method === "DELETE" ? null : groupSchema.parse(await req.json());
      let group: any;
      await transaction(async (db) => {
        if (method === "DELETE") {
          await db.query("DELETE FROM groups WHERE id=$1", [path[1]]);
          await db.query(
            "UPDATE projects SET data=jsonb_set(data,'{groupId}','null') WHERE data->>'groupId'=$1",
            [path[1]],
          );
        } else {
          group = { ...input, id: method === "PUT" ? path[1] : randomUUID() };
          await db.query(
            "INSERT INTO groups VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
            [group.id, group],
          );
        }
        await queueBackup(db);
      });
      return json({ ok: true, group });
    }
    if (route === "settings" && method === "PUT") {
      const body = await req.json();
      await transaction(async (db) => {
        const cfg = await config(db);
        if (
          (body.login || body.password || body.backupPassword) &&
          !verifyPassword(body.currentPassword || "", cfg.passwordHash)
        )
          throw Object.assign(new Error("Joriy parol noto‘g‘ri"), {
            status: 400,
          });
        if (body.login) {
          if (typeof body.login !== "string" || body.login.length > 100)
            throw new Error("Login noto‘g‘ri");
          cfg.login = body.login.trim();
        }
        if (body.password) {
          if (
            typeof body.password !== "string" ||
            body.password.length < 12 ||
            body.password.length > 1000
          )
            throw new Error("Yangi parol kamida 12 belgidan iborat bo‘lsin");
          cfg.passwordHash = hashPassword(body.password);
          await db.query("DELETE FROM sessions");
        }
        if (body.backupPassword) {
          if (
            typeof body.backupPassword !== "string" ||
            body.backupPassword.length < 12 ||
            body.backupPassword.length > 1000
          )
            throw new Error("ZIP paroli kamida 12 belgidan iborat bo‘lsin");
          cfg.backupPassword = encrypt(body.backupPassword);
        }
        await db.query("UPDATE app_config SET data=$1 WHERE id=1", [cfg]);
        await queueBackup(db);
      });
      return json({ ok: true, relogin: !!body.password });
    }
    if (route === "backups" && method === "POST") {
      await transaction(queueBackup);
      return json({ ok: true });
    }
    if (route === "restore" && method === "POST") {
      const form = await req.formData();
      const file = form.get("file"),
        password = form.get("password");
      if (
        !(file instanceof File) ||
        file.size > 20 * 1024 * 1024 ||
        typeof password !== "string"
      )
        return json(
          { error: "ZIP fayl va parol talab qilinadi (20 MB gacha)" },
          400,
        );
      const snapshot = await readZip(
        new Uint8Array(await file.arrayBuffer()),
        password,
      );
      await transaction((db) => restore(db, snapshot));
      return json({ ok: true });
    }
    return json({ error: "Topilmadi" }, 404);
  } catch (e: any) {
    if (e?.name === "ZodError")
      return json(
        {
          error:
            "Maydonlarni tekshiring: " +
            e.issues
              .map((i: any) => i.path.join(".") + " " + i.message)
              .join("; "),
        },
        400,
      );
    const status = e.status || (e.code ? 503 : 400);
    // PostgreSQL errors may contain SQL and user values; never expose or log their message.
    console.error("API error", e.name, e.code || "", "status", status);
    return json(
      {
        error:
          status >= 500 ? "Server bilan ulanishda xato. Qayta urinib ko‘ring." : e instanceof SyntaxError ? "So‘rov formati noto‘g‘ri" : e.message || "So‘rov bajarilmadi",
      },
      status,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
