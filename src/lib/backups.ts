import {
  ZipWriter,
  ZipReader,
  Uint8ArrayWriter,
  Uint8ArrayReader,
  TextReader,
  TextWriter,
  type Entry,
} from "@zip.js/zip.js";
import { randomUUID } from "node:crypto";
import { config, type DB } from "./db.ts";
import { encrypt, decrypt } from "./crypto.ts";
import { projectSchema, groupSchema, type Project } from "./model.ts";
export async function queueBackup(db: DB) {
  const pending = (
    await db.query(
      "SELECT count(*)::int AS count,coalesce(sum(octet_length(snapshot)),0)::bigint AS bytes FROM backups WHERE status IN ('pending','retry')",
    )
  ).rows[0];
  if (pending.count >= 1000 || Number(pending.bytes) >= 256 * 1024 * 1024)
    throw new Error(
      "Zaxira navbati to‘lgan. Telegram yuborishini tekshiring va qayta urinib ko‘ring.",
    );
  const cfg = await config(db);
  const snapshot = {
    format: "my-projects",
    version: 1,
    createdAt: new Date().toISOString(),
    projects: (
      await db.query("SELECT data FROM projects ORDER BY id")
    ).rows.map((r) => ({
      ...r.data,
      accounts: r.data.accounts.map((a: any) => ({
        ...a,
        password: a.password ? decrypt(a.password) : "",
      })),
    })),
    groups: (await db.query("SELECT data FROM groups ORDER BY id")).rows.map(
      (r) => r.data,
    ),
    settings: { login: cfg.login },
  };
  const text = JSON.stringify(snapshot, null, 2);
  if (Buffer.byteLength(text) > 20 * 1024 * 1024)
    throw new Error(
      "Zaxira hajmi 20 MB chegaradan oshdi. Ma’lumot saqlanmadi.",
    );
  await db.query("INSERT INTO backups(snapshot,password) VALUES($1,$2)", [
    encrypt(text),
    cfg.backupPassword,
  ]);
}
export async function createZip(snapshot: string, password: string) {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("my-projects.txt", new TextReader(snapshot), {
    password,
    encryptionStrength: 3,
    useWebWorkers: false,
  });
  return writer.close();
}
export async function readZip(bytes: Uint8Array, password: string) {
  if (
    bytes.byteLength > 20 * 1024 * 1024 ||
    password.length < 1 ||
    password.length > 1000
  )
    throw new Error("Zaxira hajmi yoki paroli noto‘g‘ri");
  const reader = new ZipReader(new Uint8ArrayReader(bytes));
  try {
    const entries: Entry[] = [];
    for await (const entry of reader.getEntriesGenerator()) {
      entries.push(entry);
      if (entries.length > 1)
        throw new Error("Zaxirada faqat bitta fayl bo‘lishi kerak");
    }
    if (
      entries.length !== 1 ||
      entries[0].filename !== "my-projects.txt" ||
      entries[0].uncompressedSize > 20 * 1024 * 1024
    )
      throw new Error("Noto‘g‘ri zaxira fayli");
    const entry = entries[0];
    if (
      entry.directory ||
      !entry.getData ||
      !entry.encrypted ||
      entry.zipCrypto ||
      entry.extraFieldAES?.strength !== 3
    )
      throw new Error("Faqat AES-256 parolli ZIP zaxira qabul qilinadi");
    return JSON.parse(
      await entry.getData(new TextWriter(), {
        password,
        useWebWorkers: false,
        checkAuthenticationCode: true,
        checkCrc32: true,
        signal: AbortSignal.timeout(15000),
        onprogress(size) {
          if (size > 20 * 1024 * 1024) throw new Error("Zaxira hajmi katta");
        },
      }),
    );
  } finally {
    await reader.close();
  }
}
export function validateSnapshot(value: any) {
  if (
    value?.format !== "my-projects" ||
    value.version !== 1 ||
    !Array.isArray(value.projects) ||
    !Array.isArray(value.groups) ||
    value.projects.length > 10000 ||
    value.groups.length > 1000
  )
    throw new Error("Zaxira formati qo‘llab-quvvatlanmaydi");
  for (const group of value.groups) groupSchema.parse(group);
  for (const project of value.projects) projectSchema.parse(project);
}
export async function restore(db: DB, value: any) {
  validateSnapshot(value);
  const groups = value.groups.map((g: any) => ({
    id:
      typeof g.id === "string" && /^[0-9a-f-]{36}$/i.test(g.id)
        ? g.id
        : randomUUID(),
    ...groupSchema.parse(g),
  }));
  const groupIds = new Set(groups.map((g: any) => g.id));
  const projects = value.projects.map((p: any) => {
    const clean = projectSchema.parse(p);
    return {
      ...clean,
      id: clean.id || randomUUID(),
      groupId: groupIds.has(clean.groupId) ? clean.groupId : null,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accounts: clean.accounts.map((a) => ({
        ...a,
        id: a.id || randomUUID(),
        password: a.password ? encrypt(a.password) : "",
      })),
      links: clean.links.map((a) => ({ ...a, id: a.id || randomUUID() })),
      tasks: clean.tasks.map((a) => ({ ...a, id: a.id || randomUUID() })),
    };
  });
  await queueBackup(db);
  await db.query("DELETE FROM projects");
  await db.query("DELETE FROM groups");
  for (const g of groups)
    await db.query("INSERT INTO groups VALUES($1,$2)", [g.id, g]);
  for (const p of projects)
    await db.query("INSERT INTO projects VALUES($1,$2)", [p.id, p]);
  await queueBackup(db);
}
export function maskProject(p: Project) {
  return {
    ...p,
    accounts: p.accounts.map((a) => ({
      ...a,
      password: "",
      hasPassword: !!a.password,
    })),
  };
}
