/**
 * Búsqueda robusta: sin distinguir mayúsculas/minúsculas ni tildes, y por
 * palabras (cada palabra de la búsqueda debe aparecer en algún campo).
 */

/** Minúsculas y sin tildes/diacríticos: "Azúcar" -> "azucar". */
export function normalize(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Devuelve true si TODAS las palabras de `query` aparecen en la combinación
 * de `fields`. Si la búsqueda está vacía, devuelve true (no filtra).
 */
export function matchesSearch(
  query: string,
  ...fields: (string | null | undefined | number)[]
): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const haystack = fields.map((f) => normalize(f)).join(" ");
  return q.split(/\s+/).every((token) => haystack.includes(token));
}
