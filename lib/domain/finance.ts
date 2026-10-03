/**
 * Agregaciones: deudas y resumen del día.
 * Funciones puras sobre las filas del store.
 */
import type { Sale, Payment } from "@/lib/data/types";
import { inRange, isSameDay } from "./dates";

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

/** Total pagado por un cliente (historial). */
export function customerPaid(customerId: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.customer_id === customerId)
    .reduce((s, p) => s + p.amount, 0);
}

// ---------------- Vista "¿Qué pasó hoy?" ----------------

/** Lo que todavía debe una venta. */
export function saleDebt(sale: Sale): number {
  return Math.max(sale.total - sale.paid_amount, 0);
}

/**
 * Lo que se cobró al momento de vender en ventas antiguas, de antes de que
 * cada pago quedara registrado en `payments`. Esas ventas no tienen pagos
 * ligados; si no fueron fiadas, se pagaron completas ese día.
 */
function legacyPaidAtSale(sale: Sale, linkedSaleIds: Set<string>): number {
  if (linkedSaleIds.has(sale.id) || sale.method === "fiado") return 0;
  return Math.min(sale.paid_amount, sale.total);
}

export interface DaySummary {
  /** Ventas del día, más recientes primero. */
  sales: Sale[];
  /** Total vendido ese día. */
  sold: number;
  /** Dinero que entró ese día (ventas del día + pagos de deudas). */
  received: number;
  /** Parte de `received` que fue para pagar deudas de otros días. */
  receivedFromOldDebts: number;
  /** Lo que todavía deben de las ventas de ese día. */
  owed: number;
}

export function summarizeDay(day: Date, sales: Sale[], payments: Payment[]): DaySummary {
  const daySales = sales
    .filter((s) => isSameDay(s.sale_date, day))
    .sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date));
  const daySaleIds = new Set(daySales.map((s) => s.id));
  const linkedSaleIds = new Set(
    payments.filter((p) => p.sale_id).map((p) => p.sale_id as string)
  );

  const dayPayments = payments.filter((p) => isSameDay(p.paid_at, day));
  const fromPayments = dayPayments.reduce((s, p) => s + p.amount, 0);
  const receivedFromOldDebts = dayPayments
    .filter((p) => !p.sale_id || !daySaleIds.has(p.sale_id))
    .reduce((s, p) => s + p.amount, 0);
  const legacy = daySales.reduce((s, x) => s + legacyPaidAtSale(x, linkedSaleIds), 0);

  return {
    sales: daySales,
    sold: daySales.reduce((s, x) => s + x.total, 0),
    received: fromPayments + legacy,
    receivedFromOldDebts,
    owed: daySales.reduce((s, x) => s + saleDebt(x), 0),
  };
}
