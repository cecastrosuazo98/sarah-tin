"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wrench, ExternalLink, AlertTriangle, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { syncNow } from "@/lib/data/sync-client";
import { usingSupabase } from "@/lib/data/client";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/data/error";

type Run = { id: string; trigger: string; status: string; started_at: string; finished_at: string | null; error: string | null; stats: { tabs?: { tab: string; pulled: number; pushed: number; appended: number; inserted: number; conflicts: number; errors: number; fatal?: string }[] } };
type Conflict = { id: string; table_name: string; record_id: string; summary: string; created_at: string };
type Status = { configured: boolean; missing?: string[]; runs?: Run[]; conflicts?: Conflict[]; sheetUrl?: string | null };

const fmt = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-");

/** Sincronización con la matriz (solo administración). */
export function SyncPanel() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sync");
      setStatus(await r.json());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (usingSupabase()) void load();
  }, [load]);

  if (!usingSupabase()) return null;

  const run = async () => {
    setBusy("sync");
    const s = await syncNow("manual");
    setBusy(null);
    toast(s.status === "ok" ? "Sincronización completa" : s.message ?? "Sincronización con observaciones", s.status === "ok" ? "success" : "info");
    void load();
  };

  const setup = async (resetAnalysis: boolean) => {
    setBusy("setup");
    try {
      const r = await fetch("/api/sync/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resetAnalysis }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast(j.created?.length ? `Matriz preparada (pestañas creadas: ${j.created.join(", ")})` : "Matriz preparada: formatos y protecciones aplicados");
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo preparar la matriz"), "error");
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (c: Conflict, winner: "sheets" | "app") => {
    setBusy(c.id);
    try {
      const r = await fetch("/api/sync/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conflictId: c.id, winner }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast(winner === "sheets" ? "Se aplicó el valor de Sheets" : "Se mantuvo el valor de la app");
      void load();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo resolver"), "error");
    } finally {
      setBusy(null);
    }
  };

  const last = status?.runs?.[0];

  return (
    <>
      <Card className="animate-fade-up">
        <CardHeader className="flex-row items-center gap-2">
          <RefreshCw className="h-5 w-5 text-tin-dark" />
          <CardTitle>Sincronización con Google Sheets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!status ? (
            <p className="text-cocoa-light">Cargando estado…</p>
          ) : !status.configured ? (
            <div className="rounded-xl bg-[#FBF1DA] p-3 text-gold-dark">
              <p className="font-semibold">La sincronización aún no está configurada en el servidor.</p>
              {status.missing && <p className="mt-1">Faltan variables de entorno: {status.missing.join(", ")}.</p>}
              <p className="mt-1">Ver docs/06-despliegue.md.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {last ? (
                  <>
                    <Badge tone={last.status === "ok" ? "success" : last.status === "running" ? "tin" : last.status === "partial" ? "warning" : "danger"}>
                      {last.status === "ok" ? "OK" : last.status === "running" ? "En curso" : last.status === "partial" ? "Con observaciones" : "Error"}
                    </Badge>
                    <span className="text-cocoa-light">Última: {fmt(last.started_at)} ({last.trigger})</span>
                  </>
                ) : (
                  <span className="text-cocoa-light">Nunca se ha sincronizado.</span>
                )}
                {status.sheetUrl && (
                  <a href={status.sheetUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-sarah-dark">
                    Abrir matriz <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {last?.error && <p className="rounded-xl bg-[#FBEDED] p-3 text-danger">{last.error}</p>}
              {last?.stats?.tabs && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-peach/60">
                  <table className="w-full text-xs">
                    <thead className="bg-peach-light/50 text-left text-cocoa-light">
                      <tr><th className="p-2">Hoja</th><th className="p-2">De Sheets</th><th className="p-2">A Sheets</th><th className="p-2">Conflictos</th><th className="p-2">Errores</th></tr>
                    </thead>
                    <tbody>
                      {last.stats.tabs.filter((t) => t.pulled + t.pushed + t.appended + t.inserted + t.conflicts + t.errors > 0 || t.fatal).map((t) => (
                        <tr key={t.tab} className="border-t border-peach/40">
                          <td className="p-2 font-semibold">{t.tab}</td>
                          <td className="p-2">{t.pulled + t.inserted}</td>
                          <td className="p-2">{t.pushed + t.appended}</td>
                          <td className="p-2">{t.conflicts}</td>
                          <td className="p-2 text-danger">{t.fatal ?? t.errors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={run} disabled={!!busy}><RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Sincronizar ahora</Button>
                <Button variant="outline" onClick={() => setup(false)} disabled={!!busy}><Wrench className="h-4 w-4" /> Preparar matriz</Button>
                <Button variant="ghost" onClick={() => setup(true)} disabled={!!busy}>Restaurar fórmulas de análisis</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!!status?.conflicts?.length && (
        <Card className="animate-fade-up border-gold/60">
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-gold-dark" />
            <CardTitle>Conflictos por revisar ({status.conflicts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-cocoa-light">Estas filas cambiaron en Sheets y en la app al mismo tiempo. Ninguno de los dos valores se aplicó todavía: elige cuál queda.</p>
            {status.conflicts.map((c) => (
              <div key={c.id} className="rounded-xl border border-peach/60 bg-white/70 p-3">
                <p className="font-semibold text-cocoa">{c.table_name} <span className="text-xs font-normal text-cocoa-soft">· {fmt(c.created_at)}</span></p>
                <p className="mt-1 text-cocoa-light">{c.summary}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => resolve(c, "sheets")} disabled={!!busy}>Usar valor de Sheets</Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(c, "app")} disabled={!!busy}>Mantener valor de la app</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <InviteCard />
    </>
  );
}

function InviteCard() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"operador" | "admin">("operador");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast("Escribe un correo válido.", "error");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("rpc_invite_member", { p_email: email.trim(), p_role: role, p_name: name.trim() || null });
      if (error) throw error;
      toast(data?.existing_user ? "Acceso actualizado" : "Invitación guardada: crea su usuario en Supabase con ese correo");
      setEmail("");
      setName("");
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo invitar"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="animate-fade-up">
      <CardHeader className="flex-row items-center gap-2">
        <UserPlus className="h-5 w-5 text-sarah-dark" />
        <CardTitle>Personas con acceso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-cocoa-light">
          Operación: registra pedidos, ventas, cobros y gastos. Administración: además precios, recetas, configuración y sincronización.
          La contraseña la define cada persona; nunca se escribe aquí.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Correo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Rol">
            <Select value={role} onChange={(e) => setRole(e.target.value as "operador" | "admin")}>
              <option value="operador">Operación</option>
              <option value="admin">Administración</option>
            </Select>
          </Field>
        </div>
        <Button onClick={invite} disabled={busy}>Dar acceso</Button>
      </CardContent>
    </Card>
  );
}
