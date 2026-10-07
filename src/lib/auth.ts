import { randomBytes } from "node:crypto";
import { pool, config } from "./db.ts";
import { tokenHash, verifyPassword } from "./crypto.ts";
export const cookieName = "mp_session";
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_URL || req.url).origin;
  if (origin !== expected)
    throw Object.assign(new Error("So‘rov manbasi rad etildi"), {
      status: 403,
    });
}
export async function authenticated(req: Request) {
  const match = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!match) return false;
  return !!(
    await pool.query(
      "SELECT 1 FROM sessions WHERE id=$1 AND expires_at>now()",
      [tokenHash(match)],
    )
  ).rowCount;
}
export async function login(req: Request, body: any) {
  const peer = req.headers.get("x-real-ip") || "global";
  const key = tokenHash(peer);
  await pool.query(
    "INSERT INTO login_limits(id,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<now() THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE login_limits.reset_at END",
    [key],
  );
  const limit = await pool.query(
    "SELECT attempts FROM login_limits WHERE id=$1",
    [key],
  );
  if (limit.rows[0].attempts > 10)
    throw Object.assign(
      new Error("Ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring."),
      { status: 429 },
    );
  const cfg = await config();
  if (
    typeof body.login !== "string" ||
    typeof body.password !== "string" ||
    body.password.length > 4000 ||
    body.login !== cfg.login ||
    !verifyPassword(body.password, cfg.passwordHash)
  )
    throw Object.assign(new Error("Login yoki parol noto‘g‘ri"), {
      status: 401,
    });
  const token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions VALUES($1,now()+interval '7 days')", [
    tokenHash(token),
  ]);
  await pool.query("DELETE FROM login_limits WHERE id=$1", [key]);
  return token;
}
export function sessionCookie(token: string, clear = false) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 604800}${process.env.APP_URL?.startsWith("https:") ? "; Secure" : ""}`;
}
export async function logout(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (token)
    await pool.query("DELETE FROM sessions WHERE id=$1", [tokenHash(token)]);
}
