/**
 * Planificación del día: qué preparar (pedidos + lo que se suele vender ese
 * día de la semana + menú) y en qué orden mostrar los productos al vender.
 * Funciones puras sobre las filas del store.
 */
import type { Order, OrderItem, Product, Sale, SaleItem } from "@/lib/data/types";
import { normalize } from "@/lib/search";
import { addDays, startOfDay, toDate, toYmd } from "./dates";

/** Días de la semana, en el orden de `Date.getDay()` (0 = domingo). */
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Orden para mostrar la semana: de lunes a domingo. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "los sábados", "los lunes"… */
export function weekdayPlural(weekday: number): string {
  const name = WEEKDAYS[weekday].toLowerCase();
  return `los ${name.endsWith("s") ? name : `${name}s`}`;
}

export function inMenu(product: Product, weekday: number): boolean {
  return (product.sale_days ?? []).includes(weekday);
}

/** Clave para juntar un ítem con su producto (o por nombre, si no tiene). */
const keyOf = (productId: string | null, name: string) => productId ?? `n:${normalize(name).trim()}`;

/** Semanas hacia atrás que se miran para calcular "lo que sueles vender". */
const WEEKS_BACK = 8;

/**
 * Unidades que se suelen vender de cada producto ese día de la semana:
 * promedio de los mismos días (con ventas) de las últimas semanas.
 * No cuenta las ventas que vienen de pedidos (esas ya se planifican aparte).
 */
export function usualByWeekday(
  weekday: number,
  sales: Sale[],
  saleItems: SaleItem[],
  before: Date
): Map<string, number> {
  const to = startOfDay(before);
  const from = addDays(to, -7 * WEEKS_BACK);
  const daySales = sales.filter((s) => {
    const d = toDate(s.sale_date);
    return d >= from && d < to && d.getDay() === weekday && !(s.notes ?? "").startsWith("Pedido ");
  });
  const workedDays = new Set(daySales.map((s) => toYmd(toDate(s.sale_date)))).size;
  const result = new Map<string, number>();
  if (workedDays === 0) return result;

  const ids = new Set(daySales.map((s) => s.id));
  for (const it of saleItems) {
    if (!ids.has(it.sale_id)) continue;
    const k = keyOf(it.product_id, it.name_snapshot);
    result.set(k, (result.get(k) ?? 0) + it.quantity);
  }
  for (const [k, units] of result) result.set(k, units / workedDays);
  return result;
}

export interface PlanRow {
  key: string;
  name: string;
  category: string | null;
  /** Unidades de pedidos para entregar ese día. */
  fromOrders: number;
  /** Lo que se suele vender ese día de la semana (redondeado). */
  usual: number;
  /** Está en el menú de ese día. */
  menu: boolean;
}

/** Qué preparar un día: pedidos + lo que se suele vender + menú. */
export function dayPlan(params: {
  day: Date;
  now: Date;
  orders: Order[];
  orderItems: OrderItem[];
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
}): { rows: PlanRow[]; orderCount: number } {
  const { day, now, orders, orderItems, products, sales, saleItems } = params;
  const weekday = day.getDay();
  const ymd = toYmd(day);
  const isToday = ymd === toYmd(now);
  const rows = new Map<string, PlanRow>();
  const byName = new Map(products.map((p) => [normalize(p.name).trim(), p]));

  const rowFor = (productId: string | null, name: string): PlanRow => {
    const product =
      (productId && products.find((p) => p.id === productId)) || byName.get(normalize(name).trim());
    const key = keyOf(product?.id ?? productId, product?.name ?? name);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        name: product?.name ?? name,
        category: product?.category ?? null,
        fromOrders: 0,
        usual: 0,
        menu: false,
      };
      rows.set(key, row);
    }
    return row;
  };

  // Pedidos de ese día (y, si es hoy, también los atrasados).
  const dayOrders = orders.filter(
    (o) =>
      o.status !== "entregado" &&
      o.status !== "cancelado" &&
      (o.order_date === ymd || (isToday && o.order_date < ymd))
  );
  const orderIds = new Set(dayOrders.map((o) => o.id));
  for (const it of orderItems) {
    if (orderIds.has(it.order_id)) rowFor(it.product_id, it.name_snapshot).fromOrders += it.quantity;
  }

  // Lo que se suele vender ese día de la semana.
  const usual = usualByWeekday(weekday, sales, saleItems, isToday || day < now ? day : now);
  for (const [key, avg] of usual) {
    const units = Math.round(avg);
    if (units < 1) continue;
    const product = products.find((p) => p.id === key);
    if (product && !product.is_active) continue;
    const name =
      product?.name ?? saleItems.find((it) => keyOf(it.product_id, it.name_snapshot) === key)?.name_snapshot ?? "";
    if (!name) continue;
    rowFor(product?.id ?? null, name).usual = units;
  }

  // Menú del día.
  for (const p of products) {
    if (p.is_active && inMenu(p, weekday)) rowFor(p.id, p.name).menu = true;
  }

  const list = Array.from(rows.values()).sort(
    (a, b) =>
      b.fromOrders - a.fromOrders ||
      b.usual - a.usual ||
      Number(b.menu) - Number(a.menu) ||
      a.name.localeCompare(b.name)
  );
  return { rows: list, orderCount: dayOrders.length };
}

/**
 * Orden de los productos al registrar una venta: primero el menú del día,
 * después lo que más se vende ese día de la semana y luego lo más vendido.
 */
export function sortForSelling(
  products: Product[],
  sales: Sale[],
  saleItems: SaleItem[],
  now: Date
): { sorted: Product[]; usual: Map<string, number> } {
  const weekday = now.getDay();
  const usual = usualByWeekday(weekday, sales, saleItems, now);
  const total = new Map<string, number>();
  for (const it of saleItems) {
    if (it.product_id) total.set(it.product_id, (total.get(it.product_id) ?? 0) + it.quantity);
  }
  const sorted = [...products].sort(
    (a, b) =>
      Number(inMenu(b, weekday)) - Number(inMenu(a, weekday)) ||
      (usual.get(b.id) ?? 0) - (usual.get(a.id) ?? 0) ||
      (total.get(b.id) ?? 0) - (total.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name)
  );
  return { sorted, usual };
}
