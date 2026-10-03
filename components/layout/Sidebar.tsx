"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS, MORE_NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { signOut } from "@/lib/actions/auth";

/** Sidebar de escritorio (oculto en móvil). */
export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const renderItem = (item: NavItem, small = false) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 font-semibold transition-colors duration-200",
          small ? "py-2 text-[0.8rem]" : "py-2.5 text-sm",
          active
            ? "bg-sarah text-white shadow-soft"
            : "text-cocoa-light hover:bg-peach-light hover:text-cocoa"
        )}
      >
        <Icon className={cn("shrink-0", small ? "h-4 w-4" : "h-5 w-5")} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-peach/60 bg-cream-50/80 p-4 backdrop-blur-md lg:flex">
      <div className="px-2 py-3">
        <Logo size={52} />
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto">
        <div className="space-y-1">{MAIN_NAV_ITEMS.map((i) => renderItem(i))}</div>
        <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-cocoa-soft">Más</p>
        <div className="space-y-0.5">{MORE_NAV_ITEMS.map((i) => renderItem(i, true))}</div>
      </nav>

      <form action={signOut} className="mt-2 border-t border-peach/60 pt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cocoa-light transition-colors hover:bg-peach-light hover:text-cocoa"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
