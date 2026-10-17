import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ANALYSIS, addSheetRequests, missingTabs, resolveFormula, setupRequests } from "@/lib/sync/setup";
import { SYNC_TABS } from "@/lib/sync/schema";

describe("Preparar matriz", () => {
  it("las fórmulas de la API son idénticas a las del .xlsx generado", () => {
    const xlsx = join(__dirname, "..", "..", "docs", "Matriz_Sarah_Tin.xlsx");
    const out = execFileSync("python", ["-c", `
import json,sys
from openpyxl import load_workbook
wb=load_workbook(sys.argv[1])
print(json.dumps({n:[wb[n].cell(row=2,column=c).value for c in range(1,15)] for n in sys.argv[2:]}))
`, xlsx, ...ANALYSIS.map((a) => a.name)], { encoding: "utf8" });
    const fromXlsx = JSON.parse(out) as Record<string, (string | null)[]>;
    for (const a of ANALYSIS) {
      const row2 = a.row_formulas ? a.row_formulas.map((f) => resolveFormula(f.replace(/\{r\}/g, "2"))) : a.array_formulas!.map((f) => (f ? resolveFormula(f) : null));
      row2.forEach((f, i) => expect(fromXlsx[a.name][i], `${a.name} col ${i + 1}`).toBe(f));
    }
  });

  it("crea solo las pestañas que faltan y es idempotente con las protecciones", () => {
    const meta = SYNC_TABS.slice(0, 3).map((t, i) => ({
      sheetId: i, title: t.name, rowCount: 1000, columnCount: 26,
      protectedRanges: [{ protectedRangeId: 99 + i, description: "sync: encabezados" }, { protectedRangeId: 500, description: "de César" }],
    }));
    const missing = missingTabs(meta);
    expect(missing).not.toContain(SYNC_TABS[0].name);
    expect(missing).toContain("Resumen_Mensual");
    expect(addSheetRequests(["Productos"])[0]).toMatchObject({ addSheet: { properties: { title: "Productos" } } });
    const req = setupRequests(meta, { createdTabs: [] }) as Record<string, any>[];
    const deletes = req.filter((r) => r.deleteProtectedRange).map((r) => r.deleteProtectedRange.protectedRangeId);
    expect(deletes).toEqual([99, 100, 101]); // nunca borra protecciones que no son de la sincronización
    expect(req.every((r) => !r.addProtectedRange || r.addProtectedRange.protectedRange.warningOnly)).toBe(true);
  });
});
