/**
 * Contexto de servidor para la sincronización. Solo se importa desde rutas
 * /api (nunca desde componentes del navegador). Todas las credenciales vienen
 * de variables de entorno del servidor.
 */
import "server-only";
import postgres from "postgres";
import { createClient } from "@/lib/supabase/server";
import { SyncDb, type Sql } from "./db";
import { GoogleSheets, googleConfigFromEnv } from "./sheets";

let pool: ReturnType<typeof postgres> | null = null;

function sqlFromEnv(): Sql | null {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return null;
  pool ??= postgres(url, { max: 3, prepare: false, idle_timeout: 20, ssl: "require" });
  const wrap = (q: postgres.Sql | postgres.TransactionSql): Sql => ({
    query: (text, params = []) => q.unsafe(text, params as postgres.ParameterOrJSON<never>[]) as never,
    tx: (fn) => pool!.begin((t) => fn(wrap(t))) as never,
  });
  return wrap(pool);
}

export function missingSyncEnv(): string[] {
  const need = ["SUPABASE_DB_URL", "SYNC_BUSINESS_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID"];
  return need.filter((k) => !process.env[k]);
}

export function syncContext() {
  const missing = missingSyncEnv();
  if (missing.length) return { error: `Falta configurar en el servidor: ${missing.join(", ")}` } as const;
  const sql = sqlFromEnv()!;
  const db = new SyncDb(sql, process.env.SYNC_BUSINESS_ID!);
  const sheets = new GoogleSheets(googleConfigFromEnv()!);
  return { sql, db, sheets } as const;
}

/** Usuario de la sesión y su rol en el negocio sincronizado. */
export async function sessionRole(sql: Sql | null): Promise<{ userId: string; role: "admin" | "operador" } | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !sql) return null;
  const rows = await sql.query<{ role: "admin" | "operador" }>(
    `select role from public.business_members where user_id = $1 and business_id = $2`,
    [data.user.id, process.env.SYNC_BUSINESS_ID]);
  return rows[0] ? { userId: data.user.id, role: rows[0].role } : null;
}

/** Secreto del cron (comparación en tiempo constante). */
export function isCron(req: Request) {
  const secret = process.env.SYNC_CRON_SECRET;
  const got = req.headers.get("x-sync-secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
