/**
 * Detecta si Supabase está configurado.
 * Permite que la app corra en "modo demo" durante la Fase 1
 * mostrando datos de ejemplo hasta que Camila conecte su proyecto.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith("http") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes("tu-proyecto")
  );
}
