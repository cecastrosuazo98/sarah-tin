/**
 * Ejecuta una sincronización: lee Sheets y la base, planifica (engine.ts) y
 * aplica. Una hoja con problemas no detiene las demás.
 *
 * Usa pocas llamadas a Google (la cuota es ~60 solicitudes/minuto por cuenta):
 * 1 lectura de todas las hojas, 1 escritura de IDs nuevos, 1 relectura,
 * 1 escritura de cambios y 1 llamada por hoja solo si hay filas nuevas.
 */
import { type Action, type DbRow, STATUS, buildRow, conflictSummary, planTab, stamp, type SheetRow } from "./engine";
import { type TabSpec, SYNC_TABS, TECH_COLUMNS, headersOf, getTab, columnType, editableColumns } from "./schema";
import type { SyncDb } from "./db";
import { type SheetsPort, a1, colLetter } from "./sheets";
import { type Cell, toDb } from "./values";

export interface TabStats {
  tab: string;
  pulled: number;
  pushed: number;
  appended: number;
  inserted: number;
  conflicts: number;
  errors: number;
  fatal?: string;
}

type LogEntry = { direction: "push" | "pull"; table: string; recordId: string | null; status: string; message: string };

function keysOf(tab: TabSpec): string[] {
  return [...tab.columns.map((c) => c.key), ...TECH_COLUMNS];
}

function toSheetRows(tab: TabSpec, grid: Cell[][]): SheetRow[] {
  const keys = keysOf(tab);
  return grid.slice(1).map((r, i) => {
    const cells: Record<string, Cell> = {};
    keys.forEach((k, j) => (cells[k] = r[j] ?? ""));
    return { row: i + 2, cells };
  });
}

