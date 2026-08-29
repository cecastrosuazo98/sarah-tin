/**
 * Tipos de dominio de Sarah & Tin.
 * En Fase 1 se usan para tipar datos de ejemplo del dashboard.
 * En fases siguientes se alinean con las tablas de Supabase.
 */

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "debito"
  | "credito"
  | "fiado"
  | "otro";

export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export type PaymentStatus = "pagado" | "pendiente" | "abono";

/** Resumen para el dashboard. */
export type DashboardSummary = {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  expensesMonth: number;
  estimatedProfit: number;
  cashBalance: number;
  receivable: number;
  productsSoldToday: number;
  pendingOrders: number;
  monthGrowth: number | null; // fracción vs mes anterior
};

export type SalesPoint = {
  date: string; // ISO
  label: string;
  amount: number;
};

export type TopProduct = {
  id: string;
  name: string;
  units: number;
  revenue: number;
};

export type PendingCustomer = {
  id: string;
  name: string;
  amount: number;
};

export type UpcomingOrder = {
  id: string;
  code: string;
  customer: string;
  product: string;
  date: string; // ISO
  time: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
};

export type DashboardTip =
  | { type: "margin"; message: string }
  | { type: "inventory"; message: string }
  | { type: "receivable"; message: string };
