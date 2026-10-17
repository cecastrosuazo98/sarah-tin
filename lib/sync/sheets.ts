/**
 * Cliente mínimo de Google Sheets API v4 con cuenta de servicio (solo servidor).
 * Las credenciales vienen de variables de entorno; nunca llegan al navegador.
 */
import { createSign } from "node:crypto";
import type { Cell } from "./values";

export interface SheetsPort {
  /** Lee la hoja completa (incluye encabezado). Números y fechas sin formato. */
  read(tab: string, lastCol: string): Promise<Cell[][]>;
  /** Lee varias hojas en UNA llamada (cuida la cuota de Google). */
  readMany(tabs: { tab: string; lastCol: string }[]): Promise<Cell[][][]>;
  /** Escribe varios rangos en una sola llamada (valores RAW, sin fórmulas). */
  write(data: { range: string; values: Cell[][] }[]): Promise<void>;
  /** Agrega filas al final de la tabla. */
  append(tab: string, lastCol: string, values: Cell[][]): Promise<void>;
}

export interface SheetMeta {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
  protectedRanges: { protectedRangeId: number; description?: string }[];
}

export function colLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function a1(tab: string, range: string) {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GoogleConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

export function googleConfigFromEnv(): GoogleConfig | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!clientEmail || !privateKey || !spreadsheetId) return null;
  return { clientEmail, privateKey, spreadsheetId };
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export class GoogleSheets implements SheetsPort {
  private token: { value: string; exp: number } | null = null;

  constructor(private cfg: GoogleConfig, private fetchImpl: typeof fetch = fetch) {}

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return this.token.value;
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({
      iss: this.cfg.clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const jwt = `${header}.${claims}.${b64url(signer.sign(this.cfg.privateKey))}`;
    const res = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!res.ok) throw new Error(`Google rechazó la cuenta de servicio (${res.status}). Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY.`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, exp: now + json.expires_in };
    return json.access_token;
  }

  /** Llamada con reintentos ante límites de cuota o errores temporales. */
  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.cfg.spreadsheetId}${path}`;
    let last = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await this.fetchImpl(url, {
        ...init,
        headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (res.ok) return (await res.json()) as T;
      last = `${res.status} ${(await res.text()).slice(0, 300)}`;
      if (res.status === 403) throw new Error(`Sin permiso sobre la matriz: comparte la planilla como Editor con ${this.cfg.clientEmail}.`);
      if (res.status === 404) throw new Error("No se encontró la matriz: revisa GOOGLE_SHEET_ID.");
      if (![429, 500, 502, 503, 504].includes(res.status)) break;
      await sleep(500 * 2 ** attempt);
    }
    throw new Error(`Error de Google Sheets: ${last}`);
  }

  async read(tab: string, lastCol: string): Promise<Cell[][]> {
    const r = await this.call<{ values?: Cell[][] }>(
      `/values/${encodeURIComponent(a1(tab, `A1:${lastCol}`))}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
    return r.values ?? [];
  }

  async readMany(tabs: { tab: string; lastCol: string }[]): Promise<Cell[][][]> {
    if (!tabs.length) return [];
    const qs = tabs.map((t) => `ranges=${encodeURIComponent(a1(t.tab, `A1:${t.lastCol}`))}`).join("&");
    const r = await this.call<{ valueRanges?: { values?: Cell[][] }[] }>(
      `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
    return tabs.map((_, i) => r.valueRanges?.[i]?.values ?? []);
  }

  async write(data: { range: string; values: Cell[][] }[]): Promise<void> {
    if (!data.length) return;
    for (let i = 0; i < data.length; i += 200) {
      await this.call(`/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data: data.slice(i, i + 200) }),
      });
    }
  }

  /** Pestañas existentes (título, id numérico, filas) y rangos protegidos. */
  async meta(): Promise<SheetMeta[]> {
    const r = await this.call<{ sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } }; protectedRanges?: { protectedRangeId: number; description?: string }[] }[] }>(
      `?fields=${encodeURIComponent("sheets.properties.sheetId,sheets.properties.title,sheets.properties.gridProperties,sheets.protectedRanges.protectedRangeId,sheets.protectedRanges.description")}`);
    return r.sheets.map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties.rowCount,
      columnCount: s.properties.gridProperties.columnCount,
      protectedRanges: s.protectedRanges ?? [],
    }));
  }

  async batchUpdate(requests: unknown[]): Promise<void> {
    if (!requests.length) return;
    await this.call(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  }

  async append(tab: string, lastCol: string, values: Cell[][]): Promise<void> {
    if (!values.length) return;
    await this.call(
      `/values/${encodeURIComponent(a1(tab, `A1:${lastCol}`))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) });
  }
}
