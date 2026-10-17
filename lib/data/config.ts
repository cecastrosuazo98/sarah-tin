"use client";

/**
 * Listas configurables (v2: se editan en la matriz de Google Sheets) y rol de
 * la persona conectada. En modo demo o si la tabla aún no existe, se usan los
 * valores por defecto.
 */
import { useEffect, useMemo, useState } from "react";
import { useTable } from "./hooks";
import { usingSupabase } from "./client";
import { TABLES } from "./types";
import type { OrderStatusRow, PaymentMethodRow } from "./types";
import { ORDER_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export type Option = { code: string; label: string };

/** Medios de pago activos (sin "fiado": el saldo pendiente es un estado, no un medio). */
export function usePaymentMethods(): Option[] {
  const { data } = useTable<PaymentMethodRow>(TABLES.payment_methods);
  return useMemo(() => {
    const rows = data.filter((r) => r.is_active).sort((a, b) => a.sort - b.sort);
    if (rows.length) return rows.map((r) => ({ code: r.code, label: r.label }));
    return PAYMENT_METHODS.filter((m) => m.value !== "fiado").map((m) => ({ code: m.value, label: m.label }));
  }, [data]);
}

export function useOrderStatuses(): (Option & { isFinal: boolean })[] {
  const { data } = useTable<OrderStatusRow>(TABLES.order_statuses);
  return useMemo(() => {
    const rows = data.filter((r) => r.is_active).sort((a, b) => a.sort - b.sort);
    if (rows.length) return rows.map((r) => ({ code: r.code, label: r.label, isFinal: r.is_final }));
    return ORDER_STATUSES.map((s) => ({ code: s.value, label: s.label, isFinal: s.value === "entregado" || s.value === "cancelado" }));
  }, [data]);
}

export type Role = "admin" | "operador";

let cachedRole: Role | null = null;

/**
 * Rol en el negocio. Solo sirve para mostrar u ocultar opciones: los permisos
 * reales los aplica la base de datos (RLS y funciones).
 */
export function useRole(): { role: Role; loading: boolean } {
  const [role, setRole] = useState<Role | null>(cachedRole ?? (usingSupabase() ? null : "admin"));
  useEffect(() => {
    if (role) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error } = await supabase
        .from("business_members")
        .select("role")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();
      // Sin la tabla (base aún sin migrar) la app funciona como antes: administración.
      const r: Role = error || !data ? "admin" : (data.role as Role);
      cachedRole = r;
      if (alive) setRole(r);
    })();
    return () => {
      alive = false;
    };
  }, [role]);
  return { role: role ?? "operador", loading: role === null };
}
