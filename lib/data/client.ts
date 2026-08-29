/** Selección del adaptador de datos y operaciones genéricas. */
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalAdapter } from "./local-adapter";
import { SupabaseAdapter } from "./supabase-adapter";
import type { DataAdapter } from "./adapter";
import { emitChange } from "./bus";

let adapter: DataAdapter | null = null;

export function getAdapter(): DataAdapter {
  if (!adapter) {
    adapter = isSupabaseConfigured() ? new SupabaseAdapter() : new LocalAdapter();
  }
  return adapter;
}

export function usingSupabase(): boolean {
  return isSupabaseConfigured();
}

// ---- Operaciones genéricas (emiten cambio para revalidar la UI) ----

export function list<T>(table: string): Promise<T[]> {
  return getAdapter().list<T>(table);
}

export async function create<T>(
  table: string,
  row: Record<string, unknown>
): Promise<T> {
  const res = await getAdapter().insert<T>(table, row);
  emitChange();
  return res;
}

export async function update<T>(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<T> {
  const res = await getAdapter().update<T>(table, id, patch);
  emitChange();
  return res;
}

export async function remove(table: string, id: string): Promise<void> {
  await getAdapter().remove(table, id);
  emitChange();
}

export async function createSilent<T>(
  table: string,
  row: Record<string, unknown>
): Promise<T> {
  // Para operaciones compuestas: no emite en cada paso.
  return getAdapter().insert<T>(table, row);
}

export async function updateSilent<T>(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<T> {
  return getAdapter().update<T>(table, id, patch);
}
