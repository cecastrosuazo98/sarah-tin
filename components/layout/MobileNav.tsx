"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS, MORE_NAV_ITEMS } from "@/lib/navigation";
import { signOut } from "@/lib/actions/auth";

/**
 * Barra inferior (móvil): 4 secciones de todos los días + "Más".
 * "Registrar venta" va aparte, en un botón flotante bien visible.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const inMore = MORE_NAV_ITEMS.some((i) => isActive(i.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-peach/60 bg-cream-50/95 backdrop-blur-md lg:hidden">
        <div className="safe-bottom mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
          {MAIN_NAV_ITEMS.map((item) => (
            <NavButton key={item.href} active={isActive(item.href)} icon={item.icon} label={item.label} href={item.href} />
          ))}
          <NavButton active={moreOpen || inMore} icon={Menu} label="Más" onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-cocoa/30 backdrop-blur-sm animate-fade-up"
            onClick={() => setMoreOpen(false)}
          />
          <div className="safe-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-peach bg-cream-50 p-5 shadow-lift animate-fade-up">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-peach-dark" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-cocoa">Más opciones</h2>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1 text-cocoa-light hover:bg-peach-light"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {MORE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-peach-light"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-gold-dark" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-cocoa">{item.label}</span>
                      <span className="block text-xs text-cocoa-light">{item.hint}</span>
                    </span>
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
  icon: typeof Menu;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls = cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.7rem] font-semibold transition-colors",
    active ? "text-sarah-dark" : "text-cocoa-light"
  );
  const inner = (
    <>
      <Icon className="h-6 w-6" />
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
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
