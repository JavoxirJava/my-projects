import { randomBytes } from "node:crypto";
import { pool, config, transaction, type DB } from "./db.ts";
import { tokenHash, verifyPassword } from "./crypto.ts";
import {
  checkBodyLength,
  httpError,
  LOGIN_BODY_LIMIT,
  readJson,
} from "./request.ts";

export const cookieName = process.env.APP_URL?.startsWith("https:")
  ? "__Host-mp_session"
  : "mp_session";
export function sameOrigin(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.APP_URL || req.url).origin
  )
    throw httpError("So‘rov manbasi rad etildi", 403);
}
export function sessionId(req: Request) {
  const values = (req.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(cookieName + "="));
  if (values.length !== 1) return null;
  const token = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? tokenHash(token) : null;
}
export async function authenticated(
  req: Request,
  db: DB = pool,
  recent = false,
) {
  const id = sessionId(req);
  if (!id) return false;
  // Automatic dashboard polling must not extend an otherwise idle session.
  const polling = new URL(req.url).pathname === "/api/state";
  return !!(
    await db.query(
      `${polling ? "SELECT id FROM sessions" : "UPDATE sessions SET last_seen_at=now()"}
    WHERE id=$1 AND expires_at>now() AND last_seen_at>now()-interval '30 minutes'
    AND auth_version=(SELECT (data->>'authVersion')::int FROM app_config WHERE id=1)
    AND (NOT $2::boolean OR verified_at>now()-interval '5 minutes') ${polling ? "" : "RETURNING id"}`,
      [id, recent],
    )
  ).rowCount;
}
export async function authorizedTransaction<T>(
  req: Request,
  fn: (db: DB) => Promise<T>,
) {
  return transaction(async (db) => {
    if (!(await authenticated(req, db))) throw httpError("Qayta kiring", 401);
    return fn(db);
  });
}
export async function securityEvent(
  event: string,
  req: Request,
  db: DB = pool,
) {
  // Fixed event names only. Never store passwords, URLs, cookies, or request bodies.
  await db.query("INSERT INTO security_events(event,peer_hash) VALUES($1,$2)", [
    event,
    tokenHash(req.headers.get("x-real-ip") || "unknown"),
  ]);
}
export async function rateLimit(
  req: Request,
  scope: string,
  maximum: number,
  seconds: number,
  account = false,
) {
  const id = tokenHash(
    scope +
      ":" +
      (account ? "owner" : req.headers.get("x-real-ip") || "unknown"),
  );
  const result = await pool.query(
    `INSERT INTO login_limits(id,attempts,reset_at)
    VALUES($1,1,now()+make_interval(secs=>$2)) ON CONFLICT(id) DO UPDATE SET
    attempts=CASE WHEN login_limits.reset_at<=now() THEN 1 ELSE login_limits.attempts+1 END,
    reset_at=CASE WHEN login_limits.reset_at<=now() THEN now()+make_interval(secs=>$2) ELSE login_limits.reset_at END
    RETURNING attempts`,
    [id, seconds],
  );
  if (result.rows[0].attempts > maximum)
    throw httpError("Ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.", 429);
}
export async function issueSession(
  req: Request,
  verified: { passwordHash: string; authVersion: number },
) {
  // Re-read after taking the same lock as password rotation: hashing may have overlapped it.
  return transaction(async (db) => {
    const current = await config(db);
    if (
      current.authVersion !== verified.authVersion ||
      current.passwordHash !== verified.passwordHash
    )
      throw httpError("Kirish ma’lumotlari o‘zgardi. Qayta kiring.", 401);
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions(id,expires_at,auth_version) VALUES($1,now()+interval '7 days',$2)",
      [tokenHash(token), current.authVersion],
    );
    await securityEvent("login.success", req, db);
    return token;
  });
}
export async function login(req: Request) {
  checkBodyLength(req, LOGIN_BODY_LIMIT);
  await rateLimit(req, "login.ip", 10, 900);
  // A short account-wide window bounds distributed load without a long account lockout.
  await rateLimit(req, "login.account", 4, 1, true);
  const body = await readJson(req, LOGIN_BODY_LIMIT);
  const cfg = await config();
  if (
    typeof body.login !== "string" ||
    body.login.length > 100 ||
    body.login !== cfg.login ||
    !(await verifyPassword(body.password, cfg.passwordHash))
  ) {
    await securityEvent("login.failed", req);
    throw httpError("Login yoki parol noto‘g‘ri", 401);
  }
  return issueSession(req, cfg);
}
export async function verifyCurrentPassword(req: Request, password: unknown) {
  await rateLimit(req, "reauth.ip", 8, 900);
  await rateLimit(req, "reauth.account", 4, 1, true);
  const cfg = await config();
  if (!(await verifyPassword(password, cfg.passwordHash))) {
    await securityEvent("reauth.failed", req);
    throw httpError("Joriy parol noto‘g‘ri", 403);
  }
  return cfg;
}
export async function requireRecentAuth(req: Request, db: DB = pool) {
  if (!(await authenticated(req, db, true)))
    throw httpError("Parolni qayta tasdiqlang", 428);
}
export function sessionCookie(token: string, clear = false) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 604800}${process.env.APP_URL?.startsWith("https:") ? "; Secure" : ""}`;
}
export function legacyCookie() {
  return "mp_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
export async function logout(req: Request) {
  const id = sessionId(req);
  if (id) await pool.query("DELETE FROM sessions WHERE id=$1", [id]);
  await securityEvent("logout", req);
}
