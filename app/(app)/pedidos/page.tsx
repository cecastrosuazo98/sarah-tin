"use client";

import { useMemo, useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { OrderWizard } from "@/components/features/orders/OrderWizard";
import { OrderCard, orderAlerts } from "@/components/features/orders/OrderCard";
import { MoneyInWizard } from "@/components/features/payments/MoneyInWizard";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { useOrderStatuses } from "@/lib/data/config";
import { useSettings } from "@/lib/data/settings";
import { setOrderStatus } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Order, OrderItem, Customer } from "@/lib/data/types";
import { daysUntil } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

type Tab = "pendientes" | "entregados" | "cancelados";

function bucketOf(date: string): string {
  const d = daysUntil(date);
  if (d < 0) return "Atrasados";
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d <= 7) return "Esta semana";
  return "Más adelante";
}
const BUCKETS = ["Atrasados", "Hoy", "Mañana", "Esta semana", "Más adelante"];

export default function PedidosPage() {
  const toast = useToast();
  const { data: orders, loading } = useTable<Order>(TABLES.orders);
  const { data: orderItems } = useTable<OrderItem>(TABLES.order_items);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const statuses = useOrderStatuses();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("pendientes");
  useAutoOpen(() => setOpen(true));

  const inTab = (o: Order) =>
    tab === "pendientes" ? o.status !== "entregado" && o.status !== "cancelado"
    : tab === "entregados" ? o.status === "entregado"
    : o.status === "cancelado";

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (!inTab(o)) return false;
        const customer = customers.find((c) => c.id === o.customer_id)?.name ?? "";
        const items = orderItems.filter((it) => it.order_id === o.id).map((it) => it.name_snapshot).join(" ");
        return matchesSearch(query, customer, o.code, items, o.notes);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, customers, orderItems, query, tab]
  );

  const groups = useMemo(() => {
    const sorted = [...filtered].sort((a, b) =>
      tab === "pendientes"
        ? a.order_date.localeCompare(b.order_date) || (a.order_time ?? "").localeCompare(b.order_time ?? "")
        : b.order_date.localeCompare(a.order_date)
    );
    if (tab !== "pendientes") return new Map([["", sorted.slice(0, 50)]]);
    const map = new Map<string, Order[]>();
    sorted.forEach((o) => map.set(bucketOf(o.order_date), [...(map.get(bucketOf(o.order_date)) ?? []), o]));
    return map;
  }, [filtered, tab]);

  const pendingCount = orders.filter((o) => o.status !== "entregado" && o.status !== "cancelado").length;
  const alertCount = orders.filter((o) => orderAlerts(o, settings.alert_days).some((a) => a.tone === "danger")).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pedidos"
        subtitle={pendingCount ? `${pendingCount} por entregar${alertCount ? ` · ${alertCount} con alerta` : ""}` : "Agenda tus entregas y sigue su estado."}
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo pedido</Button>}
      />

      <div className="flex gap-1 rounded-2xl bg-peach-light/50 p-1">
        {(["pendientes", "entregados", "cancelados"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("flex-1 rounded-xl py-2 text-sm font-semibold capitalize", tab === t ? "bg-white text-cocoa shadow-card" : "text-cocoa-light")}
          >
            {t}
          </button>
        ))}
      </div>

      {orders.length > 0 && <SearchBar value={query} onChange={setQuery} placeholder="Buscar por cliente, número o producto…" />}

      {!loading && orders.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          emoji="📅"
          title="Todavía no tienes pedidos"
          description="Agenda tu primer pedido con fecha de entrega."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo pedido</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState emoji={query ? "🔍" : "🎉"} title={query ? "Sin resultados" : "Nada por aquí"} description={query ? "No hay pedidos que coincidan." : tab === "pendientes" ? "No tienes pedidos pendientes." : "Sin pedidos en esta lista."} />
      ) : (
        <div className="space-y-6">
          {(tab === "pendientes" ? BUCKETS : [""]).filter((b) => groups.has(b)).map((bucket) => (
            <section key={bucket || "all"}>
              {bucket && <h2 className={cn("mb-2 font-display text-lg font-bold", bucket === "Atrasados" ? "text-danger" : "text-cocoa")}>{bucket}</h2>}
              <div className="space-y-2">
                {groups.get(bucket)!.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    items={orderItems.filter((it) => it.order_id === o.id)}
                    customer={customers.find((c) => c.id === o.customer_id)}
                    statuses={statuses}
                    alertDays={settings.alert_days}
                    onPay={setPaying}
                    onCancel={setCancelling}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <OrderWizard open={open} onClose={() => setOpen(false)} />
      <MoneyInWizard open={!!paying} onClose={() => setPaying(null)} initialOrderId={paying?.id ?? null} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        confirmLabel="Cancelar pedido"
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            const r = await setOrderStatus(cancelling.id, "cancelado");
            toast("Pedido cancelado");
            if (r.warning) toast(r.warning, "info");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo cancelar."), "error");
            throw e;
          }
        }}
        title="Cancelar pedido"
        message="El pedido queda en la lista de cancelados (no se borra). Si tenía abono y lo devuelves, regístralo como reembolso."
      />
    </div>
  );
}
