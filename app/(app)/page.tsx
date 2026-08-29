"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  Receipt,
  HandCoins,
  ShoppingCart,
  Package,
  UserPlus,
  Banknote,
  CalendarPlus,
  Trophy,
  ChevronRight,
  Clock,
  Lightbulb,
  AlertTriangle,
  Users,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  formatMoney,
  formatPercent,
  greeting,
  formatDateLong,
  formatDateShort,
} from "@/lib/format";
import { DEFAULT_USER_NAME } from "@/lib/constants";
import { useTable } from "@/lib/data/hooks";
import { useProductsEconomics } from "@/lib/data/derived";
import { TABLES } from "@/lib/data/types";
import type {
  Sale,
  SaleItem,
  Expense,
  CashRegister,
  CashMovement,
  Customer,
  Order,
  Ingredient,
} from "@/lib/data/types";
import {
  computeDashboard,
  salesByDay,
  topProducts,
  pendingCustomers,
} from "@/lib/domain/finance";

export default function DashboardPage() {
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: expenses } = useTable<Expense>(TABLES.expenses);
  const { data: registers } = useTable<CashRegister>(TABLES.cash_registers);
  const { data: movements } = useTable<CashMovement>(TABLES.cash_movements);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: orders } = useTable<Order>(TABLES.orders);
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);
  const { products } = useProductsEconomics();

  const summary = useMemo(
    () => computeDashboard({ sales, saleItems, expenses, registers, movements }),
    [sales, saleItems, expenses, registers, movements]
  );
  const chart = useMemo(() => salesByDay(sales, 7), [sales]);
  const top = useMemo(() => topProducts(saleItems, 4), [saleItems]);
  const pending = useMemo(
    () => pendingCustomers(customers, sales),
    [customers, sales]
  );
  const upcoming = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            !["entregado", "cancelado"].includes(o.status) &&
            o.order_date >= new Date().toISOString().slice(0, 10)
        )
        .sort((a, b) => a.order_date.localeCompare(b.order_date))
        .slice(0, 3),
    [orders]
  );

  const lowStock = ingredients.filter((i) => i.stock <= i.min_stock);
  const belowTarget = products.filter((p) => p.econ.belowTarget);

  const isEmpty =
    sales.length === 0 && products.length === 0 && customers.length === 0;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="text-sm font-medium text-cocoa-light">
          {formatDateLong(new Date())}
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-extrabold text-cocoa sm:text-3xl">
          {greeting()}, {DEFAULT_USER_NAME} <span aria-hidden>💕</span>
        </h1>
        <p className="mt-1 text-cocoa-light">Este es el resumen de tu día.</p>
      </header>

      {isEmpty ? (
        <EmptyState
          emoji="🍰"
          title="¡Bienvenida a Sarah & Tin!"
          description="Empecemos por lo primero: agrega tus ingredientes y productos para calcular costos, o registra tu primera venta."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/productos" className="rounded-2xl bg-sarah px-5 py-2.5 text-sm font-semibold text-white shadow-soft">
                Agregar producto
              </Link>
              <Link href="/ventas" className="rounded-2xl border border-peach-dark bg-white/70 px-5 py-2.5 text-sm font-semibold text-cocoa">
                Registrar venta
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Ventas de hoy" value={formatMoney(summary.salesToday)} icon={ShoppingCart} tone="sarah" hint={`${summary.productsSoldToday} productos vendidos`} />
            <StatCard label="Gastos del mes" value={formatMoney(summary.expensesMonth)} icon={Receipt} tone="gold" />
            <StatCard label="Ganancia estimada" value={formatMoney(summary.estimatedProfit)} icon={TrendingUp} tone="success" hint="Ventas − gastos del mes" />
            <StatCard label="Por cobrar" value={formatMoney(summary.receivable)} icon={HandCoins} tone="danger" hint={`${pending.length} clientes`} />
          </section>

          {summary.monthGrowth !== null && (
            <div className="flex items-center gap-3 rounded-2xl border border-tin/40 bg-tin-50/70 px-4 py-3 animate-fade-up">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
                <Sparkles className="h-5 w-5 text-tin-dark" />
              </div>
              <p className="text-sm text-cocoa">
                <span className="font-semibold">✨ Tu resumen. </span>
                Este mes {summary.monthGrowth >= 0 ? "vendiste un " : "vendiste un "}
                <span className="font-bold text-tin-dark">
                  {formatPercent(Math.abs(summary.monthGrowth), 0)}
                </span>{" "}
                {summary.monthGrowth >= 0 ? "más" : "menos"} que el mes anterior.
              </p>
            </div>
          )}

          <section className="animate-fade-up">
            <h2 className="mb-3 font-display text-lg font-bold text-cocoa">Acciones rápidas</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <QuickAction label="Nueva venta" icon={ShoppingCart} tone="sarah" href="/ventas" />
              <QuickAction label="Nuevo pedido" icon={CalendarPlus} tone="tin" href="/pedidos" />
              <QuickAction label="Registrar gasto" icon={Receipt} tone="gold" href="/gastos" />
              <QuickAction label="Registrar pago" icon={Banknote} tone="cocoa" href="/clientes" />
              <QuickAction label="Agregar producto" icon={Package} tone="sarah" href="/productos" />
              <QuickAction label="Agregar cliente" icon={UserPlus} tone="tin" href="/clientes" />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 animate-fade-up">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Ventas de los últimos 7 días</CardTitle>
                <span className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">
                  Semana: {formatMoney(summary.salesWeek)}
                </span>
              </CardHeader>
              <CardContent>
                <SalesChart data={chart} />
              </CardContent>
            </Card>

            <Card className="animate-fade-up">
              <CardHeader>
                <CardTitle>Dinero disponible</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-success/10 p-3">
                  <Wallet className="h-6 w-6 text-success" />
                  <div>
                    <p className="text-xs text-cocoa-light">En caja ahora</p>
                    <p className="font-display text-xl font-extrabold text-cocoa">
                      {formatMoney(summary.cashBalance)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-peach-light/60 p-3">
                    <p className="text-xs text-cocoa-light">Ventas mes</p>
                    <p className="font-bold text-cocoa">{formatMoney(summary.salesMonth)}</p>
                  </div>
                  <div className="rounded-xl bg-peach-light/60 p-3">
                    <p className="text-xs text-cocoa-light">Ganancia mes</p>
                    <p className="font-bold text-success">{formatMoney(summary.estimatedProfit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="animate-fade-up">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Productos más vendidos</CardTitle>
                <Trophy className="h-5 w-5 text-gold" />
              </CardHeader>
              <CardContent className="space-y-2">
                {top.length === 0 && <p className="text-sm text-cocoa-soft">Aún no hay ventas registradas.</p>}
                {top.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-peach-light/50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach-light text-sm font-bold text-gold-dark">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cocoa">{p.name}</p>
                      <p className="text-xs text-cocoa-light">{p.units} unidades</p>
                    </div>
                    <p className="text-sm font-bold text-cocoa">{formatMoney(p.revenue)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="animate-fade-up">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Clientes con pagos pendientes</CardTitle>
                <Link href="/clientes" className="text-cocoa-light hover:text-sarah-dark">
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {pending.length === 0 && <p className="text-sm text-cocoa-soft">Nadie tiene deudas pendientes. 🎉</p>}
                {pending.slice(0, 4).map((c) => (
                  <Link key={c.id} href="/clientes" className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-peach-light/50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sarah-50 text-sm font-bold text-sarah-dark">{c.name.charAt(0)}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-cocoa">{c.name}</p>
                    <span className="rounded-full bg-[#FBEDED] px-2.5 py-1 text-xs font-bold text-danger">Debe {formatMoney(c.amount)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>

          {upcoming.length > 0 && (
            <section>
              <Card className="animate-fade-up">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Pedidos próximos</CardTitle>
                  <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs font-semibold text-sarah-dark">
                    Ver todos <ChevronRight className="h-4 w-4" />
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcoming.map((o) => (
                    <Link key={o.id} href="/pedidos" className="flex items-center gap-3 rounded-xl border border-peach/50 bg-white/60 p-3 transition hover:shadow-card">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-tin-50 leading-none">
                        <span className="text-[0.65rem] font-semibold text-tin-dark">{formatDateShort(o.order_date).split(" ")[1]}</span>
                        <span className="font-display text-base font-extrabold text-cocoa">{formatDateShort(o.order_date).split(" ")[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-cocoa">
                            {customers.find((c) => c.id === o.customer_id)?.name ?? "Cliente"}
                          </p>
                          <span className="text-xs text-cocoa-soft">{o.code}</span>
                        </div>
                        {o.order_time && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-cocoa-soft">
                            <Clock className="h-3 w-3" /> {o.order_time}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-cocoa">{formatMoney(o.total)}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {(belowTarget.length > 0 || lowStock.length > 0 || pending.length > 0) && (
            <section className="animate-fade-up">
              <h2 className="mb-3 font-display text-lg font-bold text-cocoa">Para tener en cuenta</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {belowTarget.length > 0 && (
                  <TipCard icon={Lightbulb} tone="text-gold-dark" bg="bg-[#FBF1DA]/70" title="Margen">
                    {belowTarget.length === 1
                      ? `"${belowTarget[0].name}" tiene un margen de ${formatPercent(belowTarget[0].econ.margin, 0)}, bajo tu objetivo.`
                      : `${belowTarget.length} productos están bajo tu margen objetivo.`}
                  </TipCard>
                )}
                {lowStock.length > 0 && (
                  <TipCard icon={AlertTriangle} tone="text-warning" bg="bg-[#FBF1DA]/60" title="Inventario">
                    {lowStock.length === 1
                      ? `"${lowStock[0].name}" está en stock bajo.`
                      : `${lowStock.length} ingredientes están en stock bajo.`}
                  </TipCard>
                )}
                {pending.length > 0 && (
                  <TipCard icon={Users} tone="text-sarah-dark" bg="bg-sarah-50/70" title="Cuentas por cobrar">
                    {`${pending.length} ${pending.length === 1 ? "cliente tiene un pago pendiente" : "clientes tienen pagos pendientes"} por ${formatMoney(summary.receivable)}.`}
                  </TipCard>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TipCard({
  icon: Icon,
  tone,
  bg,
  title,
  children,
}: {
  icon: typeof Lightbulb;
  tone: string;
  bg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-3 rounded-2xl border border-peach/50 ${bg} p-4`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
      <div>
        <p className="text-sm font-bold text-cocoa">{title}</p>
        <p className="mt-0.5 text-sm text-cocoa-light">{children}</p>
      </div>
    </div>
  );
}
