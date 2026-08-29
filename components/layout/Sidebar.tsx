"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { signOut } from "@/lib/actions/auth";

/** Sidebar de escritorio (oculto en móvil). */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-peach/60 bg-cream-50/80 p-4 backdrop-blur-md lg:flex">
      <div className="px-2 py-3">
        <Logo size={52} />
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                active
                  ? "bg-sarah text-white shadow-soft"
                  : "text-cocoa-light hover:bg-peach-light hover:text-cocoa"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
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
