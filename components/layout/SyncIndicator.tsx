"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2, AlertCircle, Check } from "lucide-react";
import { getSyncState, onSyncState, syncNow, type SyncState } from "@/lib/data/sync-client";
import { usingSupabase } from "@/lib/data/client";
import { cn } from "@/lib/utils";

/** Estado visible de la sincronización con Google Sheets. Tocar = sincronizar ahora. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<SyncState>(getSyncState());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return onSyncState(setS);
  }, []);
  if (!mounted || !usingSupabase()) return null;

  const view =
    s.status === "pending" ? { icon: Loader2, text: "Sincronizando…", cls: "text-tin-dark", spin: true }
    : s.status === "ok" ? { icon: Check, text: "Sincronizado", cls: "text-success" }
    : s.status === "error" ? { icon: AlertCircle, text: s.message ?? "Error al sincronizar", cls: "text-danger" }
    : s.status === "off" ? { icon: CloudOff, text: s.message ?? "Sin sincronización", cls: "text-cocoa-soft" }
    : { icon: Cloud, text: "Sincronizar con Sheets", cls: "text-cocoa-light" };
  const Icon = view.icon;

  return (
    <button
      onClick={() => s.status !== "pending" && void syncNow("manual")}
      title={view.text}
      className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-peach-light", view.cls)}
    >
      <Icon className={cn("h-4 w-4 shrink-0", "spin" in view && view.spin && "animate-spin")} />
      {!compact && <span className="truncate text-left">{view.text}</span>}
    </button>
  );
}
