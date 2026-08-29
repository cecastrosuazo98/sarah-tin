/** Adaptador de datos sobre Supabase (se activa cuando hay credenciales). */
import { createClient } from "@/lib/supabase/client";
import { DataAdapter } from "./adapter";

export class SupabaseAdapter implements DataAdapter {
  private supabase = createClient();
  private ownerId: string | null = null;

  private async getOwnerId(): Promise<string> {
    if (this.ownerId) return this.ownerId;
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Sesión no encontrada");
    this.ownerId = user.id;
    return user.id;
  }

  async list<T = Record<string, unknown>>(table: string): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
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
    if (error) throw error;
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
    if (error) throw error;
    return data as T;
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await this.supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  async seedIfEmpty(): Promise<void> {
    // En Supabase los datos son reales: no se siembran datos de ejemplo.
    return;
  }
}
