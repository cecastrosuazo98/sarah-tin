"use client";

import { useMemo, useState } from "react";
import { Plus, Users, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { CustomerForm } from "@/components/features/customers/CustomerForm";
import { CustomerDetail } from "@/components/features/customers/CustomerDetail";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { TABLES } from "@/lib/data/types";
import type { Customer, Sale } from "@/lib/data/types";
import { customerDebt, totalReceivable } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";

export default function ClientesPage() {
  const { data: customers, loading } = useTable<Customer>(TABLES.customers);
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  useAutoOpen(() => setFormOpen(true));

  const receivable = totalReceivable(sales);
  const list = useMemo(() => {
    const filtered = customers.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    return filtered
      .map((c) => ({ ...c, debt: customerDebt(c.id, sales) }))
      .sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name));
  }, [customers, sales, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Historial, deudas y pagos de cada cliente."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {receivable > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-danger/20 bg-[#FBEDED]/60 px-4 py-3">
          <span className="text-sm font-medium text-cocoa">Total por cobrar</span>
          <span className="font-display text-lg font-extrabold text-danger">{formatMoney(receivable)}</span>
        </div>
      )}

      {customers.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-soft" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
        </div>
      )}

      {!loading && customers.length === 0 ? (
        <EmptyState
          icon={Users}
          emoji="👥"
          title="Todavía no tienes clientes"
          description="Agrega clientes para llevar su historial de compras y deudas."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar cliente</Button>}
        />
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setDetail(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-4 text-left shadow-card transition hover:shadow-lift"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sarah-50 font-display text-lg font-bold text-sarah-dark">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cocoa">{c.name}</p>
                {c.phone && <p className="text-xs text-cocoa-soft">{c.phone}</p>}
              </div>
              {c.debt > 0 ? (
                <Badge tone="danger">Debe {formatMoney(c.debt)}</Badge>
              ) : (
                <Badge tone="success">Al día</Badge>
              )}
              <ChevronRight className="h-4 w-4 text-cocoa-soft" />
            </button>
          ))}
        </div>
      )}

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CustomerDetail
        customer={detail}
        onClose={() => setDetail(null)}
        onEdit={(c) => { setDetail(null); setEditing(c); setFormOpen(true); }}
      />
    </div>
  );
}
