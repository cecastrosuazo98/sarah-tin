/**
 * Acceso a la base para la sincronización (solo servidor).
 * Usa SQL directo sobre una conexión de servidor; siempre filtra por negocio.
 */
import type { DbRow, DbValue } from "./engine";
import { type TabSpec, SYNC_TABS } from "./schema";

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Ejecuta fn dentro de una transacción. */
  tx<T>(fn: (q: Sql) => Promise<T>): Promise<T>;
}

const VIEWS = new Set([
  "ingredients", "recipes", "recipe_ingredients", "products", "customers", "orders", "order_items",
  "sales", "sale_items", "payments", "expenses", "purchases", "purchase_items", "supplier_payments",
  "production", "inventory_movements", "owner_movements", "sync_conflicts", "sync_log",
]);

function ident(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return `"${name}"`;
}

function sourceOf(tab: TabSpec) {
  return VIEWS.has(tab.table) ? `public.${ident("sync_" + tab.table)}` : `public.${ident(tab.table)}`;
}

/** Columnas físicas editables de la tabla (las de la hoja que tienen edit). */
function editableKeys(tab: TabSpec) {
  return tab.columns.filter((c) => c.edit).map((c) => c.key);
}

export class SyncDb {
  constructor(private sql: Sql, readonly businessId: string) {}

  async fetchRows(tab: TabSpec): Promise<DbRow[]> {
    if (tab.kind === "params") return this.fetchParams(tab);
    const cols = Array.from(new Set(["id", "version", ...tab.columns.map((c) => c.key)])).map(ident).join(", ");
    const order = tab.push_limit ? `order by created_at desc, id limit ${Number(tab.push_limit)}` : "order by created_at, id";
    const rows = await this.sql.query<DbRow>(
      `select ${cols} from ${sourceOf(tab)} where business_id = $1 ${order}`,
      [this.businessId]
    );
    const out = rows.map((r) => ({ ...r, id: String(r.id), version: Number(r.version ?? 1) }));
    return tab.push_limit ? out.reverse() : out;
  }

  async fetchRow(tab: TabSpec, id: string): Promise<DbRow | null> {
    if (tab.kind === "params") return (await this.fetchParams(tab)).find((r) => r.id === id) ?? null;
    const cols = Array.from(new Set(["id", "version", ...tab.columns.map((c) => c.key)])).map(ident).join(", ");
    const rows = await this.sql.query<DbRow>(
      `select ${cols} from ${sourceOf(tab)} where business_id = $1 and id = $2`, [this.businessId, id]);
    return rows[0] ? { ...rows[0], id: String(rows[0].id), version: Number(rows[0].version ?? 1) } : null;
  }

  private async fetchParams(tab: TabSpec): Promise<DbRow[]> {
    const [s] = await this.sql.query<Record<string, unknown>>(
      `select * from public.business_settings where business_id = $1`, [this.businessId]);
    if (!s) return [];
    const params = (s.params ?? {}) as Record<string, unknown>;
    return (tab.params ?? []).map((p) => ({
      id: p.key,
      version: Number(s.version ?? 1),
      label: p.label,
      value: p.field ? s[p.field] : params[p.key],
      help: p.help ?? "",
    }));
  }

  /** Actualiza con control de versión. false = alguien la cambió entretanto. */
  async update(tab: TabSpec, id: string, expectedVersion: number, patch: Record<string, DbValue>): Promise<boolean> {
    if (tab.kind === "params") return this.updateParam(tab, id, patch.value);
    const allowed = new Set(editableKeys(tab));
    const keys = Object.keys(patch).filter((k) => allowed.has(k));
    if (!keys.length) return true;
    const sets = keys.map((k, i) => `${ident(k)} = $${i + 4}`).join(", ");
    const rows = await this.sql.query(
      `update public.${ident(tab.table)} set ${sets}, updated_source = 'sheets'
       where business_id = $1 and id = $2 and version = $3 returning id`,
      [this.businessId, id, expectedVersion, ...keys.map((k) => patch[k])]
    );
    return rows.length === 1;
  }

