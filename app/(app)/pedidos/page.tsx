"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, CalendarDays, Clock, Trash2, ChevronDown, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { OrderForm } from "@/components/features/orders/OrderForm";
import { DeliverOrder } from "@/components/features/orders/DeliverOrder";
import { itemsText } from "@/components/features/sales/sale-text";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { updateOrderStatus, deleteOrder } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Order, OrderItem, Customer } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { addDays, toYmd } from "@/lib/domain/dates";

const isDone = (o: Order) => o.status === "entregado" || o.status === "cancelado";

/** Grupo del pedido según su fecha de entrega (fechas locales, no UTC). */
function bucketOf(dateStr: string, now: Date): string {
  const today = toYmd(now);
  if (dateStr < today) return "Atrasados";
  if (dateStr === today) return "Hoy";
  if (dateStr === toYmd(addDays(now, 1))) return "Mañana";
  if (dateStr <= toYmd(addDays(now, 7))) return "Esta semana";
  return "Más adelante";
}

const BUCKETS = ["Atrasados", "Hoy", "Mañana", "Esta semana", "Más adelante"];

export default function PedidosPage() {
  const toast = useToast();
  const { data: orders, loading } = useTable<Order>(TABLES.orders);
  const { data: orderItems } = useTable<OrderItem>(TABLES.order_items);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [query, setQuery] = useState("");
  // "Hoy" depende del reloj del navegador: solo en el cliente (hidratación).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  useAutoOpen(() => setOpen(true));

  const itemsOf = (orderId: string) => orderItems.filter((it) => it.order_id === orderId);
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? null;

  const filtered = useMemo(
    () =>
      orders
        .filter((o) =>
          matchesSearch(
            query,
            customers.find((c) => c.id === o.customer_id)?.name,
            o.code,
            orderItems.filter((it) => it.order_id === o.id).map((it) => it.name_snapshot).join(" "),
            o.notes
          )
        )
        .sort((a, b) => a.order_date.localeCompare(b.order_date) || (a.order_time ?? "").localeCompare(b.order_time ?? "")),
    [orders, customers, orderItems, query]
  );

  const pending = filtered.filter((o) => !isDone(o));
  const done = filtered.filter(isDone).reverse();
  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    if (!now) return map;
    for (const o of pending) {
      const b = bucketOf(o.order_date, now);
      map.set(b, [...(map.get(b) ?? []), o]);
    }
    return map;
  }, [pending, now]);

  // Se busca en la lista fresca para que el diálogo vea el estado actualizado.
  const delivering = orders.find((o) => o.id === deliveringId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Lo que tienes que entregar."
        action={<Button variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      {orders.length > 6 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre o producto…" />
      )}

      {!loading && orders.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          emoji="📅"
          title="No tienes pedidos"
          description="Anota aquí lo que te encargan, con el día de entrega."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo pedido</Button>}
        />
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-peach-dark bg-white/50 px-5 py-8 text-center text-cocoa-light">
              {query ? "No hay pedidos con ese nombre." : "No tienes pedidos por entregar. 🎉"}
            </div>
          ) : (
            BUCKETS.filter((b) => groups.has(b)).map((bucket) => (
              <section key={bucket}>
                <h2 className={`mb-2 font-display text-lg font-bold ${bucket === "Atrasados" ? "text-danger" : "text-cocoa"}`}>
                  {bucket}
                </h2>
                <div className="space-y-2">
                  {groups.get(bucket)!.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      items={itemsOf(o.id)}
                      customerName={customerName(o.customer_id)}
                      onDeliver={() => setDeliveringId(o.id)}
                      onReady={() => updateOrderStatus(o.id, o.status === "listo" ? "pendiente" : "listo")}
                      onDelete={() => setDeleting(o)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {done.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex w-full items-center justify-between py-2 text-sm font-semibold text-cocoa-light"
              >
                Entregados ({done.length})
                <ChevronDown className={`h-4 w-4 transition ${showDone ? "rotate-180" : ""}`} />
              </button>
              {showDone && (
                <div className="space-y-2">
                  {done.map((o) => (
                    <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-cocoa">{customerName(o.customer_id) ?? "Sin nombre"}</p>
                        <p className="truncate text-cocoa-light">{itemsText(itemsOf(o.id))}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-cocoa">{formatMoney(o.total)}</p>
                        <p className="text-xs text-cocoa-soft">
                          {o.status === "cancelado" ? "Cancelado" : "Entregado"} ·{" "}
                          {new Date(o.order_date + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <OrderForm open={open} onClose={() => setOpen(false)} />
      <DeliverOrder
        order={deliveringId ? delivering : null}
        items={delivering ? itemsOf(delivering.id) : []}
        customerName={delivering ? customerName(delivering.customer_id) : null}
        onClose={() => setDeliveringId(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteOrder(deleting.id);
            toast("Pedido eliminado");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo eliminar."), "error");
            throw e;
          }
        }}
        title="Eliminar pedido"
        message="¿Eliminar este pedido? Úsalo si se canceló o lo anotaste por error. No se puede deshacer."
      />
    </div>
  );
}

function OrderCard({
  order: o,
  items,
  customerName,
  onDeliver,
  onReady,
  onDelete,
}: {
  order: Order;
  items: OrderItem[];
  customerName: string | null;
  onDeliver: () => void;
  onReady: () => void;
  onDelete: () => void;
}) {
  const date = new Date(o.order_date + "T00:00:00");
  const ready = o.status === "listo";
  return (
    <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tin-50 leading-none">
          <span className="text-[0.65rem] font-semibold text-tin-dark">
            {date.toLocaleDateString("es-CL", { month: "short" })}
          </span>
          <span className="font-display text-lg font-extrabold text-cocoa">{date.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-cocoa">{customerName ?? "Sin nombre"}</p>
          <p className="text-sm text-cocoa-light">{itemsText(items)}</p>
          {o.order_time && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-cocoa-soft">
              <Clock className="h-3 w-3" /> {o.order_time}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(o.total)}</p>
          {o.deposit >= o.total && o.total > 0 ? (
            <Badge tone="success">Pagado</Badge>
          ) : o.deposit > 0 ? (
            <Badge tone="warning">Pagó {formatMoney(o.deposit)}</Badge>
          ) : (
            <Badge tone="neutral">Sin adelanto</Badge>
          )}
        </div>
      </div>

      {o.notes && <p className="mt-2 rounded-lg bg-peach-light/40 px-3 py-1.5 text-sm text-cocoa-light">{o.notes}</p>}

      <div className="mt-3 flex items-center gap-2 border-t border-peach/50 pt-3">
        <Button className="flex-1" onClick={onDeliver}>
          <Check className="h-4 w-4" /> Lo entregué
        </Button>
        <button
          type="button"
          onClick={onReady}
          aria-pressed={ready}
          className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
            ready ? "bg-[#EAF4EB] text-success" : "text-cocoa-light hover:bg-peach-light"
          }`}
        >
          {ready ? "✓ Ya está listo" : "Marcar listo"}
        </button>
        <button type="button" onClick={onDelete} className="p-2 text-cocoa-soft hover:text-danger" aria-label="Eliminar pedido">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
