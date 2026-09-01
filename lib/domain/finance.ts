/**
 * Agregaciones financieras: dashboard, deudas, rentabilidad.
 * Funciones puras sobre las filas del store.
 */
import type {
  Sale,
  SaleItem,
  Expense,
  Customer,
  Payment,
} from "@/lib/data/types";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  addDays,
  inRange,
  isSameDay,
} from "./dates";

export function sumInRange(
  sales: Sale[],
  from: Date,
  to: Date
): number {
  return sales
    .filter((s) => inRange(s.sale_date, from, to))
    .reduce((sum, s) => sum + s.total, 0);
}

/** Deuda pendiente total de un cliente (suma de saldos no pagados). */
export function customerDebt(customerId: string, sales: Sale[]): number {
  return sales
    .filter((s) => s.customer_id === customerId && s.status !== "pagado")
    .reduce((sum, s) => sum + Math.max(s.total - s.paid_amount, 0), 0);
}

/** Deuda pendiente total (todos los clientes). */
export function totalReceivable(sales: Sale[]): number {
  return sales
    .filter((s) => s.status !== "pagado")
    .reduce((sum, s) => sum + Math.max(s.total - s.paid_amount, 0), 0);
}

export interface DashboardData {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  expensesMonth: number;
  estimatedProfit: number;
  receivable: number;
  productsSoldToday: number;
  monthGrowth: number | null;
}

export function computeDashboard(params: {
  sales: Sale[];
  saleItems: SaleItem[];
  expenses: Expense[];
}): DashboardData {
  const { sales, saleItems, expenses } = params;
  const now = new Date();
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const today = { from: startOfDay(now), to: endToday };
  const week = { from: startOfWeek(now), to: endToday };
  const month = { from: startOfMonth(now), to: endToday };

  const salesToday = sumInRange(sales, today.from, today.to);
  const salesWeek = sumInRange(sales, week.from, week.to);
  const salesMonth = sumInRange(sales, month.from, month.to);

  const expensesMonth = expenses
    .filter((e) => inRange(e.expense_date, month.from, month.to))
    .reduce((s, e) => s + e.amount, 0);

  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const salesPrevMonth = sumInRange(sales, prevFrom, prevTo);
  const monthGrowth =
    salesPrevMonth > 0 ? (salesMonth - salesPrevMonth) / salesPrevMonth : null;

  const todaySaleIds = new Set(
    sales.filter((s) => isSameDay(s.sale_date, now)).map((s) => s.id)
  );
  const productsSoldToday = saleItems
    .filter((it) => todaySaleIds.has(it.sale_id))
    .reduce((s, it) => s + it.quantity, 0);

  return {
    salesToday,
    salesWeek,
    salesMonth,
    expensesMonth,
    estimatedProfit: salesMonth - expensesMonth,
    receivable: totalReceivable(sales),
    productsSoldToday,
    monthGrowth,
  };
}

export interface SalesPoint {
  date: string;
  label: string;
  amount: number;
}

/** Ventas por día de los últimos N días. */
export function salesByDay(sales: Sale[], days = 7): SalesPoint[] {
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const now = new Date();
  const points: SalesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i);
    const amount = sales
      .filter((s) => isSameDay(s.sale_date, d))
      .reduce((sum, s) => sum + s.total, 0);
    points.push({ date: d.toISOString(), label: dayLabels[d.getDay()], amount });
  }
  return points;
}

export interface TopProduct {
  id: string;
  name: string;
  units: number;
  revenue: number;
}

export function topProducts(
  saleItems: SaleItem[],
  limit = 5,
  saleIds?: Set<string>
): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const it of saleItems) {
    if (saleIds && !saleIds.has(it.sale_id)) continue;
    const key = it.product_id ?? it.name_snapshot;
    const cur = map.get(key) ?? {
      id: key,
      name: it.name_snapshot,
      units: 0,
      revenue: 0,
    };
    cur.units += it.quantity;
    cur.revenue += it.line_total;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface PendingCustomer {
  id: string;
  name: string;
  amount: number;
}

export function pendingCustomers(
  customers: Customer[],
  sales: Sale[]
): PendingCustomer[] {
  return customers
    .map((c) => ({ id: c.id, name: c.name, amount: customerDebt(c.id, sales) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Total pagado por un cliente (historial). */
export function customerPaid(customerId: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.customer_id === customerId)
    .reduce((s, p) => s + p.amount, 0);
}
