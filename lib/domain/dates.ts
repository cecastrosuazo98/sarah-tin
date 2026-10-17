/** Utilidades de fechas para filtros y agregaciones (hora local del dispositivo). */

/**
 * Convierte a Date. Una fecha sola "AAAA-MM-DD" se interpreta como día local
 * (new Date("2026-10-17") sería medianoche UTC = 16-10 a las 21:00 en Chile).
 */
export function toDate(v: Date | string): Date {
  if (v instanceof Date) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
}

/** Fecha local de hoy como AAAA-MM-DD. */
export function localToday(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Días calendario desde hoy hasta la fecha (0 = hoy, negativo = atrasado). */
export function daysUntil(date: string | Date, now = new Date()): number {
  return Math.round((startOfDay(toDate(date)).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** DD-MM-AAAA */
export function formatDMY(date: string | Date): string {
  const d = toDate(date);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d = new Date()): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = toDate(a);
  const db = toDate(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function inRange(date: string | Date, from: Date, to: Date): boolean {
  const t = toDate(date).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export type RangeKey = "hoy" | "semana" | "mes" | "mes_anterior" | "todo";

export function resolveRange(key: RangeKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (key) {
    case "hoy":
      return { from: startOfDay(now), to: end, label: "Hoy" };
    case "semana":
      return { from: startOfWeek(now), to: end, label: "Esta semana" };
    case "mes":
      return { from: startOfMonth(now), to: end, label: "Este mes" };
    case "mes_anterior": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to, label: "Mes anterior" };
    }
    case "todo":
      return { from: new Date(0), to: end, label: "Todo el tiempo" };
  }
}
