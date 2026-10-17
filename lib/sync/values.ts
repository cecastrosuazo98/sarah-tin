/**
 * Conversión de valores entre la base, la forma canónica (para huellas) y las
 * celdas de Google Sheets. Fechas en hora de Chile; en la hoja se escriben como
 * número de serie para que las fórmulas por mes funcionen y se muestran
 * DD-MM-AAAA con el formato de la columna.
 */
import type { ColumnSpec } from "./schema";

export type Cell = string | number | boolean | null | undefined;
export type Parsed = { value: string } | { error: string };

const TZ = "America/Santiago";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;

function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function numStr(n: number, decimals: number) {
  return String(round(n, decimals));
}

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function isoToChileDate(v: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return dateFmt.format(d);
}

function isoToChileDateTime(v: string) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

export function serialToDate(serial: number) {
  const d = new Date(EPOCH + Math.floor(serial) * DAY);
  return d.toISOString().slice(0, 10);
}

export function dateToSerial(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - EPOCH) / DAY;
}

function validYmd(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Lee un número escrito a la chilena ("1.500", "1,5", "$ 2.000") o como número. */
export function parseNumber(cell: Cell): number | null {
  if (typeof cell === "number") return cell;
  if (typeof cell !== "string") return null;
  let s = cell.trim().replace(/\$|\s/g, "");
  if (!s) return null;
  const pct = s.endsWith("%");
  if (pct) s = s.slice(0, -1);
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return pct ? n / 100 : n;
}

function isEmpty(cell: Cell) {
  return cell === null || cell === undefined || (typeof cell === "string" && cell.trim() === "");
}

/** Valor de la base → forma canónica. */
export function fromDb(col: ColumnSpec, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "int":
      return String(Math.round(Number(v)));
    case "num":
    case "pct":
      return numStr(Number(v), 6);
    case "money":
      return numStr(Number(v), 2);
    case "bool":
      return v === true || v === "true" ? "true" : "false";
    case "date":
      return isoToChileDate(String(v));
    case "datetime":
      return isoToChileDateTime(String(v));
    case "time":
      return String(v).slice(0, 5);
    case "code":
    case "enum":
      return String(v).trim().toLowerCase();
    default:
      return String(v).trim();
  }
}

/** Celda de Sheets → forma canónica, con validación. */
export function fromSheet(col: ColumnSpec, cell: Cell): Parsed {
  if (isEmpty(cell)) {
    if (col.required) return { error: `"${col.header}" es obligatorio` };
    return { value: "" };
  }
  switch (col.type) {
    case "id":
    case "ref": {
      const s = String(cell).trim().toLowerCase();
      return UUID.test(s) ? { value: s } : { error: `"${col.header}" debe ser un ID válido (cópialo de la hoja ${col.ref ?? ""})` };
    }
    case "int": {
      const n = parseNumber(cell);
      if (n === null || !Number.isInteger(round(n, 6))) return { error: `"${col.header}" debe ser un número entero` };
      if (col.edit && n < 0) return { error: `"${col.header}" no puede ser negativo` };
      return { value: String(Math.round(n)) };
    }
    case "num":
    case "money":
    case "pct": {
      const n = parseNumber(cell);
      if (n === null) return { error: `"${col.header}" debe ser un número` };
      // Columnas calculadas (no editables) pueden ser negativas o > 100 % (margen, markup).
      if (col.edit && n < 0) return { error: `"${col.header}" no puede ser negativo` };
      if (col.edit && col.type === "pct" && n >= 1) return { error: `"${col.header}" debe ser menor a 100%` };
      return { value: numStr(n, col.type === "money" ? 2 : 6) };
    }
    case "bool": {
      if (typeof cell === "boolean") return { value: String(cell) };
      const s = String(cell).trim().toLowerCase();
      if (["true", "verdadero", "si", "sí", "1", "x"].includes(s)) return { value: "true" };
      if (["false", "falso", "no", "0"].includes(s)) return { value: "false" };
      return { error: `"${col.header}" debe ser Sí o No` };
    }
    case "date": {
      if (typeof cell === "number") return { value: serialToDate(cell) };
      const s = String(cell).trim();
      let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (m && validYmd(+m[3], +m[2], +m[1])) return { value: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` };
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m && validYmd(+m[1], +m[2], +m[3])) return { value: s };
      return { error: `"${col.header}" debe ser una fecha DD-MM-AAAA` };
    }
    case "datetime": {
      if (typeof cell === "number") {
        const mins = Math.round((cell - Math.floor(cell)) * 1440);
        return { value: `${serialToDate(cell)} ${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}` };
      }
      return { value: String(cell).trim() };
    }
    case "time": {
      if (typeof cell === "number") {
        const mins = Math.round((cell % 1) * 24 * 60);
        return { value: `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}` };
      }
      const m = String(cell).trim().match(/^(\d{1,2}):(\d{2})/);
      if (m && +m[1] < 24 && +m[2] < 60) return { value: `${pad(+m[1])}:${m[2]}` };
      return { error: `"${col.header}" debe ser una hora HH:MM` };
    }
    case "month": {
      if (typeof cell === "number") return { value: serialToDate(cell).slice(0, 7) };
      const s = String(cell).trim();
      let m = s.match(/^(\d{4})-(\d{1,2})$/);
      if (m && +m[2] >= 1 && +m[2] <= 12) return { value: `${m[1]}-${pad(+m[2])}` };
      m = s.match(/^(\d{1,2})[-/](\d{4})$/);
      if (m && +m[1] >= 1 && +m[1] <= 12) return { value: `${m[2]}-${pad(+m[1])}` };
      return { error: `"${col.header}" debe ser un mes AAAA-MM` };
    }
    case "code": {
      const s = String(cell).trim().toLowerCase();
      return /^[a-z0-9_]+$/.test(s) ? { value: s } : { error: `"${col.header}" solo admite letras minúsculas sin tilde, números y _` };
    }
    case "enum": {
      const s = String(cell).trim().toLowerCase();
      if (col.options && !col.options.includes(s)) return { error: `"${col.header}" debe ser: ${col.options.join(", ")}` };
      return { value: s };
    }
    default:
      return { value: String(cell).trim() };
  }
}

/** Forma canónica → celda a escribir en Sheets (valueInputOption RAW). */
export function toSheet(col: ColumnSpec, v: string): Cell {
  if (v === "") return "";
  switch (col.type) {
    case "int":
    case "num":
    case "money":
    case "pct":
      return Number(v);
    case "bool":
      return v === "true";
    case "date":
      return dateToSerial(v);
    case "datetime": {
      const [d, t] = v.split(" ");
      const [h, mi] = (t ?? "00:00").split(":").map(Number);
      return dateToSerial(d) + (h * 60 + mi) / 1440;
    }
    case "time": {
      const [h, mi] = v.split(":").map(Number);
      return (h * 60 + mi) / 1440;
    }
    default:
      return v;
  }
}

/** Forma canónica → valor para escribir en la base. */
export function toDb(col: ColumnSpec, v: string): string | number | boolean | null {
  if (v === "") return null;
  switch (col.type) {
    case "int":
    case "num":
    case "money":
    case "pct":
      return Number(v);
    case "bool":
      return v === "true";
    default:
      return v;
  }
}
