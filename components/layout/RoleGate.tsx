"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useRole } from "@/lib/data/config";
import { ADMIN_PATHS } from "@/lib/navigation";

/**
 * Oculta las secciones de administración a la operadora. Es solo interfaz:
 * aunque alguien llegue a la página, la base de datos rechaza los cambios.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, loading } = useRole();
  const adminOnly = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!adminOnly) return <>{children}</>;
  if (loading) return null;
  if (role === "admin") return <>{children}</>;
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-3xl border border-peach bg-white/80 p-6 text-center shadow-card">
      <Lock className="mx-auto h-8 w-8 text-cocoa-soft" />
      <p className="mt-3 font-display text-lg font-bold text-cocoa">Sección de administración</p>
      <p className="mt-1 text-sm text-cocoa-light">Precios, recetas y configuración los administra César desde la matriz.</p>
      <Link href="/" className="mt-4 inline-block rounded-2xl bg-sarah px-5 py-2.5 text-sm font-semibold text-white">Volver al inicio</Link>
    </div>
  );
}
