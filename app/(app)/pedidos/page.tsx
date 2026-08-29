"use client";

import { useMemo, useState } from "react";
import { Plus, CalendarDays, Clock, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { OrderForm } from "@/components/features/orders/OrderForm";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { updateOrderStatus } from "@/lib/data/repo";
import { remove } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Order, OrderItem, Customer, OrderStatus } from "@/lib/data/types";
import { ORDER_STATUSES } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

const STATUS_TONE: Record<OrderStatus, "neutral" | "tin" | "gold" | "success" | "danger"> = {
  pendiente: "neutral",
  confirmado: "tin",
  en_preparacion: "gold",
  listo: "success",
  entregado: "success",
  cancelado: "danger",
};

function bucketOf(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (dateStr < today) return "Anteriores";
  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrow) return "Mañana";
  if (dateStr <= weekEnd) return "Esta semana";
  return "Próximos";
}

const ORDER = ["Hoy", "Mañana", "Esta semana", "Próximos", "Anteriores"];

export default function PedidosPage() {
  const toast = useToast();
  const { data: orders, loading } = useTable<Order>(TABLES.orders);
  const { data: orderItems } = useTable<OrderItem>(TABLES.order_items);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  useAutoOpen(() => setOpen(true));

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        const customer = customers.find((c) => c.id === o.customer_id)?.name ?? "";
        const items = orderItems
          .filter((it) => it.order_id === o.id)
          .map((it) => it.name_snapshot)
          .join(" ");
        const statusLabel = ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? "";
        return matchesSearch(query, customer, o.code, items, o.notes, statusLabel);
      }),
    [orders, customers, orderItems, query]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    [...filteredOrders]
      .sort((a, b) => a.order_date.localeCompare(b.order_date) || (a.order_time ?? "").localeCompare(b.order_time ?? ""))
      .forEach((o) => {
        const b = bucketOf(o.order_date);
        map.set(b, [...(map.get(b) ?? []), o]);
      });
    return map;
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Agenda tus entregas y sigue su estado."
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      {orders.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar pedido, cliente o estado…" />
      )}

      {!loading && orders.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          emoji="📅"
          title="Todavía no tienes pedidos"
          description="Agenda tu primer pedido con fecha de entrega y estado."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo pedido</Button>}
        />
      ) : groups.size === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay pedidos que coincidan con tu búsqueda." />
      ) : (
        <div className="space-y-6">
          {ORDER.filter((b) => groups.has(b)).map((bucket) => (
            <section key={bucket}>
              <h2 className="mb-2 font-display text-lg font-bold text-cocoa">{bucket}</h2>
              <div className="space-y-2">
                {groups.get(bucket)!.map((o) => {
                  const items = orderItems.filter((it) => it.order_id === o.id);
                  const customer = customers.find((c) => c.id === o.customer_id);
                  return (
                    <div key={o.id} className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tin-50 leading-none">
                          <span className="text-[0.65rem] font-semibold text-tin-dark">
                            {new Date(o.order_date + "T00:00:00").toLocaleDateString("es-CL", { month: "short" })}
                          </span>
                          <span className="font-display text-lg font-extrabold text-cocoa">
                            {new Date(o.order_date + "T00:00:00").getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-cocoa">{customer?.name ?? "Sin cliente"}</p>
                            <span className="text-xs text-cocoa-soft">{o.code}</span>
                          </div>
                          <p className="truncate text-xs text-cocoa-light">
                            {items.map((it) => `${it.quantity}× ${it.name_snapshot}`).join(", ")}
                          </p>
                          {o.order_time && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-cocoa-soft">
                              <Clock className="h-3 w-3" /> {o.order_time}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(o.total)}</p>
                          {o.payment_status === "pagado" ? (
                            <Badge tone="success">Pagado</Badge>
                          ) : o.payment_status === "abono" ? (
                            <Badge tone="warning">Abono {formatMoney(o.deposit)}</Badge>
                          ) : (
                            <Badge tone="danger">Sin pago</Badge>
                          )}
                        </div>
                      </div>

                      {o.notes && <p className="mt-2 rounded-lg bg-peach-light/40 px-3 py-1.5 text-xs text-cocoa-light">{o.notes}</p>}

                      <div className="mt-3 flex items-center gap-2 border-t border-peach/50 pt-3">
                        <Badge tone={STATUS_TONE[o.status]}>
                          {ORDER_STATUSES.find((s) => s.value === o.status)?.label}
                        </Badge>
                        <div className="ml-auto flex items-center gap-2">
                          <Select
                            value={o.status}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                            className="h-9 w-40 text-sm"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </Select>
                          <button onClick={() => setDeleting(o)} className="text-cocoa-soft hover:text-danger" aria-label="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <OrderForm open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            for (const it of orderItems.filter((x) => x.order_id === deleting.id)) {
              await remove(TABLES.order_items, it.id);
            }
            await remove(TABLES.orders, deleting.id);
            toast("Pedido eliminado");
          } catch (e) {
            toast(e instanceof Error ? e.message : "No se pudo eliminar.", "error");
            throw e;
          }
        }}
        title="Eliminar pedido"
        message="¿Eliminar este pedido? Esta acción no se puede deshacer."
      />
    </div>
  );
}
