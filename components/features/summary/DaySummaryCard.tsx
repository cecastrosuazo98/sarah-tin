"use client";

import { useMemo } from "react";
import { useTable } from "@/lib/data/hooks";
import { usePaymentMethods } from "@/lib/data/config";
import { TABLES } from "@/lib/data/types";
import type { Expense, Order, Payment, Sale, SaleItem } from "@/lib/data/types";
import { computeDay } from "@/lib/domain/daily";
import { formatMoney } from "@/lib/format";

/** Resumen del día con explicación de cada cifra. Sin datos, lo dice (no inventa números). */
export function DaySummaryCard({ day, compact = false }: { day: Date; compact?: boolean }) {
  const { data: sales, loading } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: payments } = useTable<Payment>(TABLES.payments);
  const { data: expenses } = useTable<Expense>(TABLES.expenses);
  const { data: orders } = useTable<Order>(TABLES.orders);
  const methods = usePaymentMethods();
  const s = useMemo(
    () => computeDay({ sales, saleItems, payments, expenses, orders }, day),
    [sales, saleItems, payments, expenses, orders, day]
  );
  const label = (code: string) => methods.find((m) => m.code === code)?.label ?? code;

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-peach-light/40" />;

  if (s.empty) {
    return (
      <div className="rounded-2xl border border-peach/60 bg-white/80 p-5 text-center text-sm text-cocoa-light shadow-card">
        Todavía no hay movimientos registrados este día.
        {s.ordersDueNextDay > 0 && <p className="mt-2 font-semibold text-cocoa">Para el día siguiente: {s.ordersDueNextDay} pedido(s).</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Vendido" value={s.sold} hint={`${s.salesCount} venta(s) · ${s.units} producto(s)`} />
        <Stat label="Dinero recibido" value={s.received} hint={s.refunds > 0 ? `Incluye −${formatMoney(s.refunds)} de reembolsos` : "Cobros, abonos y anticipos"} tone="success" />
        <Stat label="Gastos" value={s.expenses} hint="Gastos del negocio (no compras de insumos)" tone="gold" />
        <Stat label="Quedó por cobrar" value={s.creditGiven} hint="De las ventas de este día" tone={s.creditGiven > 0 ? "danger" : undefined} />
      </div>
      {!compact && (
        <>
          {s.receivedByMethod.length > 0 && (
            <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
              <p className="mb-2 text-sm font-semibold text-cocoa">Dinero recibido por medio de pago</p>
              {s.receivedByMethod.map((m) => (
                <div key={m.method} className="flex justify-between py-0.5 text-sm">
                  <span className="text-cocoa-light">{label(m.method)}</span>
                  <span className="font-semibold text-cocoa">{formatMoney(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 text-sm shadow-card">
            <Line label="Pedidos nuevos" value={String(s.ordersCreated)} />
            <Line label="Pedidos entregados" value={String(s.ordersDelivered)} />
            <Line label="Pedidos para el día siguiente" value={String(s.ordersDueNextDay)} />
            <Line label="Total por cobrar a la fecha" value={formatMoney(s.receivable)} />
          </div>
          <p className="px-1 text-xs text-cocoa-soft">
            &quot;Vendido&quot; es lo que se vendió aunque se pague después. &quot;Dinero recibido&quot; es lo que efectivamente entró ese día, incluidos pagos de ventas anteriores y abonos de pedidos.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "success" | "gold" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "gold" ? "text-gold-dark" : tone === "danger" ? "text-danger" : "text-cocoa";
  return (
    <div className="rounded-2xl border border-peach/60 bg-white/80 p-3.5 shadow-card">
      <p className="text-xs text-cocoa-light">{label}</p>
      <p className={`font-display text-xl font-extrabold ${color}`}>{formatMoney(value)}</p>
      <p className="mt-0.5 text-[0.7rem] leading-tight text-cocoa-soft">{hint}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-cocoa-light">{label}</span>
      <span className="font-semibold text-cocoa">{value}</span>
    </div>
  );
}
