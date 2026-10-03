import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

/** Piezas de "¿Pagó?" compartidas por la venta y la entrega de pedidos. */

export type PayMode = "todo" | "parte" | "nada";

export function PayOption({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-base font-bold transition active:scale-[0.99]",
        active ? "border-sarah bg-sarah-50 text-cocoa" : "border-peach/60 bg-white/80 text-cocoa"
      )}
    >
      <span aria-hidden>{dot}</span>
      {children}
    </button>
  );
}

/** El resultado del pago, grande y claro. */
export function ResultBox({ total, paid }: { total: number; paid: number }) {
  const debt = Math.max(total - paid, 0);
  if (debt <= 0) {
    return (
      <div className="rounded-2xl bg-[#EAF4EB] px-4 py-4 text-center font-display text-2xl font-extrabold text-success">
        🟢 PAGADO
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-4 text-center",
        paid > 0 ? "bg-[#FBF1DA] text-warning" : "bg-[#FBEDED] text-danger"
      )}
    >
      {paid > 0 && <p className="text-sm font-semibold text-cocoa">Pagó {formatMoney(paid)}. Le quedan debiendo:</p>}
      <p className="font-display text-2xl font-extrabold">
        {paid > 0 ? "🟡" : "🔴"} DEBE {formatMoney(debt)}
      </p>
    </div>
  );
}
