import { pool, init, transaction } from "../src/lib/db.ts";
import { decrypt } from "../src/lib/crypto.ts";
import { createZip } from "../src/lib/backups.ts";
import { probe, shouldNotify } from "../src/lib/monitor.ts";
import { telegram as callTelegram, sendMessage as sendTelegramMessage } from "../src/lib/telegram.ts";
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
let running = true;
const shutdown = new AbortController();
function stop() { running = false; shutdown.abort(); }
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const telegram = (method: string, body: Record<string, unknown> | FormData) => callTelegram(method, body, shutdown.signal);
const sendMessage = (message: string) => sendTelegramMessage(message, shutdown.signal);
async function heartbeat() {
  await pool.query("INSERT INTO runtime VALUES('heartbeat',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [{at: new Date().toISOString(), revision: process.env.REVISION || "development"}]);
}
await init();
const lock = await pool.connect();
if (
  !(await lock.query("SELECT pg_try_advisory_lock(84237522) AS ok")).rows[0].ok
)
  throw new Error("Worker already active");
async function backups() {
  const row = (
    await pool.query(
      "SELECT * FROM backups WHERE status IN ('pending','retry') AND next_at<=now() ORDER BY id LIMIT 1",
    )
  ).rows[0];
  if (!row) return;
  try {
    const zip = await createZip(decrypt(row.snapshot), decrypt(row.password));
    const form = new FormData();
    form.set("chat_id", process.env.TELEGRAM_CHAT_ID || "");
    form.set(
      "caption",
      `Loyihalar zaxirasi #${row.id} · ${new Date(row.created_at).toISOString()}`,
    );
    form.set(
      "document",
      new Blob([new Uint8Array(zip)]),
      `my-projects-${new Date(row.created_at).toISOString().replace(/[:.]/g, "-")}.zip`,
    );
    await telegram("sendDocument", form);
    await pool.query(
      "UPDATE backups SET status='sent',sent_at=now(),error=NULL,snapshot='',password='' WHERE id=$1",
      [row.id],
    );
  } catch (e: any) {
    await pool.query(
      "UPDATE backups SET status='retry',attempts=attempts+1,next_at=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7)))::int),error=$2 WHERE id=$1",
      [row.id, e.message.slice(0, 500)],
    );
  }
}
async function monitors() {
  const rows = (
    await pool.query(
      `SELECT data FROM projects WHERE data->'monitor'->>'enabled'='true'
       AND (data->'monitor'->>'lastCheckedAt' IS NULL OR (data->'monitor'->>'lastCheckedAt')::timestamptz < now()-interval '1 hour')
       ORDER BY data->'monitor'->>'lastCheckedAt' ASC NULLS FIRST LIMIT 1`,
    )
  ).rows;
  for (const { data: p } of rows) {
    if (!running) return;
    const m = p.monitor;
    if (m.lastCheckedAt && Date.now() - Date.parse(m.lastCheckedAt) < 3600000)
      continue;
    let result = await probe(m.url, m.expectedStatus, shutdown.signal);
    if (!running) return;
    if (!result.ok) {
      await pause(2000);
      if (!running) return;
      result = await probe(m.url, m.expectedStatus, shutdown.signal);
    }
    if (!running) return;
    await heartbeat();
    const at = new Date().toISOString(),
      status = result.ok ? "up" : "down";
    await transaction(async (db) => {
      const current = (
        await db.query("SELECT data FROM projects WHERE id=$1", [p.id])
      ).rows[0]?.data;
      if (
        !current ||
        !current.monitor.enabled ||
        current.monitor.url !== m.url ||
        current.monitor.expectedStatus !== m.expectedStatus
      )
        return;
      current.monitor = {
        ...current.monitor,
        status,
        lastCheckedAt: at,
        error: result.error,
      };
      await db.query("UPDATE projects SET data=$2 WHERE id=$1", [
        p.id,
        current,
      ]);
      if (shouldNotify(m.status, status))
        await db.query(
          "INSERT INTO notifications(id,message) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [
            `monitor:${p.id}:${at}`,
            `${status === "down" ? "⚠️ Manzilga ulanishda muammo" : "✅ Ishlash tiklandi"}\n${p.name}\n${m.url}\n${at}${result.error ? "\n" + result.error : ""}`,
          ],
        );
    });
  }
}
async function reminders() {
  const rows = (await pool.query("SELECT data FROM projects")).rows;
  const today = new Date().toISOString().slice(0, 10);
  for (const { data: p } of rows) {
    if (!running) return;
    if (p.status === "archived") continue;
    for (const [field, label] of [
      ["domainExpiresAt", "Domen"],
      ["hostingExpiresAt", "Hosting"],
    ]) {
      const date = p[field];
      if (!date) continue;
      const days = Math.ceil((Date.parse(date) - Date.parse(today)) / 86400000);
      if (![30, 14, 7, 3, 1, 0].includes(days)) continue;
      await pool.query(
        "INSERT INTO notifications(id,message) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [
          `expiry:${p.id}:${field}:${date}:${days}`,
          `⏳ ${p.name}: ${label} muddati ${date}. ${days === 0 ? "Bugun tugaydi!" : days + " kun qoldi."}`,
        ],
      );
    }
  }
}
async function notifications() {
  const rows = (
    await pool.query(
      "SELECT id,message FROM notifications WHERE sent_at IS NULL ORDER BY created_at LIMIT 3",
    )
  ).rows;
  for (const row of rows) {
    if (!running) return;
    await heartbeat();
    await sendMessage(row.message);
    await pool.query("UPDATE notifications SET sent_at=now() WHERE id=$1", [
      row.id,
    ]);
  }
}
async function bot() {
  let offset =
    (await pool.query("SELECT value FROM runtime WHERE key='telegram_offset'"))
      .rows[0]?.value?.offset || 0;
  const updates = await telegram("getUpdates", {
    offset,
    timeout: 0,
    limit: 10,
    allowed_updates: ["message"],
  });
  for (const u of updates) {
    if (!running) return;
    await heartbeat();
    const m = u.message;
    if (
      m &&
      String(m.from?.id) === process.env.TELEGRAM_CHAT_ID &&
      String(m.chat?.id) === process.env.TELEGRAM_CHAT_ID &&
      m.chat?.type === "private"
    ) {
      const term = (m.text || "").trim();
      if (term === "/start" || term === "/help") {
        await sendMessage(
          "Loyihalar platformasi tayyor. Loyiha nomini yuboring — uning havolalarini topaman. /status — fon jarayoni holati. Parollar bot orqali yuborilmaydi.",
        );
      } else if (term === "/status") {
        const count = (await pool.query("SELECT count(*) FROM projects"))
          .rows[0].count;
        await sendMessage(
          `✅ Fon jarayoni ishlayapti. Loyihalar: ${count}\n${process.env.APP_URL}`,
        );
      } else if (term) {
        const rows = (
          await pool.query(
            "SELECT data FROM projects WHERE position(lower($1) in lower(data->>'name'))>0 ORDER BY data->>'name' LIMIT 10",
            [term.slice(0, 200)],
          )
        ).rows;
        await sendMessage(
          rows.length
            ? rows
                .map(
                  ({ data: p }) =>
                    `${p.name}\n${p.links.map((l: any) => `${l.label || l.kind}: ${l.url}`).join("\n") || "Havolalar hali qo‘shilmagan."}`,
                )
                .join("\n\n")
            : "Loyiha topilmadi. Nomi bo‘yicha qidiring.",
        );
      }
    }
    offset = u.update_id + 1;
    await pool.query(
      "INSERT INTO runtime VALUES('telegram_offset',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [{ offset }],
    );
  }
}
let maintenance = 0;
while (running) {
  await heartbeat();
  for (const fn of [backups, bot, notifications, monitors]) {
    if (!running) break;
    await heartbeat();
    try {
      await fn();
    } catch (e: any) {
      console.error(fn.name, e.message);
    }
  }
  if (running && Date.now() - maintenance > 60000) {
    maintenance = Date.now();
    try {
      await reminders();
      await pool.query("DELETE FROM sessions WHERE expires_at<now()");
      await pool.query(
        "DELETE FROM backups WHERE status='sent' AND sent_at<now()-interval '90 days'",
      );
    } catch (e: any) {
      console.error("maintenance", e.message);
    }
  }
  if (running) await pause(3000);
}
lock.release();
await pool.end();
