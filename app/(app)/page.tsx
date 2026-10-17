"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, HandCoins, Receipt, ClipboardList, BarChart3, ChevronRight, LayoutDashboard } from "lucide-react";
import { OrderWizard } from "@/components/features/orders/OrderWizard";
import { MoneyInWizard } from "@/components/features/payments/MoneyInWizard";
import { ExpenseForm } from "@/components/features/expenses/ExpenseForm";
import { DaySummaryCard } from "@/components/features/summary/DaySummaryCard";
import { orderAlerts } from "@/components/features/orders/OrderCard";
import { useTable } from "@/lib/data/hooks";
import { useSettings } from "@/lib/data/settings";
import { useRole } from "@/lib/data/config";
import { TABLES } from "@/lib/data/types";
import type { Customer, Order } from "@/lib/data/types";
import { DEFAULT_USER_NAME } from "@/lib/constants";
import { formatDateLong, greeting, formatMoney } from "@/lib/format";
import { daysUntil } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

/**
 * Inicio pensado para el día a día en el celular: 5 acciones y nada más.
 */
export default function HomePage() {
  const [modal, setModal] = useState<"pedido" | "dinero" | "gasto" | null>(null);
  const { data: orders } = useTable<Order>(TABLES.orders);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { settings } = useSettings();
  const { role } = useRole();

  // Fecha/saludo solo en el cliente (evita diferencias de hidratación).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const pending = useMemo(() => orders.filter((o) => o.status !== "entregado" && o.status !== "cancelado"), [orders]);
  const urgent = useMemo(
    () =>
      pending
        .filter((o) => daysUntil(o.order_date) <= Math.min(settings.alert_days, 1))
        .sort((a, b) => a.order_date.localeCompare(b.order_date) || (a.order_time ?? "").localeCompare(b.order_time ?? ""))
        .slice(0, 4),
    [pending, settings.alert_days]
  );
  const alerts = pending.filter((o) => orderAlerts(o, settings.alert_days).some((a) => a.tone === "danger")).length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="animate-fade-up">
        <p className="min-h-[1.25rem] text-sm font-medium text-cocoa-light">{now ? formatDateLong(now) : ""}</p>
        <h1 className="mt-0.5 font-display text-2xl font-extrabold text-cocoa sm:text-3xl">
          {now ? greeting(now) : "Hola"}, {DEFAULT_USER_NAME} <span aria-hidden>💕</span>
        </h1>
      </header>

      <section className="grid gap-3" aria-label="Acciones">
        <BigAction icon={CalendarPlus} label="Nuevo pedido" hint="Paso a paso" tone="sarah" onClick={() => setModal("pedido")} />
        <BigAction icon={HandCoins} label="Registrar venta o cobro" hint="Ventas, pagos, abonos y reembolsos" tone="tin" onClick={() => setModal("dinero")} />
        <BigAction icon={Receipt} label="Registrar gasto" hint="Luz, gas, transporte…" tone="gold" onClick={() => setModal("gasto")} />
        <BigAction
          icon={ClipboardList}
          label="Pedidos pendientes"
          hint={pending.length ? `${pending.length} por entregar${alerts ? ` · ${alerts} con alerta` : ""}` : "No hay pendientes"}
          tone={alerts ? "danger" : "cocoa"}
          href="/pedidos"
        />
        <BigAction icon={BarChart3} label="Resumen del día" hint="Lo vendido y lo cobrado hoy" tone="cocoa" href="/resumen" />
      </section>

      {urgent.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-cocoa">Para hoy y mañana</h2>
          <div className="space-y-2">
            {urgent.map((o) => {
              const d = daysUntil(o.order_date);
              return (
                <Link key={o.id} href="/pedidos" className="flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-3 shadow-card">
                  <span className={cn("rounded-lg px-2 py-1 text-xs font-bold", d < 0 ? "bg-[#FBEDED] text-danger" : "bg-[#FBF1DA] text-gold-dark")}>
                    {d < 0 ? "Atrasado" : d === 0 ? "Hoy" : "Mañana"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cocoa">
                    {customers.find((c) => c.id === o.customer_id)?.name ?? "Sin cliente"} {o.order_time ? `· ${o.order_time.slice(0, 5)}` : ""}
                  </span>
                  {o.total - o.deposit > 0 && <span className="text-xs font-semibold text-danger">Saldo {formatMoney(o.total - o.deposit)}</span>}
                  <ChevronRight className="h-4 w-4 text-cocoa-soft" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-lg font-bold text-cocoa">Hoy</h2>
        {now && <DaySummaryCard day={now} compact />}
      </section>

      {role === "admin" && (
        <Link href="/panel" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-peach-dark py-3 text-sm font-semibold text-cocoa-light">
          <LayoutDashboard className="h-4 w-4" /> Panel de análisis
        </Link>
      )}

      <OrderWizard open={modal === "pedido"} onClose={() => setModal(null)} />
      <MoneyInWizard open={modal === "dinero"} onClose={() => setModal(null)} />
      <ExpenseForm open={modal === "gasto"} onClose={() => setModal(null)} />
    </div>
  );
}

const TONES = {
  sarah: "bg-sarah text-white",
  tin: "bg-tin text-cocoa",
  gold: "bg-gold text-white",
  cocoa: "bg-peach-light text-cocoa",
  danger: "bg-danger text-white",
};

function BigAction({
  icon: Icon,
  label,
  hint,
  tone,
  onClick,
  href,
}: {
  icon: typeof CalendarPlus;
  label: string;
  hint: string;
  tone: keyof typeof TONES;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", TONES[tone])}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-display text-lg font-bold text-cocoa">{label}</span>
        <span className="block truncate text-sm text-cocoa-light">{hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-cocoa-soft" />
    </>
  );
  const cls = "flex min-h-[76px] w-full items-center gap-4 rounded-3xl border border-peach/60 bg-white/85 p-3 shadow-card transition active:scale-[0.99]";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}
