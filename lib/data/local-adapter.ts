/** Adaptador de datos sobre localStorage (modo local-first, sin conexión). */
import { DataAdapter, newId } from "./adapter";

const PREFIX = "sarahtin_v1_";
const SEED_FLAG = "sarahtin_v1_seeded";

function read<T>(table: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + table);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(table: string, rows: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + table, JSON.stringify(rows));
}

export class LocalAdapter implements DataAdapter {
  async list<T = Record<string, unknown>>(table: string): Promise<T[]> {
    return read<T>(table);
  }

  async insert<T = Record<string, unknown>>(
    table: string,
    row: Record<string, unknown>
  ): Promise<T> {
    const rows = read<Record<string, unknown>>(table);
    const full = {
      id: newId(),
      owner_id: "local",
      created_at: new Date().toISOString(),
      ...row,
    };
    rows.push(full);
    write(table, rows);
    return full as T;
  }

  async update<T = Record<string, unknown>>(
    table: string,
    id: string,
    patch: Record<string, unknown>
  ): Promise<T> {
    const rows = read<Record<string, unknown>>(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("No encontrado");
    rows[idx] = { ...rows[idx], ...patch };
    write(table, rows);
    return rows[idx] as T;
  }

  async remove(table: string, id: string): Promise<void> {
    const rows = read<Record<string, unknown>>(table).filter((r) => r.id !== id);
    write(table, rows);
  }

  async seedIfEmpty(
    data: Record<string, Record<string, unknown>[]>
  ): Promise<void> {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SEED_FLAG)) return;
    for (const [table, rows] of Object.entries(data)) {
      if (read(table).length === 0) write(table, rows);
    }
    window.localStorage.setItem(SEED_FLAG, "1");
  }
}
