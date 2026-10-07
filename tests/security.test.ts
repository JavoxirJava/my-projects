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
test("salted scrypt hashes validate only matching password", () => {
  const a = hashPassword("my-secret"),
    b = hashPassword("my-secret");
  assert.notEqual(a, b);
  assert(verifyPassword("my-secret", a));
  assert(!verifyPassword("wrong", a));
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

test('URL fields reject malformed and credential-bearing links; optional account URLs stay optional', () => {
  for (const url of ['', 'https://', 'https://example.com bad', 'https://owner:secret@example.com', 'javascript:alert(1)']) {
    assert.throws(() => projectSchema.parse({name: 'Test', links: [{url}]}), url);
  }
  assert.equal(projectSchema.parse({name: 'Test', links: [{url: 'https://example.com/path?a=1'}], accounts: [{login: 'owner', url: ''}]}).links.length, 1);
  assert.throws(() => projectSchema.parse({name: 'Test', monitor: {enabled: true, url: ''}}));
  assert.throws(() => projectSchema.parse({name: 'Test', monitor: {enabled: true, url: 'https://'}}));
});

test('monitor shutdown cancellation exits without a network request', async () => {
  const controller = new AbortController();
  controller.abort();
  const started = Date.now();
  assert.equal((await probe('https://example.com', 200, controller.signal)).ok, false);
  assert(Date.now() - started < 1000);
});
