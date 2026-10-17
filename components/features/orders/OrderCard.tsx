"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock, HandCoins, MessageCircle, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setOrderStatus } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Customer, Order, OrderItem, OrderStatus } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { daysUntil, toDate } from "@/lib/domain/dates";

export type StatusOption = { code: string; label: string; isFinal: boolean };

/** Acción siguiente según el estado (respeta estados extra definidos en la matriz). */
export function nextStatus(current: string, statuses: StatusOption[]): StatusOption | null {
  const flow = statuses.filter((s) => !s.isFinal || s.code === "entregado");
  const i = flow.findIndex((s) => s.code === current);
  if (current === "entregado" || current === "cancelado") return null;
  return flow[i + 1] ?? flow.find((s) => s.code === "entregado") ?? null;
}

const ACTION_LABEL: Record<string, string> = {
  confirmado: "Confirmar pedido",
  en_preparacion: "Empezar a preparar",
  listo: "Marcar como listo",
  entregado: "Entregar",
};

export function orderAlerts(o: Order, alertDays: number): { tone: "danger" | "warning" | "gold"; text: string }[] {
  const out: { tone: "danger" | "warning" | "gold"; text: string }[] = [];
  if (o.status === "entregado" || o.status === "cancelado") return out;
  const d = daysUntil(o.order_date);
  if (d < 0) out.push({ tone: "danger", text: `Atrasado ${-d} día${d === -1 ? "" : "s"}` });
  else if (d === 0) out.push({ tone: "warning", text: "Entrega hoy" });
  else if (d === 1) out.push({ tone: "warning", text: "Entrega mañana" });
  else if (d <= alertDays) out.push({ tone: "gold", text: `Entrega en ${d} días` });
  if (o.deposit <= 0) out.push({ tone: "gold", text: "Sin abono" });
  if (d <= 0 && o.status !== "listo") out.push({ tone: "danger", text: "Aún no está listo" });
  return out;
}

export function OrderCard({
  order: o,
  items,
  customer,
  statuses,
  alertDays,
  onPay,
  onCancel,
}: {
  order: Order;
  items: OrderItem[];
  customer?: Customer;
  statuses: StatusOption[];
  alertDays: number;
  onPay: (o: Order) => void;
  onCancel: (o: Order) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const next = nextStatus(o.status, statuses);
  const balance = o.total - o.deposit;
  const alerts = orderAlerts(o, alertDays);
  const statusLabel = statuses.find((s) => s.code === o.status)?.label ?? o.status;
  const date = toDate(o.order_date);

  const advance = async () => {
    if (!next || busy) return;
    setBusy(true);
    try {
      const r = await setOrderStatus(o.id, next.code as OrderStatus);
      if (next.code === "entregado") {
        toast(balance > 0 ? `Entregado. Quedó un saldo de ${formatMoney(balance)} por cobrar.` : "Entregado y pagado 💕");
      } else toast(`Pedido: ${next.label}`);
      if (r.warning) toast(r.warning, "info");
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo cambiar el estado."), "error");
    } finally {
      setBusy(false);
    }
  };

  const phone = customer?.phone?.replace(/\D/g, "");

  return (
    <div className="rounded-2xl border border-peach/60 bg-white/85 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tin-50 leading-none">
          <span className="text-[0.65rem] font-semibold text-tin-dark">{date.toLocaleDateString("es-CL", { month: "short" })}</span>
          <span className="font-display text-lg font-extrabold text-cocoa">{date.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-cocoa">{customer?.name ?? "Sin cliente"}</p>
            <span className="text-xs text-cocoa-soft">{o.code}</span>
          </div>
          <p className="text-xs text-cocoa-light">
            {items.map((it) => `${it.quantity}× ${it.name_snapshot}${it.details ? ` (${it.details})` : ""}`).join(", ")}
          </p>
          {o.order_time && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-cocoa-soft"><Clock className="h-3 w-3" /> {o.order_time.slice(0, 5)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(o.total)}</p>
          {balance <= 0 ? <Badge tone="success">Pagado</Badge> : <p className="text-xs font-semibold text-danger">Saldo {formatMoney(balance)}</p>}
        </div>
      </div>

      {(alerts.length > 0 || o.notes) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {alerts.map((a) => (
            <Badge key={a.text} tone={a.tone}>{a.tone === "danger" && <AlertTriangle className="mr-1 inline h-3 w-3" />}{a.text}</Badge>
          ))}
          {o.notes && <span className="w-full rounded-lg bg-peach-light/40 px-3 py-1.5 text-xs text-cocoa-light">{o.notes}</span>}
        </div>
      )}

      <div className="mt-3 border-t border-peach/50 pt-3">
        <div className="flex items-center gap-1.5">
          <Badge tone="tin">{statusLabel}</Badge>
          <div className="relative ml-auto flex items-center gap-1.5">
            {balance > 0 && o.status !== "cancelado" && (
              <Button size="sm" variant="outline" onClick={() => onPay(o)} aria-label="Registrar abono">
                <HandCoins className="h-4 w-4" /> Abono
              </Button>
            )}
            <button onClick={() => setMenu((m) => !m)} className="rounded-lg p-1.5 text-cocoa-soft hover:bg-peach-light" aria-label="Más opciones">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menu && (
              <div className="absolute right-0 top-10 z-10 w-52 rounded-xl border border-peach bg-white p-1 text-sm shadow-lift">
                {phone && (
                  <a
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${customer?.name ?? ""}! Tu pedido de Sarah & Tin ${o.status === "listo" ? "está listo 🍰" : "está agendado"}.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-cocoa hover:bg-peach-light"
                  >
                    <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
                  </a>
                )}
                {o.status !== "entregado" && o.status !== "cancelado" ? (
                  <button onClick={() => { setMenu(false); onCancel(o); }} className="w-full rounded-lg px-3 py-2 text-left text-danger hover:bg-[#FBEDED]">
                    Cancelar pedido
                  </button>
                ) : (
                  !phone && <p className="px-3 py-2 text-cocoa-soft">Sin más opciones</p>
                )}
              </div>
            )}
          </div>
        </div>
        {next && (
          <Button className="mt-2 w-full" onClick={advance} disabled={busy}>
            {ACTION_LABEL[next.code] ?? next.label}
            {next.code === "entregado" && balance > 0 ? ` (saldo ${formatMoney(balance)})` : ""}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
