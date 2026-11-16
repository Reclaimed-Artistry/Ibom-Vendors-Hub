import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Database access.
 *
 * Every request uses one of two connection modes:
 *
 *  - withActor(...)  – runs inside a transaction as the non-privileged
 *    `app_runtime` role with `app.user_id` / `app.user_role` session settings,
 *    so PostgreSQL Row Level Security is genuinely enforced (not simulated in
 *    the application layer).
 *
 *  - withSystem(...) – the owning/superuser connection used by trusted server
 *    code only: authentication lookups, payment webhooks, cron jobs, seeding.
 *
 * The same code path works against Supabase Postgres or the embedded PGlite
 * server used for local development.
 */

types.setTypeParser(1700, (v) => Number(v)); // numeric
types.setTypeParser(20, (v) => Number(v)); // bigint
types.setTypeParser(1082, (v) => v); // date stays YYYY-MM-DD

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres";
const useSsl = process.env.DATABASE_SSL === "true";

declare global {
  // eslint-disable-next-line no-var
  var __ivhPool: Pool | undefined;
}

/**
 * The embedded PostgreSQL used for local development (PGlite) serves a single
 * database session behind its socket multiplexer, meaning session-level state
 * such as `SET ROLE` is shared. In that mode we (a) use a single pooled
 * connection and (b) serialise every transaction, and allow nested trusted
 * queries to reuse the open transaction with an explicit role switch. Against
 * real PostgreSQL/Supabase none of this applies — each request gets its own
 * connection and RLS state.
 */
const SERIALISED =
  process.env.DB_SERIALIZE === "true" || /:(5544|5433)\b/.test(connectionString);

interface TxContext {
  client: PoolClient;
  role: "actor" | "system";
}

const txStore = new AsyncLocalStorage<TxContext>();

let mutexTail: Promise<unknown> = Promise.resolve();
function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (!SERIALISED) return fn();
  const run = mutexTail.then(fn, fn);
  mutexTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const pool =
  globalThis.__ivhPool ??
  new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? (SERIALISED ? 1 : 8)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
globalThis.__ivhPool = pool;

export type Role = "super_admin" | "admin" | "vendor" | "customer" | "anon";

export interface Actor {
  id: string | null;
  role: Role;
  email: string | null;
}

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T>;
  maybeOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null>;
  execute(text: string, params?: unknown[]): Promise<number>;
}

function makeDb(run: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number | null }>): Db {
  return {
    async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const res = await run(text, params);
      return res.rows as T[];
    },
    async one<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const res = await run(text, params);
      const row = res.rows[0];
      if (!row) throw new Error("Expected one row but found none");
      return row as T;
    },
    async maybeOne<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const res = await run(text, params);
      const row = res.rows[0];
      if (!row) return null;
      return row as T;
    },
    async execute(text: string, params?: unknown[]) {
      const res = await run(text, params);
      return res.rowCount ?? 0;
    },
  };
}

function clientRunner(client: PoolClient) {
  return (text: string, params?: unknown[]) =>
    client.query(text, params as any[] | undefined) as unknown as Promise<{
      rows: QueryResultRow[];
      rowCount: number | null;
    }>;
}

type RawResult = { rows: QueryResultRow[]; rowCount: number | null };

async function runSystem(text: string, params?: unknown[]): Promise<RawResult> {
  const ctx = txStore.getStore();
  if (ctx) {
    if (ctx.role === "system") {
      const res = await ctx.client.query(text, params as any[]);
      return { rows: res.rows, rowCount: res.rowCount };
    }
    // Nested trusted query inside an actor transaction: temporarily drop the
    // restricted role, run, then restore it (only used in serialised mode).
    await ctx.client.query("savepoint ivh_nested");
    await ctx.client.query("reset role");
    try {
      const res = await ctx.client.query(text, params as any[]);
      await ctx.client.query("release savepoint ivh_nested");
      return { rows: res.rows, rowCount: res.rowCount };
    } finally {
      await ctx.client.query("set local role app_runtime");
    }
  }
  const res = await pool.query(text, params as any[]);
  return { rows: res.rows, rowCount: res.rowCount };
}

/** System context — bypasses RLS. Never expose this to user input paths. */
export const systemDb: Db = makeDb(runSystem);

/** Anonymous/public context — RLS applies, only public rows are visible. */
export const publicDb: Db = makeDb((text, params) => {
  const ctx = txStore.getStore();
  if (ctx) return ctx.client.query(text, params as any[]).then((r) => ({ rows: r.rows, rowCount: r.rowCount }));
  return pool.query(text, params as any[]).then((r) => ({ rows: r.rows, rowCount: r.rowCount }));
});

async function runTransaction<T>(
  actor: Actor | null,
  mode: "actor" | "system",
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const nested = txStore.getStore();
  if (nested) {
    // Already inside a transaction: reuse it (no nested BEGIN).
    return fn(makeDb(clientRunner(nested.client)));
  }

  return withMutex(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      if (mode === "actor") {
        await client.query("set local role app_runtime");
        await client.query(
          "select set_config('app.user_id', $1, true), set_config('app.user_email', $2, true), set_config('app.user_role', $3, true)",
          [actor?.id ?? "", actor?.email ?? "", actor?.role ?? "anon"],
        );
      } else {
        await client.query(
          "select set_config('app.user_id', '', true), set_config('app.user_email', '', true), set_config('app.user_role', 'system', true)",
        );
      }
      const db = makeDb(clientRunner(client));
      return await txStore.run({ client, role: mode }, async () => {
        const result = await fn(db);
        await client.query("commit");
        return result;
      });
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        /* connection already broken */
      }
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function withActor<T>(
  actor: Actor | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  return runTransaction(actor, "actor", fn);
}

/** System transaction (trusted backend only). */
export async function withSystem<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return runTransaction(null, "system", fn);
}

/** Public (anonymous) actor, RLS still applies via app_runtime role. */
export async function withPublic<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withActor({ id: null, role: "anon", email: null }, fn);
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505",
  );
}

export async function databaseHealthy(): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}
