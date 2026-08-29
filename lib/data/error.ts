/** Extrae un mensaje legible de cualquier error (Error o PostgrestError de Supabase). */
export function getErrorMessage(e: unknown, fallback = "Ocurrió un error"): string {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    if (typeof anyE.message === "string" && anyE.message) return anyE.message as string;
    if (typeof anyE.error_description === "string") return anyE.error_description as string;
    if (typeof anyE.hint === "string" && anyE.hint) return anyE.hint as string;
    try {
      const s = JSON.stringify(e);
      if (s && s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}
