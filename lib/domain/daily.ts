/**
 * Resumen de un día, calculado solo con registros reales (nada estimado):
 * lo vendido, el dinero recibido (separado de lo vendido), gastos y pedidos.
 */
import type { Expense, Order, Payment, Sale, SaleItem } from "@/lib/data/types";
import { addDays, isSameDay, toDate } from "./dates";
import { isActive, totalReceivable } from "./finance";

export interface DaySummary {
  sold: number; // total de ventas del día (cobradas o no)
  salesCount: number;
  units: number;
  received: number; // dinero recibido neto (cobros + abonos + anticipos − reembolsos)
  refunds: number; // reembolsos del día (positivo)
  receivedByMethod: { method: string; amount: number }[];
  creditGiven: number; // parte de las ventas del día que quedó por cobrar
  expenses: number;
  ordersCreated: number;
  ordersDelivered: number;
  ordersDueNextDay: number;
  receivable: number; // total por cobrar a la fecha
  empty: boolean;
}

export function computeDay(
  data: { sales: Sale[]; saleItems: SaleItem[]; payments: Payment[]; expenses: Expense[]; orders: Order[] },
  day: Date
): DaySummary {
  const sales = data.sales.filter((s) => isActive(s) && isSameDay(s.sale_date, day));
  const saleIds = new Set(sales.map((s) => s.id));
  const pays = data.payments.filter((p) => isActive(p) && isSameDay(p.paid_at, day));
  const byMethod = new Map<string, number>();
  for (const p of pays) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
  const expenses = data.expenses.filter((e) => isActive(e) && isSameDay(e.expense_date, day));
  const next = addDays(toDate(day), 1);

  const sold = sales.reduce((s, x) => s + x.total, 0);
  const summary: DaySummary = {
    sold,
    salesCount: sales.length,
    units: data.saleItems.filter((it) => saleIds.has(it.sale_id)).reduce((s, it) => s + it.quantity, 0),
    received: pays.reduce((s, p) => s + p.amount, 0),
    refunds: -pays.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0),
    receivedByMethod: Array.from(byMethod, ([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    creditGiven: sales.reduce((s, x) => s + Math.max(x.total - x.paid_amount, 0), 0),
    expenses: expenses.reduce((s, e) => s + e.amount, 0),
    ordersCreated: data.orders.filter((o) => isSameDay(o.created_at, day)).length,
    ordersDelivered: data.orders.filter((o) => o.status === "entregado" && o.delivered_at && isSameDay(o.delivered_at, day)).length,
    ordersDueNextDay: data.orders.filter((o) => o.status !== "entregado" && o.status !== "cancelado" && isSameDay(o.order_date, next)).length,
    receivable: totalReceivable(data.sales),
    empty: false,
  };
  summary.empty = summary.salesCount === 0 && pays.length === 0 && expenses.length === 0 && summary.ordersCreated === 0 && summary.ordersDelivered === 0;
  return summary;
}
