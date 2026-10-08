import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
} from "../src/lib/crypto.ts";
import { createZip, readZip } from "../src/lib/backups.ts";
import { publicAddress, probe, shouldNotify } from "../src/lib/monitor.ts";
import { projectSchema } from "../src/lib/model.ts";
process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
test("authenticated encryption hides values and rejects modifications", () => {
  const c = encrypt("sir-parol");
  assert(!c.includes("sir-parol"));
  assert.equal(decrypt(c), "sir-parol");
  const parts = c.split(".");
  parts[2] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decrypt(parts.join(".")));
});
test("salted scrypt hashes validate only matching password", async () => {
  const a = await hashPassword("my-secret"),
    b = await hashPassword("my-secret");
  assert.notEqual(a, b);
  assert(await verifyPassword("my-secret", a));
  assert(!(await verifyPassword("wrong", a)));
});
test("AES ZIP restores readable JSON with correct fixed password only", async () => {
  const original = {
    format: "my-projects",
    version: 1,
    projects: [{ name: "Sinov", password: "secret" }],
  };
  const zip = await createZip(JSON.stringify(original), "fixed-pass-1234");
  assert(!Buffer.from(zip).includes(Buffer.from("secret")));
  assert.deepEqual(await readZip(zip, "fixed-pass-1234"), original);
  await assert.rejects(() => readZip(zip, "wrong"));
});
test("SSRF blocks internal, special and mapped addresses", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.1.1",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert(publicAddress("8.8.8.8"));
  assert(publicAddress("2606:4700:4700::1111"));
  assert.equal((await probe("http://127.0.0.1", 200)).ok, false);
  assert.equal((await probe("file:///etc/passwd", 200)).ok, false);
});
test("ideas need no links while script links and invalid enums are rejected", () => {
  assert.equal(projectSchema.parse({ id: "", name: "Idea" }).links.length, 0);
  assert.throws(() =>
    projectSchema.parse({ name: "X", links: [{ url: "javascript:alert(1)" }] }),
  );
  assert.throws(() => projectSchema.parse({ name: "X", status: "invalid" }));
});

test("monitor alerts only on new incident or recovery", () => {
  assert(shouldNotify(undefined, "down"));
  assert(shouldNotify("up", "down"));
  assert(!shouldNotify("down", "down"));
  assert(shouldNotify("down", "up"));
  assert(!shouldNotify("up", "up"));
  assert(!shouldNotify(undefined, "up"));
});

test("URL fields reject malformed and credential-bearing links; optional account URLs stay optional", () => {
  for (const url of [
    "",
    "https://",
    "https://example.com bad",
    "https://owner:secret@example.com",
    "javascript:alert(1)",
  ]) {
    assert.throws(
      () => projectSchema.parse({ name: "Test", links: [{ url }] }),
      url,
    );
  }
  assert.equal(
    projectSchema.parse({
      name: "Test",
      links: [{ url: "https://example.com/path?a=1" }],
      accounts: [{ login: "owner", url: "" }],
    }).links.length,
    1,
  );
  assert.throws(() =>
    projectSchema.parse({ name: "Test", monitor: { enabled: true, url: "" } }),
  );
  assert.throws(() =>
    projectSchema.parse({
      name: "Test",
      monitor: { enabled: true, url: "https://" },
    }),
  );
});

test("monitor shutdown cancellation exits without a network request", async () => {
  const controller = new AbortController();
  controller.abort();
  const started = Date.now();
  assert.equal(
    (await probe("https://example.com", 200, controller.signal)).ok,
    false,
  );
  assert(Date.now() - started < 1000);
});

test("restore rejects unencrypted, weak, legacy, multiple-entry and tampered archives", async () => {
  const { ZipWriter, Uint8ArrayWriter, TextReader } =
    await import("@zip.js/zip.js");
  const content = JSON.stringify({
    format: "my-projects",
    version: 1,
    projects: [],
    groups: [],
  });
  for (const options of [
    {},
    { password: "zip-pass", zipCrypto: true },
    { password: "zip-pass", encryptionStrength: 1 as const },
  ]) {
    const writer = new ZipWriter(new Uint8ArrayWriter());
    await writer.add("my-projects.txt", new TextReader(content), {
      ...options,
      useWebWorkers: false,
    });
    const writerData = await writer.close();
    await assert.rejects(() => readZip(writerData, "zip-pass"));
  }
  const writer = new ZipWriter(new Uint8ArrayWriter());
  for (const name of ["my-projects.txt", "unexpected.txt"])
    await writer.add(name, new TextReader(content), {
      password: "zip-pass",
      encryptionStrength: 3,
      useWebWorkers: false,
    });
  const multiple = await writer.close();
  await assert.rejects(() => readZip(multiple, "zip-pass"));
  const zip = new Uint8Array(await createZip(content, "zip-pass"));
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const ciphertextStart =
    30 + view.getUint16(26, true) + view.getUint16(28, true) + 16 + 2;
  zip[ciphertextStart + 2] ^= 1;
  await assert.rejects(() => readZip(zip, "zip-pass"));
});

test("body limits count chunked bytes and reject non-object JSON", async () => {
  const { readJson, LOGIN_BODY_LIMIT } = await import("../src/lib/request.ts");
  const request = (body: string) =>
    new Request("https://vault.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  await assert.rejects(() => readJson(request("[1,2,3]"), LOGIN_BODY_LIMIT), {
    status: 400,
  });
  await assert.rejects(
    () =>
      readJson(
        request(JSON.stringify({ password: "x".repeat(LOGIN_BODY_LIMIT) })),
        LOGIN_BODY_LIMIT,
      ),
    { status: 413 },
  );
  const chunks = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(5000));
      controller.enqueue(new Uint8Array(5000));
      controller.close();
    },
  });
  const streamed = new Request("https://vault.test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: chunks,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(() => readJson(streamed, LOGIN_BODY_LIMIT), {
    status: 413,
  });
});

test("password hashing is asynchronous and bounds concurrent work", async () => {
  let timerRan = false;
  const timer = new Promise<void>((resolve) =>
    setTimeout(() => {
      timerRan = true;
      resolve();
    }, 0),
  );
  const jobs = [hashPassword("parallel-one"), hashPassword("parallel-two")];
  await assert.rejects(() => hashPassword("over-capacity"), { status: 503 });
  await Promise.all(jobs);
  assert(timerRan);
  await timer;
});
