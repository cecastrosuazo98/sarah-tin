"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  X,
  ShoppingCart,
  ArrowDownCircle,
  Receipt,
  UserPlus,
  Banknote,
  CalendarPlus,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEMS } from "@/lib/navigation";
import { signOut } from "@/lib/actions/auth";

const QUICK_ADD = [
  { label: "Venta", icon: ShoppingCart, href: "/ventas?nuevo=1", tone: "bg-sarah text-white" },
  { label: "Ingreso", icon: ArrowDownCircle, href: "/caja", tone: "bg-tin text-cocoa" },
  { label: "Gasto", icon: Receipt, href: "/gastos?nuevo=1", tone: "bg-gold text-white" },
  { label: "Cliente", icon: UserPlus, href: "/clientes?nuevo=1", tone: "bg-sarah-dark text-white" },
  { label: "Pago", icon: Banknote, href: "/clientes", tone: "bg-success text-white" },
  { label: "Pedido", icon: CalendarPlus, href: "/pedidos?nuevo=1", tone: "bg-cocoa text-white" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<null | "add" | "more">(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-peach/60 bg-cream-50/95 backdrop-blur-md lg:hidden">
        <div className="safe-bottom mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {BOTTOM_NAV_ITEMS.slice(0, 2).map((item) => (
            <NavButton key={item.href} active={isActive(item.href)} icon={item.icon} label={item.label} href={item.href} />
          ))}

          {/* Botón central + */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setSheet("add")}
              aria-label="Registrar algo nuevo"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-sarah text-white shadow-lift ring-4 ring-cream-50 transition-transform active:scale-90"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>

          {BOTTOM_NAV_ITEMS.slice(2, 3).map((item) => (
            <NavButton key={item.href} active={isActive(item.href)} icon={item.icon} label={item.label} href={item.href} />
          ))}
          <NavButton
            active={sheet === "more"}
            icon={MoreHorizontal}
            label="Más"
            onClick={() => setSheet("more")}
          />
        </div>
      </nav>

      {/* Hoja inferior */}
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-cocoa/30 backdrop-blur-sm animate-fade-up"
            onClick={() => setSheet(null)}
          />
          <div className="safe-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-peach bg-cream-50 p-5 shadow-lift animate-fade-up">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-peach-dark" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-cocoa">
                {sheet === "add" ? "¿Qué quieres registrar?" : "Más opciones"}
              </h2>
              <button
                onClick={() => setSheet(null)}
                aria-label="Cerrar"
                className="rounded-full p-1 text-cocoa-light hover:bg-peach-light"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sheet === "add" ? (
              <div className="grid grid-cols-3 gap-3">
                {QUICK_ADD.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.label}
                      href={a.href}
                      onClick={() => setSheet(null)}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-peach/60 bg-white/80 p-3 text-center shadow-card transition active:scale-95"
                    >
                      <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", a.tone)}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="text-xs font-semibold text-cocoa">{a.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {MORE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheet(null)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-cocoa transition hover:bg-peach-light"
                    >
                      <Icon className="h-5 w-5 text-gold-dark" />
                      {item.label}
                    </Link>
                  );
                })}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-danger transition hover:bg-[#FBEDED]"
                  >
                    <LogOut className="h-5 w-5" />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  href,
  onClick,
}: {
  active?: boolean;
  icon: typeof Plus;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls = cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.68rem] font-semibold transition-colors",
    active ? "text-sarah-dark" : "text-cocoa-light"
  );
  const inner = (
    <>
      <Icon className="h-5 w-5" />
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
