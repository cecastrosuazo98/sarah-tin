/** Utilidades de fechas para filtros y agregaciones. */

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
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function inRange(date: string | Date, from: Date, to: Date): boolean {
  const t = new Date(date).getTime();
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
