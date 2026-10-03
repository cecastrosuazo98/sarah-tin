"use client";

import { formatMoney } from "@/lib/format";
import type { Sale, SaleItem } from "@/lib/data/types";
import { PayStatus } from "./PayStatus";
import { itemsText } from "./sale-text";

/** Una venta en una línea: quién, qué, cuánto y si pagó. */
export function SaleRow({
  sale,
  items,
  customerName,
  emoji,
  subtitle,
  onClick,
}: {
  sale: Sale;
  items: SaleItem[];
  customerName: string;
  emoji: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-3.5 text-left shadow-card transition active:scale-[0.99] hover:shadow-lift"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-peach-light text-2xl" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-cocoa">{customerName}</p>
        <p className="truncate text-sm text-cocoa-light">{itemsText(items) || "Venta"}</p>
        {subtitle && <p className="text-xs text-cocoa-soft">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(sale.total)}</p>
        <PayStatus total={sale.total} paid={sale.paid_amount} />
      </div>
    </button>
  );
}
