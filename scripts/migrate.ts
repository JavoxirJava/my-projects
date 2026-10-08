export {};
if (process.env.MIGRATION_DATABASE_URL)
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
const { migrate, pool } = await import("../src/lib/db.ts");
await migrate();
if (process.env.APP_DB_ROLE) {
  if (!/^[a-z_][a-z0-9_]*$/.test(process.env.APP_DB_ROLE))
    throw new Error("Invalid role");
  await pool.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${process.env.APP_DB_ROLE}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${process.env.APP_DB_ROLE}`,
  );
}
await pool.end();
console.log("Database ready");
