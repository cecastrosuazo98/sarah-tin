import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { fromSheet, fromDb, toSheet, parseNumber, dateToSerial, serialToDate } from "@/lib/sync/values";
import { GoogleSheets, colLetter } from "@/lib/sync/sheets";
import type { ColumnSpec } from "@/lib/sync/schema";

const col = (type: ColumnSpec["type"], extra: Partial<ColumnSpec> = {}): ColumnSpec => ({ key: "x", header: "X", type, edit: true, ...extra });

describe("valores chilenos", () => {
  it("números con punto de miles y coma decimal", () => {
    expect(parseNumber("1.500")).toBe(1500);
    expect(parseNumber("$ 12.990")).toBe(12990);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("60%")).toBe(0.6);
    expect(parseNumber("abc")).toBeNull();
  });

  it("fechas DD-MM-AAAA, número de serie de Sheets e ISO", () => {
    expect(fromSheet(col("date"), "17-10-2026")).toEqual({ value: "2026-10-17" });
    expect(fromSheet(col("date"), dateToSerial("2026-10-17"))).toEqual({ value: "2026-10-17" });
    expect(serialToDate(dateToSerial("2026-02-28"))).toBe("2026-02-28");
    expect(fromSheet(col("date"), "31-02-2026")).toHaveProperty("error");
    // Un timestamp UTC de madrugada pertenece al día anterior en Chile.
    expect(fromDb(col("date"), "2026-10-17T02:00:00Z")).toBe("2026-10-16");
  });

  it("validaciones con mensajes claros", () => {
    expect(fromSheet(col("money", { header: "Precio" }), "-5")).toEqual({ error: '"Precio" no puede ser negativo' });
    expect(fromSheet(col("pct", { header: "Margen" }), "120%")).toHaveProperty("error");
    expect(fromSheet(col("text", { header: "Nombre", required: true }), " ")).toEqual({ error: '"Nombre" es obligatorio' });
    expect(fromSheet(col("enum", { options: ["g", "ml"] }), "KG")).toHaveProperty("error");
    expect(fromSheet(col("bool"), "Sí")).toEqual({ value: "true" });
    expect(fromSheet(col("ref"), "no-es-id")).toHaveProperty("error");
  });

  it("textos que parecen fórmulas se guardan como texto", () => {
    expect(toSheet(col("text"), "=IMPORTXML(1)")).toBe("=IMPORTXML(1)");
  });

  it("letras de columna", () => {
    expect([colLetter(1), colLetter(26), colLetter(27), colLetter(52)]).toEqual(["A", "Z", "AA", "AZ"]);
  });
});

describe("cliente Google Sheets", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  function fakeFetch(script: { status: number; body: unknown }[]) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      const next = script.shift() ?? { status: 200, body: {} };
      return new Response(JSON.stringify(next.body), { status: next.status });
    }) as unknown as typeof fetch;
    return { fn, calls };
  }

  it("firma un JWT válido con la clave de la cuenta de servicio y usa el token", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { values: [["ID"]] } }]);
    const g = new GoogleSheets({ clientEmail: "sync@proyecto.iam.gserviceaccount.com", privateKey, spreadsheetId: "SHEET" }, fn);
    expect(await g.read("Productos", "C")).toEqual([["ID"]]);
    const assertion = new URLSearchParams(String(calls[0].init.body)).get("assertion")!;
    const [h, p, s] = assertion.split(".");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets");
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(calls[1].url).toContain("valueRenderOption=UNFORMATTED_VALUE");
  });

  it("reintenta ante límite de cuota (429) y luego funciona", async () => {
    const { fn, calls } = fakeFetch([{ status: 429, body: {} }, { status: 503, body: {} }, { status: 200, body: {} }]);
    const g = new GoogleSheets({ clientEmail: "x@y", privateKey, spreadsheetId: "S" }, fn);
    await g.write([{ range: "'A'!A1", values: [[1]] }]);
    expect(calls.filter((c) => !c.url.includes("oauth2")).length).toBe(3);
    const body = JSON.parse(String(calls[calls.length - 1].init.body));
    expect(body.valueInputOption).toBe("RAW");
  });

  it("sin permiso explica qué compartir", async () => {
    const { fn } = fakeFetch([{ status: 403, body: {} }]);
    const g = new GoogleSheets({ clientEmail: "sync@p.iam", privateKey, spreadsheetId: "S" }, fn);
    await expect(g.read("A", "B")).rejects.toThrow(/comparte la planilla como Editor con sync@p.iam/);
  });
});
