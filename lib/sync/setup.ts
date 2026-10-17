/**
 * "Preparar matriz": deja la planilla lista para sincronizar usando la API
 * (pestañas faltantes, encabezados, formatos DD-MM-AAAA / $ / %, casillas Sí/No
 * y protección con advertencia de columnas calculadas y técnicas).
 * Es idempotente: se puede ejecutar varias veces.
 */
import { type TabSpec, SCHEMA, SYNC_TABS, headersOf } from "./schema";
import type { SheetMeta } from "./sheets";
import spec from "./sheet-schema.json";

interface AnalysisSpec {
  name: string;
  help: string;
  headers: string[];
  formats: string[];
  rows?: number;
  row_formulas?: string[];
  total_row?: string[];
  array_formulas?: string[];
}

export const ANALYSIS = (spec as unknown as { analysis: AnalysisSpec[] }).analysis;

const NUMBER_FORMATS: Record<string, { type: string; pattern: string }> = {
  money: { type: "CURRENCY", pattern: '"$"#,##0' },
  pct: { type: "PERCENT", pattern: "0.0%" },
  int: { type: "NUMBER", pattern: "#,##0" },
  num: { type: "NUMBER", pattern: "#,##0.###" },
  date: { type: "DATE", pattern: "dd-mm-yyyy" },
  datetime: { type: "DATE_TIME", pattern: "dd-mm-yyyy hh:mm" },
  time: { type: "TIME", pattern: "hh:mm" },
  month: { type: "DATE", pattern: "mmm yyyy" },
};
const TEXT_TYPES = new Set(["text", "code", "ref", "id"]);

function colIdx(tab: string, key: string) {
  const t = SYNC_TABS.find((x) => x.name === tab);
  const i = t?.columns.findIndex((c) => c.key === key) ?? -1;
  if (i < 0) throw new Error(`Columna desconocida ${tab}.${key}`);
  return i;
}

function letter(i: number) {
  let s = "";
  for (let x = i + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** {Tab.key} → Tab!X2:X  ·  {Tab.a:b} → Tab!X2:Y (igual que scripts/build-matrix.py). */
export function resolveFormula(f: string) {
  return f.replace(/\{([A-Za-z_]+)\.([a-z_:]+)\}/g, (_, tab: string, keys: string) => {
    if (keys.includes(":")) {
      const [a, b] = keys.split(":");
      return `${tab}!${letter(colIdx(tab, a))}2:${letter(colIdx(tab, b))}`;
    }
    const c = letter(colIdx(tab, keys));
    return `${tab}!${c}2:${c}`;
  });
}

function cellValue(v: string) {
  if (v.startsWith("=")) return { userEnteredValue: { formulaValue: v } };
  return { userEnteredValue: { stringValue: v } };
}

/** Pestañas que faltan (se crean antes de dar formato). */
export function missingTabs(meta: SheetMeta[]): string[] {
  const have = new Set(meta.map((m) => m.title));
  return [...SYNC_TABS.map((t) => t.name), ...ANALYSIS.map((a) => a.name)].filter((n) => !have.has(n));
}

function syncTabRequests(tab: TabSpec, m: SheetMeta): unknown[] {
  const req: unknown[] = [];
  const width = headersOf(tab).length;
  const range = (c0: number, c1: number, r0 = 1) => ({
    sheetId: m.sheetId, startRowIndex: r0, endRowIndex: m.rowCount, startColumnIndex: c0, endColumnIndex: c1,
  });
  req.push({
    updateCells: {
      range: { sheetId: m.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width },
      rows: [{ values: headersOf(tab).map((h) => ({ userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true } } })) }],
      fields: "userEnteredValue,userEnteredFormat.textFormat.bold",
    },
  });
  req.push({ updateSheetProperties: { properties: { sheetId: m.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } });

  tab.columns.forEach((c, i) => {
    const nf = NUMBER_FORMATS[c.type] ?? (TEXT_TYPES.has(c.type) ? { type: "TEXT", pattern: "@" } : null);
    if (nf) {
      req.push({ repeatCell: { range: range(i, i + 1), cell: { userEnteredFormat: { numberFormat: nf } }, fields: "userEnteredFormat.numberFormat" } });
    }
    if (c.edit && c.type === "bool") {
      req.push({ setDataValidation: { range: range(i, i + 1), rule: { condition: { type: "BOOLEAN" }, strict: true } } });
    }
  });

  // Protección con advertencia: no bloquea a nadie (ni a la sincronización), pero avisa.
  for (const p of m.protectedRanges) {
    if (p.description?.startsWith("sync:")) req.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } });
  }
  req.push({ addProtectedRange: { protectedRange: {
    range: { sheetId: m.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width },
    description: "sync: encabezados", warningOnly: true } } });
  tab.columns.forEach((c, i) => {
    if (!c.edit) {
      req.push({ addProtectedRange: { protectedRange: { range: range(i, i + 1), description: `sync: ${c.header} (calculado)`, warningOnly: true } } });
    }
  });
  req.push({ addProtectedRange: { protectedRange: { range: range(tab.columns.length, width), description: "sync: columnas técnicas", warningOnly: true } } });
  return req;
}

