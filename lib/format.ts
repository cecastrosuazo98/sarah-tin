/**
 * Utilidades de formato para Sarah & Tin.
 * Moneda inicial: CLP (peso chileno), formato $1.000 / $25.000 / $1.250.000.
 * Construido para poder cambiar de moneda a futuro cambiando estas constantes.
 */

export const CURRENCY = {
  code: "CLP",
  locale: "es-CL",
  symbol: "$",
} as const;

/** Formatea un número como moneda CLP: 25000 -> "$25.000" */
export function formatMoney(
  value: number | null | undefined,
  options?: { withSymbol?: boolean }
): string {
  const withSymbol = options?.withSymbol ?? true;
  const amount = Number.isFinite(value as number) ? (value as number) : 0;
  const formatted = new Intl.NumberFormat(CURRENCY.locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return withSymbol ? `${CURRENCY.symbol}${formatted}` : formatted;
}

/** Formatea un porcentaje: 0.5775 -> "57,8%" (recibe fracción) */
export function formatPercent(fraction: number | null | undefined, decimals = 1): string {
  const value = Number.isFinite(fraction as number) ? (fraction as number) : 0;
  return `${(value * 100).toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Formatea una cantidad con su unidad: 8.5, "kg" -> "8,5 kg" */
export function formatQuantity(value: number, unit?: string): string {
  const formatted = value.toLocaleString(CURRENCY.locale, {
    maximumFractionDigits: 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Fecha corta legible: "28 ago" */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(CURRENCY.locale, { day: "numeric", month: "short" });
}

/** Fecha completa: "jueves 28 de agosto" */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(CURRENCY.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Saludo según la hora del día. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}