  private async updateParam(tab: TabSpec, key: string, value: DbValue): Promise<boolean> {
    const p = tab.params?.find((x) => x.key === key);
    if (!p) throw new Error(`Parámetro desconocido: ${key}`);
    if (p.field) {
      const rows = await this.sql.query(
        `update public.business_settings set ${ident(p.field)} = $2, updated_source = 'sheets' where business_id = $1 returning id`,
        [this.businessId, value]);
      return rows.length === 1;
    }
    const rows = await this.sql.query(
      `update public.business_settings set params = params || jsonb_build_object($2::text, $3::jsonb), updated_source = 'sheets'
       where business_id = $1 returning id`,
      [this.businessId, key, JSON.stringify(value)]);
    return rows.length === 1;
  }

  /** Alta desde Sheets. Idempotente por ID: si ya existe no hace nada. */
  async insert(tab: TabSpec, id: string, data: Record<string, DbValue>): Promise<void> {
    const allowed = new Set(editableKeys(tab));
    const keys = Object.keys(data).filter((k) => allowed.has(k) && data[k] !== null);
    const cols = ["id", "business_id", "updated_source", ...keys].map(ident).join(", ");
    const vals = ["$1", "$2", "'sheets'", ...keys.map((_, i) => `$${i + 3}`)].join(", ");
    await this.sql.query(
      `insert into public.${ident(tab.table)} (${cols}) values (${vals}) on conflict (id) do nothing`,
      [id, this.businessId, ...keys.map((k) => data[k])]
    );
  }

  async recordConflict(tab: TabSpec, recordId: string, sheet: Record<string, string>, db: Record<string, string>, summary: string) {
    await this.sql.query(
      `insert into public.sync_conflicts (business_id, table_name, record_id, sheet_values, db_values, summary)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (business_id, table_name, record_id) where status = 'abierto'
       do update set sheet_values = excluded.sheet_values, db_values = excluded.db_values, summary = excluded.summary`,
      [this.businessId, tab.name, recordId, JSON.stringify(sheet), JSON.stringify(db), summary]
    );
  }

  async openConflicts() {
    return this.sql.query<{ id: string; table_name: string; record_id: string; sheet_values: Record<string, string>; summary: string; created_at: string }>(
      `select id, table_name, record_id, sheet_values, summary, created_at from public.sync_conflicts
       where business_id = $1 and status = 'abierto' order by created_at`, [this.businessId]);
  }

  async closeConflict(id: string, resolution: "sheets" | "app", userId: string | null) {
    await this.sql.query(
      `update public.sync_conflicts set status = 'resuelto', resolution = $3, resolved_by = $4, resolved_at = now()
       where business_id = $1 and id = $2`, [this.businessId, id, resolution, userId]);
  }

  /** Inicia una corrida si no hay otra en curso (evita ejecuciones simultáneas). */
  async startRun(trigger: string): Promise<string | null> {
    return this.sql.tx(async (q) => {
      await q.query(`select pg_advisory_xact_lock(hashtext('sync:' || $1::text))`, [this.businessId]);
      const running = await q.query(
        `select id from public.sync_runs where business_id = $1 and status = 'running' and started_at > now() - interval '10 minutes'`,
        [this.businessId]);
      if (running.length) return null;
      const [r] = await q.query<{ id: string }>(
        `insert into public.sync_runs (business_id, trigger) values ($1, $2) returning id`, [this.businessId, trigger]);
      return r.id;
    });
  }

  async finishRun(runId: string, status: "ok" | "partial" | "error", stats: unknown, error?: string) {
    await this.sql.query(
      `update public.sync_runs set status = $2, stats = $3, error = $4, finished_at = now() where id = $1`,
      [runId, status, JSON.stringify(stats), error ?? null]);
  }

  async log(runId: string | null, entries: { direction: "push" | "pull"; table: string; recordId: string | null; status: string; message: string }[]) {
    if (!entries.length) return;
    const values: string[] = [];
    const params: unknown[] = [this.businessId, runId];
    entries.forEach((e, i) => {
      const o = i * 5;
      values.push(`($1, $2, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`);
      params.push(e.direction, e.table, e.recordId, e.status, e.message.slice(0, 500));
    });
    await this.sql.query(
      `insert into public.sync_log (business_id, run_id, direction, table_name, record_id, status, message) values ${values.join(", ")}`,
      params);
  }

  async lastRuns(limit = 10) {
    return this.sql.query(
      `select id, trigger, status, stats, error, started_at, finished_at from public.sync_runs
       where business_id = $1 order by started_at desc limit $2`, [this.businessId, limit]);
  }
}

export function tabsInOrder(): TabSpec[] {
  return SYNC_TABS;
}
