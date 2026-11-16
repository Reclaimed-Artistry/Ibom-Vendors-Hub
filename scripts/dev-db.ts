/**
 * Local PostgreSQL for development.
 *
 * PGlite is a real PostgreSQL (compiled to WASM) served over the PostgreSQL
 * wire protocol, so the application talks to it with the exact same driver and
 * SQL that production uses against Supabase — including RLS, triggers and
 * PL/pgSQL functions.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { runMigrations } from "./migrate";

const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
const port = Number(process.env.PGLITE_PORT ?? 5544);

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create({ dataDir });
  const server = new PGLiteSocketServer({ db, port, host: "0.0.0.0", maxConnections: 20 });
  await server.start();
  console.log(`✅ PostgreSQL (PGlite) listening on 0.0.0.0:${port} — data in ${dataDir}`);

  try {
    const applied = await runMigrations(`postgres://postgres@127.0.0.1:${port}/postgres`);
    console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Schema up to date.");
  } catch (error) {
    console.error("Migration error:", error);
  }

  const shutdown = async () => {
    console.log("\nStopping database…");
    await server.stop().catch(() => {});
    await db.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
