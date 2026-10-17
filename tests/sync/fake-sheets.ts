/** Google Sheets en memoria, con el mismo comportamiento de lectura/escritura que usa el motor. */
import type { SheetsPort } from "@/lib/sync/sheets";
import type { Cell } from "@/lib/sync/values";

function colIndex(letters: string) {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function parseRange(range: string) {
  const m = range.match(/^'(.+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) throw new Error(`Rango no soportado: ${range}`);
  return { tab: m[1].replace(/''/g, "'"), c0: colIndex(m[2]), r0: Number(m[3]) - 1 };
}

export class FakeSheets implements SheetsPort {
  tabs = new Map<string, Cell[][]>();
  calls = { read: 0, write: 0, append: 0, cellsWritten: 0 };
  /** La próxima escritura que toque esta hoja falla (simula corte de red). */
  failNextWriteOn: string | null = null;
  lastWrites: string[] = [];

  grid(tab: string) {
    if (!this.tabs.has(tab)) this.tabs.set(tab, []);
    return this.tabs.get(tab)!;
  }

  async read(tab: string): Promise<Cell[][]> {
    this.calls.read++;
    const g = this.grid(tab);
    // Como la API: sin filas vacías al final y sin celdas vacías al final de cada fila.
    const rows = g.map((r) => {
      const copy = [...r];
      while (copy.length && (copy[copy.length - 1] === "" || copy[copy.length - 1] == null)) copy.pop();
      return copy;
    });
    while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
    return rows;
  }

  async readMany(tabs: { tab: string; lastCol: string }[]): Promise<Cell[][][]> {
    if (!tabs.length) return [];
    const out: Cell[][][] = [];
    for (const t of tabs) out.push(await this.read(t.tab));
    this.calls.read -= tabs.length - 1; // una sola llamada a la API
    return out;
  }

  async write(data: { range: string; values: Cell[][] }[]) {
    if (!data.length) return;
    if (this.failNextWriteOn && data.some((d) => parseRange(d.range).tab === this.failNextWriteOn)) {
      this.failNextWriteOn = null;
      throw new Error("Error de red simulado");
    }
    this.lastWrites.push(...data.map((d) => d.range));
    this.calls.write++;
    for (const d of data) {
      const { tab, c0, r0 } = parseRange(d.range);
      const g = this.grid(tab);
      d.values.forEach((row, i) => {
        while (g.length <= r0 + i) g.push([]);
        row.forEach((v, j) => {
          const r = g[r0 + i];
          while (r.length <= c0 + j) r.push("");
          r[c0 + j] = v;
          this.calls.cellsWritten++;
        });
      });
    }
  }

  async append(tab: string, _lastCol: string, values: Cell[][]) {
    this.calls.append++;
    const g = this.grid(tab);
    while (g.length && g[g.length - 1].every((v) => v === "" || v == null)) g.pop();
    for (const v of values) g.push([...v]);
  }

  /** Helpers para las pruebas: editar como lo haría una persona. */
  header(tab: string) {
    return this.grid(tab)[0].map(String);
  }
  findRow(tab: string, col: string, value: Cell) {
    const idx = this.header(tab).indexOf(col);
    return this.grid(tab).findIndex((r, i) => i > 0 && r[idx] === value);
  }
  get(tab: string, row: number, col: string) {
    return this.grid(tab)[row][this.header(tab).indexOf(col)];
  }
  set(tab: string, row: number, col: string, value: Cell) {
    const r = this.grid(tab)[row];
    const idx = this.header(tab).indexOf(col);
    while (r.length <= idx) r.push("");
    r[idx] = value;
  }
  addRow(tab: string, values: Record<string, Cell>) {
    const h = this.header(tab);
    this.grid(tab).push(h.map((name) => values[name] ?? ""));
    return this.grid(tab).length - 1;
  }
}
