"use client";

/**
 * Pide al servidor sincronizar con Google Sheets después de registrar algo.
 * Agrupa varios registros seguidos en una sola llamada y nunca bloquea a la
 * usuaria: si falla, la sincronización programada lo recoge después.
 */
import { usingSupabase } from "./client";

let timer: ReturnType<typeof setTimeout> | null = null;

export type SyncState = { status: "idle" | "pending" | "ok" | "error" | "off"; at?: number; message?: string };
let state: SyncState = { status: "idle" };
const listeners = new Set<(s: SyncState) => void>();

function set(s: SyncState) {
  state = s;
  listeners.forEach((l) => l(s));
}

export function getSyncState() {
  return state;
}

export function onSyncState(fn: (s: SyncState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function syncNow(trigger: "manual" | "registro" = "manual"): Promise<SyncState> {
  if (!usingSupabase()) {
    set({ status: "off", message: "Modo demo: sin sincronización" });
    return state;
  }
  set({ status: "pending" });
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trigger }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 503) set({ status: "off", message: "La sincronización con Google Sheets aún no está configurada" });
    else if (json.status === "busy") set({ status: "pending", message: "Ya hay una sincronización en curso" });
    else if (!res.ok || json.ok === false) set({ status: "error", at: Date.now(), message: json.error ?? "No se pudo sincronizar" });
    else set({ status: json.status === "partial" ? "error" : "ok", at: Date.now(), message: json.status === "partial" ? "Sincronizado con observaciones (ver Sincronización)" : undefined });
  } catch {
    set({ status: "error", at: Date.now(), message: "Sin conexión: se sincronizará más tarde" });
  }
  return state;
}

/** Programa una sincronización unos segundos después del último registro. */
export function requestSync() {
  if (!usingSupabase()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow("registro");
  }, 4000);
}
