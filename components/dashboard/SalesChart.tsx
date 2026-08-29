"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { SalesPoint } from "@/types";

/**
 * Gráfico de barras de ventas (SVG propio, sin dependencias).
 * Barras redondeadas con degradado rosa->durazno y tooltip al pasar el mouse.
 */
export function SalesChart({ data }: { data: SalesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="w-full">
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {data.map((point, i) => {
          const heightPct = Math.max((point.amount / max) * 100, 4);
          const isActive = active === i;
          return (
            <button
              key={point.date}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group relative flex flex-1 flex-col items-center justify-end gap-2 focus:outline-none"
              aria-label={`${point.label}: ${formatMoney(point.amount)}`}
            >
              {isActive && (
                <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-cocoa px-2 py-1 text-xs font-semibold text-white shadow-lift">
                  {formatMoney(point.amount)}
                </span>
              )}
              <span
                className="w-full max-w-[2.5rem] rounded-t-xl bg-gradient-to-t from-peach to-sarah transition-all duration-300 group-hover:from-sarah group-hover:to-sarah-dark"
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-xs font-medium text-cocoa-light">
                {point.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
