"use client";

import { useMemo, useState } from "react";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SaleForm } from "@/components/features/sales/SaleForm";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { remove } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Sale, SaleItem, Customer } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { startOfDay, startOfMonth, inRange } from "@/lib/domain/dates";

const methodLabel = (v: string) =>
  PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v;

export default function VentasPage() {
  const toast = useToast();
  const { data: sales, loading } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  useAutoOpen(() => setOpen(true));

  const sorted = useMemo(
    () => [...sales].sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date)),
    [sales]
  );

  const now = new Date();
  const todayTotal = sales
    .filter((s) => inRange(s.sale_date, startOfDay(now), now))
    .reduce((s, x) => s + x.total, 0);
  const monthTotal = sales
    .filter((s) => inRange(s.sale_date, startOfMonth(now), now))
    .reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        subtitle="Registra tus ventas del día en segundos."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
          <p className="text-xs text-cocoa-light">Hoy</p>
          <p className="font-display text-2xl font-extrabold text-cocoa">{formatMoney(todayTotal)}</p>
        </div>
        <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
          <p className="text-xs text-cocoa-light">Este mes</p>
          <p className="font-display text-2xl font-extrabold text-cocoa">{formatMoney(monthTotal)}</p>
        </div>
      </div>

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          emoji="🛒"
          title="Todavía no hay ventas"
          description="Registra tu primera venta y empieza a llevar el control del día."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva venta</Button>}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => {
            const items = saleItems.filter((it) => it.sale_id === s.id);
            const customer = customers.find((c) => c.id === s.customer_id);
            const summary = items.map((it) => `${it.quantity}× ${it.name_snapshot}`).join(", ");
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-cocoa">{customer?.name ?? "Venta sin cliente"}</p>
                    {s.status === "pagado" ? (
                      <Badge tone="success">{s.method === "fiado" ? "Pagado" : methodLabel(s.method)}</Badge>
                    ) : s.status === "abono" ? (
                      <Badge tone="warning">Abono</Badge>
                    ) : (
                      <Badge tone="danger">Pendiente</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-cocoa-light">{summary || "—"}</p>
                  <p className="text-xs text-cocoa-soft">
                    {new Date(s.sale_date).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(s.total)}</p>
                  {s.status !== "pagado" && (
                    <p className="text-xs font-medium text-danger">Debe {formatMoney(s.total - s.paid_amount)}</p>
                  )}
                </div>
                <button onClick={() => setDeleting(s)} className="text-cocoa-soft hover:text-danger" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SaleForm open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          for (const it of saleItems.filter((x) => x.sale_id === deleting.id)) {
            await remove(TABLES.sale_items, it.id);
          }
          await remove(TABLES.sales, deleting.id);
          toast("Venta eliminada");
        }}
        title="Eliminar venta"
        message="¿Eliminar esta venta? Esta acción no se puede deshacer."
      />
    </div>
  );
}
