/** Adaptador de datos sobre Supabase (se activa cuando hay credenciales). */
import { createClient } from "@/lib/supabase/client";
import { DataAdapter } from "./adapter";

/** Registra el error en consola con contexto y lo relanza. */
function fail(op: string, table: string, error: unknown): never {
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  // eslint-disable-next-line no-console
  console.error(
    `[Supabase] ${op} en "${table}" falló:`,
    e?.message ?? error,
    { code: e?.code, details: e?.details, hint: e?.hint }
  );
  throw error;
}

export class SupabaseAdapter implements DataAdapter {
  private supabase = createClient();
  private ownerId: string | null = null;

  private async getOwnerId(): Promise<string> {
    if (this.ownerId) return this.ownerId;
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Tu sesión expiró. Cierra sesión y vuelve a entrar.");
    this.ownerId = user.id;
    return user.id;
  }

  async list<T = Record<string, unknown>>(table: string): Promise<T[]> {
    // Sin ordenar: no todas las tablas tienen `created_at` (ordenar por una
    // columna inexistente da 400). Cada página ordena lo que necesita, igual
    // que en modo local.
    const { data, error } = await this.supabase.from(table).select("*");
    if (error) fail("list", table, error);
    return (data ?? []) as T[];
  }

  async insert<T = Record<string, unknown>>(
    table: string,
    row: Record<string, unknown>
  ): Promise<T> {
    const owner_id = await this.getOwnerId();
    const { data, error } = await this.supabase
      .from(table)
      .insert({ ...row, owner_id })
      .select()
      .single();
    if (error) fail("insert", table, error);
    return data as T;
  }

  async update<T = Record<string, unknown>>(
    table: string,
    id: string,
    patch: Record<string, unknown>
  ): Promise<T> {
    const { data, error } = await this.supabase
      .from(table)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) fail("update", table, error);
    return data as T;
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await this.supabase.from(table).delete().eq("id", id);
    if (error) fail("remove", table, error);
  }

  async seedIfEmpty(): Promise<void> {
    // En Supabase los datos son reales: no se siembran datos de ejemplo.
    return;
  }
}
