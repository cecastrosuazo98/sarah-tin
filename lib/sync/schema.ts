/**
 * Esquema de la matriz de Google Sheets. La misma especificación
 * (sheet-schema.json) la usan el motor de sincronización y el generador
 * de la planilla (scripts/build-matrix.py).
 */
import spec from "./sheet-schema.json";

export type ColType =
  | "id" | "text" | "code" | "int" | "num" | "money" | "pct" | "bool"
  | "date" | "datetime" | "time" | "month" | "enum" | "ref";

export interface ColumnSpec {
  key: string;
  header: string;
  type: ColType;
  edit?: boolean;
  required?: boolean;
  options?: string[];
  ref?: string;
  help?: string;
  width?: number;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: ColType;
  field?: string; // columna de business_settings; si no, va en params (jsonb)
  options?: string[];
  help?: string;
}

export interface TabSpec {
  name: string;
  group: "A" | "B" | "C";
  table: string;
  kind?: "params";
  allow_insert: boolean;
  push_limit?: number;
  columns: ColumnSpec[];
  params?: ParamSpec[];
}

export const TECH_COLUMNS = ["_version", "_hash", "_estado_sync", "_actualizado"] as const;
export type TechKey = (typeof TECH_COLUMNS)[number];

export const SCHEMA = spec as unknown as {
  version: number;
  title: string;
  technical_columns: { key: TechKey; header: string; help: string }[];
  tabs: TabSpec[];
};

export const SYNC_TABS: TabSpec[] = SCHEMA.tabs;

export function getTab(name: string): TabSpec {
  const t = SYNC_TABS.find((x) => x.name === name);
  if (!t) throw new Error(`Hoja desconocida: ${name}`);
  return t;
}

/** Encabezados de la hoja, en orden: columnas de datos + técnicas. */
export function headersOf(tab: TabSpec): string[] {
  return [...tab.columns.map((c) => c.header), ...SCHEMA.technical_columns.map((c) => c.header)];
}

export function editableColumns(tab: TabSpec): ColumnSpec[] {
  return tab.columns.filter((c) => c.edit);
}

/** Tipo efectivo de una columna (en Parametros depende de la fila). */
export function columnType(tab: TabSpec, col: ColumnSpec, rowId: string | null): ColumnSpec {
  if (tab.kind === "params" && col.type === "id") return { ...col, type: "text" };
  if (tab.kind === "params" && col.key === "value" && rowId) {
    const p = tab.params?.find((x) => x.key === rowId);
    if (p) return { ...col, type: p.type, options: p.options };
  }
  return col;
}
