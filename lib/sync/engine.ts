/**
 * Motor de sincronización: compara una hoja con la base y decide qué hacer.
 *
 * Es una función pura (sin red): recibe las filas de la hoja y las de la base y
 * devuelve un plan. El ejecutor (run.ts) aplica el plan.
 *
 * Regla de 3 vías por fila, usando `_huella` (huella de las columnas editables
 * en la última sincronización) como base común:
 *   - nadie cambió            → nada (o refresca columnas calculadas)
 *   - cambió solo la base     → se escribe la fila en Sheets
 *   - cambió solo Sheets      → se valida y se actualiza la base
 *   - cambiaron ambos, igual  → se refresca la fila
 *   - cambiaron ambos, distinto → CONFLICTO: no se toca ninguno de los dos lados
 * Lo que escribe la sincronización actualiza la huella, por eso no se vuelve a
 * leer como un cambio (sin bucles).
 */
import { createHash, randomUUID } from "node:crypto";
import {
  type ColumnSpec, type TabSpec, type TechKey,
  TECH_COLUMNS, columnType, editableColumns,
} from "./schema";
import { type Cell, fromDb, fromSheet, toDb, toSheet } from "./values";

export interface SheetRow {
  /** Número de fila en la hoja (1 = encabezado). */
  row: number;
  /** Celdas por clave de columna (datos + técnicas). */
  cells: Record<string, Cell>;
}

export interface DbRow {
  id: string;
  version: number;
  [key: string]: unknown;
}

export type DbValue = string | number | boolean | null;

export type Action =
  | { kind: "write"; row: number; id: string; reason: "push" | "refresh" }
  | { kind: "append"; id: string }
  | { kind: "update"; row: number; id: string; expectedVersion: number; patch: Record<string, DbValue>; sheetValues: Record<string, string> }
  | { kind: "insert"; row: number; id: string; assignId: boolean; data: Record<string, DbValue> }
  | { kind: "conflict"; row: number; id: string; sheetValues: Record<string, string>; dbValues: Record<string, string> }
  | { kind: "mark"; row: number; id: string | null; status: string };

export interface Plan {
  tab: string;
  actions: Action[];
}

export const STATUS = {
  ok: "OK",
  pending: "PENDIENTE",
  conflict: "CONFLICTO",
  error: (msg: string) => `ERROR: ${msg}`,
};

export function hashValues(values: string[]): string {
  return createHash("sha1").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}

function editableCanonFromDb(tab: TabSpec, db: DbRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of editableColumns(tab)) out[c.key] = fromDb(columnType(tab, c, db.id), db[c.key]);
  return out;
}

export function dbHash(tab: TabSpec, db: DbRow): string {
  const v = editableCanonFromDb(tab, db);
  return hashValues(editableColumns(tab).map((c) => v[c.key]));
}

const nowFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function stamp(d = new Date()): string {
  return nowFmt.format(d).replace(/\//g, "-").replace(",", "");
}

/** Fila completa (datos + técnicas) a escribir en Sheets para un registro de la base. */
export function buildRow(tab: TabSpec, db: DbRow, status = STATUS.ok, when = stamp()): Cell[] {
  const data = tab.columns.map((c) => {
    const col = columnType(tab, c, db.id);
    return toSheet(col, fromDb(col, db[c.key]));
  });
  const tech: Record<TechKey, Cell> = {
    _version: db.version,
    _hash: dbHash(tab, db),
    _estado_sync: status,
    _actualizado: when,
  };
  return [...data, ...TECH_COLUMNS.map((k) => tech[k])];
}

/** ¿La fila de la hoja ya muestra exactamente lo que hay en la base? */
function rowMatchesDb(tab: TabSpec, sr: SheetRow, db: DbRow): boolean {
  for (const c of tab.columns) {
    const col = columnType(tab, c, db.id);
    const want = fromDb(col, db[c.key]);
    const got = fromSheet({ ...col, required: false }, sr.cells[c.key]);
    if (!("value" in got) || got.value !== want) return false;
  }
  return (
    Number(sr.cells._version) === db.version &&
    String(sr.cells._hash ?? "") === dbHash(tab, db) &&
    String(sr.cells._estado_sync ?? "") === STATUS.ok
  );
}

function parseEditable(tab: TabSpec, sr: SheetRow, rowId: string | null):
  { values: Record<string, string>; errors: string[] } {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  for (const c of editableColumns(tab)) {
    const col: ColumnSpec = columnType(tab, c, rowId);
    const r = fromSheet(col, sr.cells[c.key]);
    if ("error" in r) errors.push(r.error);
    else values[c.key] = r.value;
  }
  return { values, errors };
}

function toPatch(tab: TabSpec, values: Record<string, string>, rowId: string | null, onlyKeys?: string[]) {
  const patch: Record<string, DbValue> = {};
  for (const c of editableColumns(tab)) {
    if (onlyKeys && !onlyKeys.includes(c.key)) continue;
    patch[c.key] = toDb(columnType(tab, c, rowId), values[c.key]);
  }
  return patch;
}

function isBlank(tab: TabSpec, sr: SheetRow) {
  return tab.columns.every((c) => {
    const v = sr.cells[c.key];
    return v === null || v === undefined || v === "" || v === false;
  });
}

export function planTab(tab: TabSpec, sheetRows: SheetRow[], dbRows: DbRow[]): Plan {
  const actions: Action[] = [];
  const dbById = new Map(dbRows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const pullable = editableColumns(tab).length > 0;

  for (const sr of sheetRows) {
    const rawId = String(sr.cells.id ?? "").trim().toLowerCase();

    if (!rawId) {
      if (isBlank(tab, sr)) continue;
      if (!tab.allow_insert) {
        actions.push({ kind: "mark", row: sr.row, id: null, status: STATUS.error("los registros nuevos de esta hoja se crean desde la app") });
        continue;
      }
      const { values, errors } = parseEditable(tab, sr, null);
      if (errors.length) {
        actions.push({ kind: "mark", row: sr.row, id: null, status: STATUS.error(errors.join("; ")) });
        continue;
      }
      actions.push({ kind: "insert", row: sr.row, id: randomUUID(), assignId: true, data: toPatch(tab, values, null) });
      continue;
    }

    if (seen.has(rawId)) {
      actions.push({ kind: "mark", row: sr.row, id: rawId, status: STATUS.error("ID duplicado: borra esta fila o deja el ID vacío para crear un registro nuevo") });
      continue;
    }
    seen.add(rawId);

    const db = dbById.get(rawId);
    if (!db) {
      if (tab.push_limit) continue; // hojas de bitácora: filas antiguas fuera del límite
      const neverSynced = sr.cells._version === "" || sr.cells._version === null || sr.cells._version === undefined;
      if (tab.allow_insert && neverSynced) {
        const { values, errors } = parseEditable(tab, sr, rawId);
        if (errors.length) {
          actions.push({ kind: "mark", row: sr.row, id: rawId, status: STATUS.error(errors.join("; ")) });
          continue;
        }
        // Reintento de una alta interrumpida: se inserta con el mismo ID (no duplica).
        actions.push({ kind: "insert", row: sr.row, id: rawId, assignId: false, data: toPatch(tab, values, rawId) });
      } else {
        actions.push({ kind: "mark", row: sr.row, id: rawId, status: STATUS.error("este ID no existe en la app (¿se copió o se eliminó?)") });
      }
      continue;
    }

    if (!pullable) {
      if (!rowMatchesDb(tab, sr, db)) actions.push({ kind: "write", row: sr.row, id: db.id, reason: "push" });
      continue;
    }

    const base = String(sr.cells._hash ?? "");
    const hD = dbHash(tab, db);
    const { values, errors } = parseEditable(tab, sr, db.id);
    const hS = errors.length ? null : hashValues(editableColumns(tab).map((c) => values[c.key]));
    // Fila nunca sincronizada (sin huella): manda la app, para no borrar datos
    // con celdas vacías de una planilla recién creada.
    const sheetChanged = base !== "" && (hS === null || hS !== base);
    const dbChanged = base !== "" && hD !== base;

    if (sheetChanged && errors.length) {
      // Sheets tiene un valor inválido: no se aplica nada de esa fila.
      actions.push({ kind: "mark", row: sr.row, id: db.id, status: STATUS.error(errors.join("; ")) });
      continue;
    }

    if (!sheetChanged) {
      if (!rowMatchesDb(tab, sr, db)) actions.push({ kind: "write", row: sr.row, id: db.id, reason: dbChanged ? "push" : "refresh" });
      continue;
    }

    if (!dbChanged || hS === hD) {
      if (hS === hD) {
        if (!rowMatchesDb(tab, sr, db)) actions.push({ kind: "write", row: sr.row, id: db.id, reason: "refresh" });
        continue;
      }
      const dbVals = editableCanonFromDb(tab, db);
      const changed = editableColumns(tab).map((c) => c.key).filter((k) => values[k] !== dbVals[k]);
      actions.push({
        kind: "update", row: sr.row, id: db.id, expectedVersion: db.version,
        patch: toPatch(tab, values, db.id, changed), sheetValues: values,
      });
      continue;
    }

    actions.push({ kind: "conflict", row: sr.row, id: db.id, sheetValues: values, dbValues: editableCanonFromDb(tab, db) });
  }

  for (const db of dbRows) {
    if (!seen.has(db.id)) actions.push({ kind: "append", id: db.id });
  }

  return { tab: tab.name, actions };
}

/** Texto corto con las diferencias de un conflicto, para mostrar a César. */
export function conflictSummary(tab: TabSpec, sheet: Record<string, string>, db: Record<string, string>): string {
  return editableColumns(tab)
    .filter((c) => (sheet[c.key] ?? "") !== (db[c.key] ?? ""))
    .map((c) => `${c.header}: Sheets "${sheet[c.key] ?? ""}" / App "${db[c.key] ?? ""}"`)
    .join(" · ");
}
