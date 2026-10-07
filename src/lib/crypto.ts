import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
export function key(): Buffer {
  const value = process.env.ENCRYPTION_KEY || "";
  const b = Buffer.from(
    value,
    /^[0-9a-f]{64}$/i.test(value) ? "hex" : "base64",
  );
  if (b.length !== 32)
    throw new Error("ENCRYPTION_KEY must be 32 random bytes in base64");
  return b;
}
export function encrypt(value: string): string {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return [
    "v1",
    iv.toString("base64"),
    c.update(value, "utf8").toString("base64") + c.final().toString("base64"),
    c.getAuthTag().toString("base64"),
  ].join(".");
}
export function decrypt(value: string): string {
  const [v, iv, data, tag] = value.split(".");
  if (v !== "v1") throw new Error("Invalid encrypted data");
  const c = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  c.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    c.update(Buffer.from(data, "base64")),
    c.final(),
  ]).toString();
}
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, h] = hash.split(":");
  if (!salt || !h) return false;
  const expected = Buffer.from(h, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
