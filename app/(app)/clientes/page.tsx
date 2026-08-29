"use client";

import { useMemo, useState } from "react";
import { Plus, Users, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    const filtered = customers.filter((c) => matchesSearch(query, c.name, c.phone));
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
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar cliente o teléfono…" />
      )}

      {!loading && customers.length === 0 ? (
        <EmptyState
          icon={Users}
          emoji="👥"
          title="Todavía no tienes clientes"
          description="Agrega clientes para llevar su historial de compras y deudas."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar cliente</Button>}
        />
      ) : list.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay clientes que coincidan con tu búsqueda." />
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
