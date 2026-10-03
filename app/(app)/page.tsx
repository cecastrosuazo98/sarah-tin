"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { SaleRow } from "@/components/features/sales/SaleRow";
import { SaleDetail } from "@/components/features/sales/SaleDetail";
import { useSaleFlow } from "@/components/features/sales/SaleFlow";
import { productEmoji } from "@/components/features/sales/sale-text";
import { formatMoney, formatDateLong } from "@/lib/format";
import { useTable } from "@/lib/data/hooks";
import { TABLES } from "@/lib/data/types";
import type { Sale, SaleItem, Customer, Payment, Product } from "@/lib/data/types";
import { summarizeDay, totalReceivable } from "@/lib/domain/finance";
import { startOfDay, addDays, isSameDay, dayName } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

/** Inicio = el día: cuánto vendiste, cuánto recibiste, quién quedó debiendo. */
export default function InicioPage() {
  const { data: sales, loading } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: payments } = useTable<Payment>(TABLES.payments);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: products, loading: loadingProducts } = useTable<Product>(TABLES.products);
  const { openSale, lastSaleDate } = useSaleFlow();

  // La fecha depende del reloj del navegador: se calcula solo en el cliente
  // para que el HTML del servidor y el del navegador coincidan (hidratación).
  const [now, setNow] = useState<Date | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Los datos se recargan tras cada cambio: el esqueleto solo se muestra la primera vez.
  const [ready, setReady] = useState(false);
  const nowRef = useRef<Date | null>(null);

  useEffect(() => {
    const n = new Date();
    nowRef.current = n;
    setNow(n);
    setDay(startOfDay(n));
    // Si la app queda abierta y cambia el día, "Hoy" se actualiza al volver.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const prev = nowRef.current;
      const fresh = new Date();
      nowRef.current = fresh;
      setNow(fresh);
      if (prev && !isSameDay(prev, fresh)) {
        setDay((d) => (d && isSameDay(d, prev) ? startOfDay(fresh) : d));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!loading && !loadingProducts) setReady(true);
  }, [loading, loadingProducts]);

  // Al guardar una venta, se muestra el día en que quedó anotada.
  useEffect(() => {
    if (lastSaleDate) setDay(startOfDay(lastSaleDate));
  }, [lastSaleDate]);

  const summary = useMemo(
    () => (day ? summarizeDay(day, sales, payments) : null),
    [day, sales, payments]
  );
  // Igual que el total de "¿Quién me debe?" en Clientes.
  const totalOwed = useMemo(() => {
    const ids = new Set(customers.map((c) => c.id));
    return totalReceivable(sales.filter((s) => s.customer_id && ids.has(s.customer_id)));
  }, [sales, customers]);

  const itemsBySale = useMemo(() => {
    const map = new Map<string, SaleItem[]>();
    for (const it of saleItems) {
      const arr = map.get(it.sale_id) ?? [];
      arr.push(it);
      map.set(it.sale_id, arr);
    }
    return map;
  }, [saleItems]);

  const customerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.name ?? "Alguien de paso";

  const emojiFor = (saleId: string) => {
    const first = itemsBySale.get(saleId)?.[0];
    const product = products.find((p) => p.id === first?.product_id);
    return productEmoji(product?.name ?? first?.name_snapshot, product?.category);
  };

  if (!now || !day || !summary || !ready) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="mx-auto h-14 w-48 animate-pulse rounded-2xl bg-peach-light/70" />
        <div className="h-48 animate-pulse rounded-3xl bg-peach-light/60" />
        <div className="h-20 animate-pulse rounded-2xl bg-peach-light/50" />
        <div className="h-20 animate-pulse rounded-2xl bg-peach-light/50" />
      </div>
    );
  }

  const isToday = isSameDay(day, now);
  const name = dayName(day, now);
  const listTitle = isToday ? "Ventas de hoy" : name === "Ayer" ? "Ventas de ayer" : `Ventas del ${name}`;
  const selected = sales.find((s) => s.id === selectedId) ?? null;
  const firstTime = sales.length === 0 && products.length === 0;

  return (
    <div className="space-y-5">
      {/* Navegación por día */}
      <header className="flex items-center justify-between gap-2 animate-fade-up">
        <DayButton onClick={() => setDay(addDays(day, -1))} label={dayName(addDays(day, -1), now)} side="left" />
        <div className="min-w-0 text-center">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-cocoa sm:text-4xl">
            {name}
          </h1>
          <p className="truncate text-sm text-cocoa-light">{formatDateLong(day)}</p>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDay(startOfDay(now))}
              className="mt-1 text-xs font-semibold text-sarah-dark underline-offset-2 hover:underline"
            >
              Volver a hoy
            </button>
          )}
        </div>
        {isToday ? (
          <span className="w-20" aria-hidden />
        ) : (
          <DayButton onClick={() => setDay(addDays(day, 1))} label={dayName(addDays(day, 1), now)} side="right" />
        )}
      </header>

      {firstTime ? (
        <EmptyState
          emoji="🍰"
          title="¡Bienvenida a Sarah & Tin!"
          description="Para empezar, agrega lo que vendes con su precio. Después registrar una venta toma segundos."
          action={
            <Link href="/productos?nuevo=1" className="rounded-2xl bg-sarah px-5 py-2.5 text-sm font-semibold text-white shadow-soft">
              Agregar mi primer producto
            </Link>
          }
        />
      ) : (
        <>
          {/* Resumen del día */}
          <section className="rounded-3xl border border-peach/60 bg-white/85 p-5 shadow-card animate-fade-up">
            <p className="text-sm font-semibold text-cocoa-light">
              {summary.sales.length === 1 ? "1 venta" : `${summary.sales.length} ventas`}
            </p>
            <div className="mt-2 space-y-3">
              <SummaryLine label="Vendiste" value={summary.sold} className="text-cocoa" />
              <div>
                <SummaryLine label="Recibiste" value={summary.received} className="text-success" />
                {summary.receivedFromOldDebts > 0 && (
                  <p className="text-right text-xs text-cocoa-light">
                    Incluye {formatMoney(summary.receivedFromOldDebts)} que te pagaron de deudas de otros días
                  </p>
                )}
              </div>
              <SummaryLine
                label="Te deben"
                value={summary.owed}
                className={summary.owed > 0 ? "text-danger" : "text-cocoa-soft"}
              />
            </div>
          </section>

          {/* Ventas del día */}
          <section className="animate-fade-up">
            <h2 className="mb-3 font-display text-lg font-bold text-cocoa">{listTitle}</h2>
            {summary.sales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-peach-dark bg-white/50 px-5 py-8 text-center">
                <p className="text-cocoa-light">
                  {isToday ? "Todavía no hay ventas hoy." : "Este día no hubo ventas."}
                </p>
                {isToday && (
                  <Button className="mt-3" onClick={openSale}>
                    <Plus className="h-4 w-4" /> Registrar venta
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {summary.sales.map((s) => (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    items={itemsBySale.get(s.id) ?? []}
                    customerName={customerName(s.customer_id)}
                    emoji={emojiFor(s.id)}
                    onClick={() => setSelectedId(s.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {totalOwed > 0 && (
            <Link
              href="/clientes"
              className="flex items-center justify-between gap-3 rounded-2xl bg-peach-light/60 px-4 py-3 text-sm text-cocoa transition hover:bg-peach-light"
            >
              <span>
                Sumando todos los días, te deben <b className="text-danger">{formatMoney(totalOwed)}</b>
              </span>
              <span className="flex shrink-0 items-center font-semibold text-sarah-dark">
                Ver quién <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </>
      )}

      <SaleDetail
        sale={selected}
        items={selected ? itemsBySale.get(selected.id) ?? [] : []}
        customer={customers.find((c) => c.id === selected?.customer_id) ?? null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function SummaryLine({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-lg font-semibold text-cocoa">{label}</span>
      <span className={cn("font-display text-3xl font-extrabold", className)}>{formatMoney(value)}</span>
    </div>
  );
}

function DayButton({ onClick, label, side }: { onClick: () => void; label: string; side: "left" | "right" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-20 shrink-0 items-center justify-center gap-0.5 rounded-xl py-2 text-sm font-semibold text-cocoa-light transition hover:bg-peach-light hover:text-cocoa"
      aria-label={`Ver ${label}`}
    >
      {side === "left" && <ChevronLeft className="h-5 w-5" />}
      {label}
      {side === "right" && <ChevronRight className="h-5 w-5" />}
    </button>
  );
}
