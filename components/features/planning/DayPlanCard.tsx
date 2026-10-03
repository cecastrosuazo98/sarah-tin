"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { productEmoji } from "@/components/features/sales/sale-text";
import { weekdayPlural, type PlanRow } from "@/lib/domain/planning";

const VISIBLE = 5;

/** Qué preparar un día: pedidos + lo que se suele vender + menú. */
export function DayPlanCard({
  title,
  rows,
  orderCount,
  weekday,
  emptyText,
}: {
  title: string;
  rows: PlanRow[];
  orderCount: number;
  weekday: number;
  /** Si no hay nada que mostrar: texto, o null para ocultar la tarjeta. */
  emptyText: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0 && !emptyText) return null;
  const shown = showAll ? rows : rows.slice(0, VISIBLE);

  return (
    <section className="rounded-3xl border border-peach/60 bg-white/85 p-4 shadow-card animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-cocoa">🧁 {title}</h2>
        {orderCount > 0 && (
          <Link href="/pedidos" className="flex shrink-0 items-center text-sm font-semibold text-sarah-dark">
            {orderCount === 1 ? "1 pedido" : `${orderCount} pedidos`} <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-cocoa-light">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-peach/50">
          {shown.map((r) => (
            <li key={r.key} className="flex items-center gap-3 py-2.5">
              <span className="text-2xl" aria-hidden>{productEmoji(r.name, r.category)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cocoa">{r.name}</p>
                <p className="text-xs text-cocoa-light">{caption(r, weekday)}</p>
              </div>
              <span className="font-display text-2xl font-extrabold text-cocoa">
                {quantity(r)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rows.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 w-full py-1 text-sm font-semibold text-sarah-dark"
        >
          {showAll ? "Ver menos" : `Ver ${rows.length - VISIBLE} más`}
        </button>
      )}
    </section>
  );
}

/** Cuántos preparar. "~" cuando incluye una estimación de lo que se suele vender. */
function quantity(r: PlanRow): string {
  const total = r.fromOrders + r.usual;
  if (total <= 0) return "—";
  return `${r.usual > 0 ? "~" : ""}${formatUnits(total)}`;
}

function formatUnits(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

/** Explica de dónde sale el número, en palabras simples. */
function caption(r: PlanRow, weekday: number): string {
  if (r.fromOrders > 0 && r.usual > 0) {
    return `${formatUnits(r.fromOrders)} de pedidos + ~${r.usual} para vender`;
  }
  if (r.fromOrders > 0) return "Para pedidos";
  if (r.usual > 0) return `Lo que sueles vender ${weekdayPlural(weekday)}`;
  return "En tu menú de este día";
}
