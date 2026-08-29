/**
 * DATOS DE EJEMPLO — Sarah & Tin (Fase 1).
 *
 * Estos datos son ficticios y sirven solo para mostrar cómo se verá el
 * dashboard mientras Camila conecta Supabase y carga información real.
 * Cuando la app esté conectada, estos datos se reemplazan por consultas reales.
 *
 * Para vaciar la demo: no se usa una vez `isSupabaseConfigured()` es true.
 */

import type {
  DashboardSummary,
  SalesPoint,
  TopProduct,
  PendingCustomer,
  UpcomingOrder,
  DashboardTip,
} from "@/types";

export const DEMO_SUMMARY: DashboardSummary = {
  salesToday: 45000,
  salesWeek: 214500,
  salesMonth: 812000,
  expensesMonth: 298500,
  estimatedProfit: 513500,
  cashBalance: 47000,
  receivable: 25000,
  productsSoldToday: 12,
  pendingOrders: 3,
  monthGrowth: 0.18,
};

/** Ventas de los últimos 7 días. */
export const DEMO_SALES_7D: SalesPoint[] = (() => {
  const amounts = [28000, 41000, 19000, 52000, 36000, 48000, 45000];
  const days = ["Vie", "Sáb", "Dom", "Lun", "Mar", "Mié", "Jue"];
  const today = new Date();
  return amounts.map((amount, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (amounts.length - 1 - i));
    return { date: d.toISOString(), label: days[i], amount };
  });
})();

export const DEMO_TOP_PRODUCTS: TopProduct[] = [
  { id: "p1", name: "Torta de chocolate", units: 8, revenue: 200000 },
  { id: "p2", name: "Queque tradicional", units: 24, revenue: 48000 },
  { id: "p3", name: "Cupcakes", units: 30, revenue: 45000 },
  { id: "p4", name: "Galletas decoradas", units: 40, revenue: 32000 },
];

export const DEMO_PENDING_CUSTOMERS: PendingCustomer[] = [
  { id: "c1", name: "Juan Pérez", amount: 4500 },
  { id: "c2", name: "María González", amount: 12000 },
  { id: "c3", name: "Pedro Soto", amount: 8500 },
];

export const DEMO_UPCOMING_ORDERS: UpcomingOrder[] = [
  {
    id: "o1",
    code: "#1024",
    customer: "Camila R.",
    product: "Torta de chocolate · 20 personas",
    date: new Date(Date.now() + 2 * 86400000).toISOString(),
    time: "16:00",
    status: "confirmado",
    paymentStatus: "abono",
    total: 25000,
  },
  {
    id: "o2",
    code: "#1025",
    customer: "Fernanda L.",
    product: "12 Cupcakes decorados",
    date: new Date(Date.now() + 3 * 86400000).toISOString(),
    time: "11:30",
    status: "pendiente",
    paymentStatus: "pendiente",
    total: 18000,
  },
  {
    id: "o3",
    code: "#1026",
    customer: "Rodrigo M.",
    product: "Queque de zanahoria",
    date: new Date(Date.now() + 5 * 86400000).toISOString(),
    time: "09:00",
    status: "en_preparacion",
    paymentStatus: "pagado",
    total: 9000,
  },
];

export const DEMO_TIPS: DashboardTip[] = [
  {
    type: "margin",
    message:
      "Tu torta de chocolate tiene un margen del 42%. Tu margen objetivo es 60%.",
  },
  {
    type: "inventory",
    message: "La harina está cerca del stock mínimo (2,3 kg).",
  },
  {
    type: "receivable",
    message: "3 clientes tienen pagos pendientes por $25.000 en total.",
  },
];
