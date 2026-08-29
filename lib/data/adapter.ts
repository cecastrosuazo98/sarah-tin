/** Interfaz común de acceso a datos (implementada por localStorage y Supabase). */

export interface DataAdapter {
  list<T = Record<string, unknown>>(table: string): Promise<T[]>;
  insert<T = Record<string, unknown>>(
    table: string,
    row: Record<string, unknown>
  ): Promise<T>;
  update<T = Record<string, unknown>>(
    table: string,
    id: string,
    patch: Record<string, unknown>
  ): Promise<T>;
  remove(table: string, id: string): Promise<void>;
  /** Inserta datos de ejemplo si el store está vacío (solo primera vez). */
  seedIfEmpty(data: Record<string, Record<string, unknown>[]>): Promise<void>;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
