"use client";

import { useMemo, useState } from "react";
import { Plus, ShoppingCart, Ban } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoidDialog } from "@/components/ui/void-dialog";
import { useToast } from "@/components/ui/toast";
import { SaleForm } from "@/components/features/sales/SaleForm";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { voidSale } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
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
  const [query, setQuery] = useState("");
  useAutoOpen(() => setOpen(true));

  const sorted = useMemo(
    () => [...sales].sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date)),
    [sales]
  );

  const filtered = sorted.filter((s) => {
    const customer = customers.find((c) => c.id === s.customer_id)?.name ?? "";
    const items = saleItems
      .filter((it) => it.sale_id === s.id)
      .map((it) => it.name_snapshot)
      .join(" ");
    return matchesSearch(query, customer, items, methodLabel(s.method), s.notes);
  });

  const now = new Date();
  const active = sales.filter((s) => !s.voided_at);
  const todayTotal = active
    .filter((s) => inRange(s.sale_date, startOfDay(now), now))
    .reduce((s, x) => s + x.total, 0);
  const monthTotal = active
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

      {sorted.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por cliente o producto…" />
      )}

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          emoji="🛒"
          title="Todavía no hay ventas"
          description="Registra tu primera venta y empieza a llevar el control del día."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva venta</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay ventas que coincidan con tu búsqueda." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const items = saleItems.filter((it) => it.sale_id === s.id);
            const customer = customers.find((c) => c.id === s.customer_id);
            const summary = items.map((it) => `${it.quantity}× ${it.name_snapshot}`).join(", ");
            return (
              <div key={s.id} className={`flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card ${s.voided_at ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-cocoa">{customer?.name ?? "Venta sin cliente"}</p>
                    {s.voided_at ? (
                      <Badge tone="danger">Anulada</Badge>
                    ) : s.status === "pagado" ? (
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
                  <p className={`font-display text-lg font-extrabold text-cocoa ${s.voided_at ? "line-through" : ""}`}>{formatMoney(s.total)}</p>
                  {!s.voided_at && s.status !== "pagado" && (
                    <p className="text-xs font-medium text-danger">Debe {formatMoney(s.total - s.paid_amount)}</p>
                  )}
                </div>
                {!s.voided_at && (
                  <button onClick={() => setDeleting(s)} className="text-cocoa-soft hover:text-danger" aria-label="Anular venta" title="Anular venta">
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SaleForm open={open} onClose={() => setOpen(false)} />
      <VoidDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          if (!deleting) return;
          try {
            await voidSale(deleting.id, reason);
            toast("Venta anulada y stock repuesto");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo anular."), "error");
            throw e;
          }
        }}
        title="Anular venta"
        message="La venta no se borra: queda marcada como anulada (con el motivo), se repone el stock y sus cobros dejan de contar."
      />
    </div>
  );
}
