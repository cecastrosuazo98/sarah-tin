/**
 * Postgres embebido (PGlite) con un "auth" mínimo al estilo Supabase,
 * para probar la migración, RLS por rol y las funciones RPC sin tocar producción.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
`;

const GRANTS = `
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
`;

export function readSql(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

export async function freshDb(opts: { migrate?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(readSql("supabase/schema.sql"));
  await db.exec(GRANTS);
  if (opts.migrate) await migrate(db);
  return db;
}

export async function migrate(db: PGlite) {
  await db.exec(readSql("supabase/migrations/001_v2_negocio_roles_sync.sql"));
  await db.exec(readSql("supabase/migrations/002_v2_vistas_sync.sql"));
  await db.exec(GRANTS);
}

/** Adaptador Sql (lib/sync/db.ts) sobre PGlite. */
export function pgliteSql(db: { query: PGlite["query"]; transaction?: PGlite["transaction"] }): import("@/lib/sync/db").Sql {
  return {
    async query(text, params = []) {
      return (await db.query(text, params as any[])).rows as any[];
    },
    async tx(fn) {
      if (!db.transaction) return fn(this);
      return db.transaction((t) => fn(pgliteSql(t as any)));
    },
  };
}

export async function createUser(db: PGlite, email: string, name?: string) {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(name ? { full_name: name } : {})]
  );
  return r.rows[0].id;
}

/** Ejecuta fn como el usuario dado (rol authenticated, RLS activo). */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set request.jwt.claim.sub = '${userId}'; set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}

export async function rpc<T = any>(db: PGlite, fn: string, ...args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(", ");
  const vals = args.map((a) => (a !== null && typeof a === "object" ? JSON.stringify(a) : a));
  const r = await db.query<{ r: T }>(`select public.${fn}(${params}) as r`, vals);
  return r.rows[0].r;
}