function checkHeaders(tab: TabSpec, grid: Cell[][]) {
  const want = headersOf(tab);
  const got = (grid[0] ?? []).map((x) => String(x ?? "").trim());
  for (let i = 0; i < want.length; i++) {
    if (got[i] !== want[i]) {
      throw new Error(`Los encabezados de "${tab.name}" no coinciden (columna ${colLetter(i + 1)}: se esperaba "${want[i]}", hay "${got[i] ?? ""}"). No se sincroniza esta hoja para no dañar datos.`);
    }
  }
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

interface TabWork {
  tab: TabSpec;
  lastCol: string;
  statusCol: string;
  idCol: string;
  idIdx: number;
  stats: TabStats;
  actions: Action[];
  assignFailed?: string;
  rowWrites: Map<string, Cell[]>;
  marks: { row: number; id: string | null; status: string }[];
  appends: DbRow[];
  /** Filas de la base ya leídas al planificar (se reutilizan: menos consultas). */
  dbById: Map<string, DbRow>;
}

function newStats(tab: TabSpec): TabStats {
  return { tab: tab.name, pulled: 0, pushed: 0, appended: 0, inserted: 0, conflicts: 0, errors: 0 };
}

/** Aplica en la base las acciones de una hoja y prepara lo que hay que escribir en Sheets. */
async function applyActions(w: TabWork, db: SyncDb, log: LogEntry[], when: string) {
  const { tab, stats } = w;
  for (const a of w.actions) {
    try {
      switch (a.kind) {
        case "insert": {
          if (a.assignId && w.assignFailed) break; // sin el ID fijado en la hoja no se crea nada
          await db.insert(tab, a.id, a.data);
          const fresh = await db.fetchRow(tab, a.id);
          if (!fresh) throw new Error("no se pudo crear el registro");
          w.rowWrites.set(a.id, buildRow(tab, fresh, STATUS.ok, when));
          stats.inserted++;
          log.push({ direction: "pull", table: tab.name, recordId: a.id, status: "ok", message: "Registro creado desde Sheets" });
          break;
        }
        case "update": {
          const ok = await db.update(tab, a.id, a.expectedVersion, a.patch);
          if (!ok) {
            log.push({ direction: "pull", table: tab.name, recordId: a.id, status: "skipped", message: "Cambió en la app durante la sincronización; se reintenta en la próxima" });
            break;
          }
          const fresh = await db.fetchRow(tab, a.id);
          if (fresh) w.rowWrites.set(a.id, buildRow(tab, fresh, STATUS.ok, when));
          stats.pulled++;
          log.push({ direction: "pull", table: tab.name, recordId: a.id, status: "ok", message: `Actualizado desde Sheets: ${Object.keys(a.patch).join(", ")}` });
          break;
        }
        case "conflict": {
          await db.recordConflict(tab, a.id, a.sheetValues, a.dbValues, conflictSummary(tab, a.sheetValues, a.dbValues));
          w.marks.push({ row: a.row, id: a.id, status: STATUS.conflict });
          stats.conflicts++;
          log.push({ direction: "pull", table: tab.name, recordId: a.id, status: "conflict", message: "Cambió en Sheets y en la app; queda para revisión" });
          break;
        }
        case "mark": {
          w.marks.push(a);
          stats.errors++;
          log.push({ direction: "pull", table: tab.name, recordId: a.id, status: "error", message: a.status });
          break;
        }
        case "write": {
          const fresh = w.dbById.get(a.id) ?? (await db.fetchRow(tab, a.id));
          if (fresh) w.rowWrites.set(a.id, buildRow(tab, fresh, STATUS.ok, when));
          if (a.reason === "push") {
            stats.pushed++;
            log.push({ direction: "push", table: tab.name, recordId: a.id, status: "ok", message: "Actualizado en Sheets" });
          }
          break;
        }
        case "append": {
          const fresh = w.dbById.get(a.id) ?? (await db.fetchRow(tab, a.id));
          if (fresh) w.appends.push(fresh);
          break;
        }
      }
    } catch (e) {
      const msg = errMsg(e);
      if ("row" in a && a.row) w.marks.push({ row: a.row, id: a.id, status: STATUS.error(msg.slice(0, 200)) });
      stats.errors++;
      log.push({ direction: a.kind === "write" || a.kind === "append" ? "push" : "pull", table: tab.name, recordId: a.id, status: "error", message: msg });
    }
  }
}

/** Sincroniza varias hojas con el mínimo de llamadas a Google. */
export async function syncTabs(tabs: TabSpec[], sheets: SheetsPort, db: SyncDb, log: LogEntry[]): Promise<TabStats[]> {
  const when = stamp();
  const metas = tabs.map((tab) => ({ tab: tab.name, lastCol: colLetter(keysOf(tab).length) }));
  const grids = await sheets.readMany(metas);

  // Planificación por hoja (en memoria).
  const works: TabWork[] = [];
  const failed: TabStats[] = [];
  const headerWrites: { range: string; values: Cell[][] }[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const stats = newStats(tab);
    try {
      let grid = grids[i];
      if (grid.length === 0) {
        headerWrites.push({ range: a1(tab.name, `A1:${metas[i].lastCol}1`), values: [headersOf(tab)] });
        grid = [headersOf(tab)];
      } else {
        checkHeaders(tab, grid);
      }
      const dbRows = await db.fetchRows(tab);
      const plan = planTab(tab, toSheetRows(tab, grid), dbRows);
      const idIdx = tab.columns.findIndex((c) => c.key === "id");
      works.push({
        tab, stats, actions: plan.actions, lastCol: metas[i].lastCol, idIdx,
        statusCol: colLetter(tab.columns.length + TECH_COLUMNS.indexOf("_estado_sync") + 1),
        idCol: colLetter(idIdx + 1),
        rowWrites: new Map(), marks: [], appends: [],
        dbById: new Map(dbRows.map((r) => [r.id, r])),
      });
    } catch (e) {
      stats.errors = 1;
      stats.fatal = errMsg(e);
      log.push({ direction: "pull", table: tab.name, recordId: null, status: "error", message: stats.fatal });
      failed.push(stats);
    }
  }
  await sheets.write(headerWrites);

  // 1) Altas desde Sheets: primero se fija el ID en la hoja; si eso falla no se crea nada.
  const assignWrites: { range: string; values: Cell[][] }[] = [];
  for (const w of works) {
    for (const a of w.actions) {
      if (a.kind === "insert" && a.assignId) {
        assignWrites.push({ range: a1(w.tab.name, `${w.idCol}${a.row}`), values: [[a.id]] });
        assignWrites.push({ range: a1(w.tab.name, `${w.statusCol}${a.row}`), values: [[STATUS.pending]] });
      }
    }
  }
  try {
    await sheets.write(assignWrites);
  } catch (e) {
    for (const w of works) {
      if (!w.actions.some((a) => a.kind === "insert" && a.assignId)) continue;
      w.assignFailed = errMsg(e);
      w.stats.fatal = `No se pudo fijar el ID de las filas nuevas (${w.assignFailed}); se reintenta en la próxima sincronización.`;
      w.stats.errors++;
      log.push({ direction: "pull", table: w.tab.name, recordId: null, status: "error", message: w.stats.fatal });
    }
  }

  // 2) Cambios en la base.
  for (const w of works) await applyActions(w, db, log, when);

  // 3) Relectura: se ubica cada ID justo antes de escribir (por si ordenaron o insertaron filas).
  const pending = works.filter((w) => w.rowWrites.size || w.marks.length);
  const regrids = await sheets.readMany(pending.map((w) => ({ tab: w.tab.name, lastCol: w.lastCol })));
  const data: { range: string; values: Cell[][] }[] = [];
  pending.forEach((w, i) => {
    const rowOfId = new Map<string, number>();
    regrids[i].slice(1).forEach((r, j) => {
      const id = String(r[w.idIdx] ?? "").trim().toLowerCase();
      if (id && !rowOfId.has(id)) rowOfId.set(id, j + 2);
    });
    w.rowWrites.forEach((values, id) => {
      const row = rowOfId.get(id);
      if (row) data.push({ range: a1(w.tab.name, `A${row}:${w.lastCol}${row}`), values: [values] });
    });
    for (const m of w.marks) {
      const row = m.id ? rowOfId.get(m.id) : m.row;
      if (row) data.push({ range: a1(w.tab.name, `${w.statusCol}${row}`), values: [[m.status]] });
    }
  });
  try {
    await sheets.write(data);
  } catch (e) {
    // La base ya quedó bien: en la próxima corrida esas filas se vuelven a escribir.
    for (const w of pending) {
      w.stats.fatal = `No se pudo escribir en Sheets (${errMsg(e)}); se reintenta en la próxima sincronización.`;
      w.stats.errors++;
    }
  }

  // 4) Filas nuevas al final de cada hoja.
  for (const w of works) {
    if (!w.appends.length) continue;
    try {
      await sheets.append(w.tab.name, w.lastCol, w.appends.map((r) => buildRow(w.tab, r, STATUS.ok, when)));
      w.stats.appended = w.appends.length;
      if (!w.tab.push_limit) {
        for (const r of w.appends) log.push({ direction: "push", table: w.tab.name, recordId: r.id, status: "ok", message: "Agregado a Sheets" });
      }
    } catch (e) {
      w.stats.fatal = `No se pudieron agregar filas (${errMsg(e)}); se reintenta en la próxima sincronización.`;
      w.stats.errors++;
    }
  }

  const byName = new Map([...works.map((w) => w.stats), ...failed].map((s) => [s.tab, s]));
  return tabs.map((t) => byName.get(t.name)!);
}

/** Una sola hoja (útil para reparaciones puntuales). */
export async function syncTab(tab: TabSpec, sheets: SheetsPort, db: SyncDb, log: LogEntry[]): Promise<TabStats> {
  return (await syncTabs([tab], sheets, db, log))[0];
}

export interface RunResult {
  runId: string | null;
  status: "ok" | "partial" | "error" | "busy";
  tabs: TabStats[];
}

/** Sincroniza todas las hojas (o las indicadas). */
export async function runSync(sheets: SheetsPort, db: SyncDb, trigger: string, only?: string[]): Promise<RunResult> {
  const runId = await db.startRun(trigger);
  if (!runId) return { runId: null, status: "busy", tabs: [] };
  const log: LogEntry[] = [];
  // La bitácora se publica al final, para que incluya esta corrida.
  const list = SYNC_TABS.filter((t) => (!only || only.includes(t.name)) && t.table !== "sync_log");
  let tabs: TabStats[];
  try {
    tabs = await syncTabs(list, sheets, db, log);
  } catch (e) {
    // Falla general (sin conexión con Google, credenciales…): queda registrada y se reintenta.
    const msg = errMsg(e);
    await db.log(runId, [{ direction: "pull", table: "(todas)", recordId: null, status: "error", message: msg }]).catch(() => {});
    await db.finishRun(runId, "error", { tabs: [] }, msg);
    return { runId, status: "error", tabs: [] };
  }
  try {
    await db.log(runId, log);
    if (!only) await syncTabs([getTab("Sync_Bitacora")], sheets, db, []);
  } catch {
    /* la bitácora no debe hacer fallar la corrida */
  }
  const fatal = tabs.filter((t) => t.fatal).length;
  const status = fatal === tabs.length && tabs.length > 0 ? "error" : tabs.some((t) => t.errors || t.conflicts) ? "partial" : "ok";
  await db.finishRun(runId, status, { tabs }, fatal ? tabs.filter((t) => t.fatal).map((t) => `${t.tab}: ${t.fatal}`).join(" | ") : undefined);
  return { runId, status, tabs };
}

/** César resuelve un conflicto: gana Sheets o gana la app. */
export async function resolveConflict(sheets: SheetsPort, db: SyncDb, conflictId: string, winner: "sheets" | "app", userId: string | null) {
  const open = (await db.openConflicts()).find((c) => c.id === conflictId);
  if (!open) throw new Error("El conflicto no existe o ya fue resuelto.");
  const tab = getTab(open.table_name);
  const current = await db.fetchRow(tab, open.record_id);
  if (!current) throw new Error("El registro ya no existe en la app.");

  if (winner === "sheets") {
    const patch: Record<string, string | number | boolean | null> = {};
    for (const c of editableColumns(tab)) {
      if (c.key in open.sheet_values) patch[c.key] = toDb(columnType(tab, c, current.id), open.sheet_values[c.key]);
    }
    const ok = await db.update(tab, current.id, current.version, patch);
    if (!ok) throw new Error("El registro cambió mientras resolvías. Vuelve a intentarlo.");
  }
  await db.closeConflict(conflictId, winner, userId);
  // La fila de la hoja se reescribe con el valor final (y su huella nueva).
  const fresh = await db.fetchRow(tab, current.id);
  const lastCol = colLetter(keysOf(tab).length);
  const grid = await sheets.read(tab.name, lastCol);
  const idIdx = tab.columns.findIndex((c) => c.key === "id");
  const idx = grid.findIndex((r, i) => i > 0 && String(r[idIdx] ?? "").toLowerCase() === current.id);
  if (fresh && idx > 0) {
    await sheets.write([{ range: a1(tab.name, `A${idx + 1}:${lastCol}${idx + 1}`), values: [buildRow(tab, fresh)] }]);
  }
  await db.log(null, [{ direction: winner === "sheets" ? "pull" : "push", table: tab.name, recordId: current.id, status: "ok", message: `Conflicto resuelto: gana ${winner === "sheets" ? "Sheets" : "la app"}` }]);
}
