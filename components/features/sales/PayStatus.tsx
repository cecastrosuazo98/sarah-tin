import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

/**
 * Estado de pago en lenguaje simple:
 * 🟢 Pagado · 🟡 Debe $X (pagó una parte) · 🔴 Debe $X (no pagó nada).
 */
export function PayStatus({
  total,
  paid,
  size = "sm",
  className,
}: {
  total: number;
  paid: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const debt = Math.max(total - paid, 0);
  const tone =
    debt <= 0
      ? "bg-[#EAF4EB] text-success"
      : paid > 0
        ? "bg-[#FBF1DA] text-warning"
        : "bg-[#FBEDED] text-danger";
  const dot = debt <= 0 ? "🟢" : paid > 0 ? "🟡" : "🔴";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-4 py-2 text-base",
        tone,
        className
      )}
    >
      <span aria-hidden className={size === "sm" ? "text-[0.6rem]" : "text-sm"}>{dot}</span>
      {debt <= 0 ? "Pagado" : `Debe ${formatMoney(debt)}`}
    </span>
  );
}
