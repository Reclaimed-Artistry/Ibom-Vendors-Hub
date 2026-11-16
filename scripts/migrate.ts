import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export async function runMigrations(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres";
  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    const { rows } = await client.query<{ filename: string }>(
      `select filename from schema_migrations where filename = $1`,
      [file],
    );
    if (rows.length) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`→ applying ${file}`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(`insert into schema_migrations (filename) values ($1)`, [file]);
      await client.query("commit");
      applied.push(file);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  await client.end();
  return applied;
}

if (process.argv[1]?.includes("migrate.ts") || process.argv[1]?.includes("migrate.js")) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length ? `Applied ${applied.length} migration(s).` : "Database is up to date.");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