function analysisRequests(a: AnalysisSpec, m: SheetMeta): unknown[] {
  const rows: { values: unknown[] }[] = [{ values: a.headers.map((h) => ({ ...cellValue(h), userEnteredFormat: { textFormat: { bold: true } } })) }];
  if (a.row_formulas && a.rows) {
    for (let r = 2; r < a.rows + 2; r++) rows.push({ values: a.row_formulas.map((f) => cellValue(resolveFormula(f.replace(/\{r\}/g, String(r))))) });
    if (a.total_row) rows.push({ values: a.total_row.map((f) => cellValue(f.startsWith("=") ? resolveFormula(f) : f)) });
  }
  if (a.array_formulas) rows.push({ values: a.array_formulas.map((f) => (f ? cellValue(resolveFormula(f)) : {})) });
  const req: unknown[] = [{
    updateCells: {
      range: { sheetId: m.sheetId, startRowIndex: 0, startColumnIndex: 0 },
      rows, fields: "userEnteredValue,userEnteredFormat.textFormat.bold",
    },
  }];
  a.formats.forEach((f, i) => {
    const nf = NUMBER_FORMATS[f];
    if (nf) req.push({ repeatCell: {
      range: { sheetId: m.sheetId, startRowIndex: 1, endRowIndex: m.rowCount, startColumnIndex: i, endColumnIndex: i + 1 },
      cell: { userEnteredFormat: { numberFormat: nf } }, fields: "userEnteredFormat.numberFormat" } });
  });
  return req;
}

/**
 * Solicitudes de formato. Las pestañas de análisis solo se escriben si se
 * acaban de crear (o si se pide explícitamente), para no pisar ajustes de César.
 */
export function setupRequests(meta: SheetMeta[], opts: { createdTabs: string[]; resetAnalysis?: boolean }): unknown[] {
  const byTitle = new Map(meta.map((m) => [m.title, m]));
  const req: unknown[] = [];
  for (const tab of SYNC_TABS) {
    const m = byTitle.get(tab.name);
    if (m) req.push(...syncTabRequests(tab, m));
  }
  for (const a of ANALYSIS) {
    const m = byTitle.get(a.name);
    if (m && (opts.resetAnalysis || opts.createdTabs.includes(a.name))) req.push(...analysisRequests(a, m));
  }
  return req;
}

export function addSheetRequests(names: string[]): unknown[] {
  return names.map((title) => {
    const t = SYNC_TABS.find((x) => x.name === title);
    const color = t ? (SCHEMA as unknown as { groups: Record<string, { color: string }> }).groups[t.group].color : "C9A227";
    const rgb = { red: parseInt(color.slice(0, 2), 16) / 255, green: parseInt(color.slice(2, 4), 16) / 255, blue: parseInt(color.slice(4, 6), 16) / 255 };
    return { addSheet: { properties: { title, tabColor: rgb } } };
  });
}
