import {
  randomBytes,
  scrypt,
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
let passwordJobs = 0;
async function derivePassword(password: string, salt: string): Promise<Buffer> {
  if (passwordJobs >= 2)
    throw Object.assign(
      new Error("Server band. Birozdan keyin qayta urinib ko‘ring."),
      { status: 503 },
    );
  passwordJobs++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  } finally {
    passwordJobs--;
  }
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derivePassword(password, salt)).toString("hex");
}
export async function verifyPassword(
  password: unknown,
  hash: string,
): Promise<boolean> {
  if (typeof password !== "string" || password.length > 4000) return false;
  const [salt, h] = hash.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(h || ""))
    return false;
  const expected = Buffer.from(h, "hex"),
    actual = await derivePassword(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
