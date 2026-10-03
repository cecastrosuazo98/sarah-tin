"use client";

import { useMemo, useState } from "react";
import { Plus, Users, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { CustomerForm } from "@/components/features/customers/CustomerForm";
import { CustomerDetail } from "@/components/features/customers/CustomerDetail";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { remove } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Customer, Sale } from "@/lib/data/types";
import { customerDebt } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";

export default function ClientesPage() {
  const toast = useToast();
  const { data: customers, loading } = useTable<Customer>(TABLES.customers);
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  useAutoOpen(() => setFormOpen(true));

  const withDebt = useMemo(
    () => customers.map((c) => ({ ...c, debt: customerDebt(c.id, sales) })),
    [customers, sales]
  );
  const debtors = withDebt.filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);
  const totalOwed = debtors.reduce((s, c) => s + c.debt, 0);
  const others = withDebt
    .filter((c) => c.debt <= 0 && matchesSearch(query, c.name, c.phone))
    .sort((a, b) => a.name.localeCompare(b.name));
  const searching = query.trim().length > 0;
  const visibleDebtors = debtors.filter((c) => matchesSearch(query, c.name, c.phone));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Quién te debe y las personas que te compran."
        action={
          <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {!loading && customers.length === 0 ? (
        <EmptyState
          icon={Users}
          emoji="👥"
          title="Todavía no tienes clientes"
          description="Se agregan solos cuando registras una venta y escribes un nombre nuevo. También puedes agregarlos aquí."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar cliente</Button>}
        />
      ) : (
        <>
          {customers.length > 6 && (
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre…" />
          )}

          {/* ¿Quién me debe? */}
          <section className="rounded-3xl border border-peach/60 bg-white/80 p-4 shadow-card">
            <h2 className="font-display text-xl font-extrabold text-cocoa">¿Quién me debe?</h2>
            {debtors.length === 0 ? (
              <p className="mt-2 text-cocoa-light">Nadie te debe. 🎉</p>
            ) : (
              <>
                <div className="mt-2 divide-y divide-peach/50">
                  {visibleDebtors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDetail(c)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-lg font-semibold text-cocoa">{c.name}</span>
                      <span className="font-display text-lg font-extrabold text-danger">{formatMoney(c.debt)}</span>
                      <ChevronRight className="h-5 w-5 text-cocoa-soft" />
                    </button>
                  ))}
                  {searching && visibleDebtors.length === 0 && (
                    <p className="py-3 text-sm text-cocoa-soft">Nadie con ese nombre te debe.</p>
                  )}
                </div>
                {!searching && (
                  <div className="mt-1 flex items-center justify-between border-t-2 border-peach pt-3">
                    <span className="font-bold uppercase tracking-wide text-cocoa">Total</span>
                    <span className="font-display text-2xl font-extrabold text-danger">{formatMoney(totalOwed)}</span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* El resto de los clientes */}
          {others.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg font-bold text-cocoa">Al día</h2>
              <div className="space-y-2">
                {others.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDetail(c)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/70 p-3 text-left transition hover:shadow-card"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sarah-50 font-display font-bold text-sarah-dark">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-cocoa">{c.name}</span>
                    <ChevronRight className="h-4 w-4 text-cocoa-soft" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {searching && others.length === 0 && visibleDebtors.length === 0 && (
            <EmptyState emoji="🔍" title="Sin resultados" description="No hay clientes con ese nombre." />
          )}
        </>
      )}

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CustomerDetail
        customer={detail}
        onClose={() => setDetail(null)}
        onEdit={(c) => { setDetail(null); setEditing(c); setFormOpen(true); }}
        onDelete={(c) => { setDetail(null); setDeleting(c); }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove(TABLES.customers, deleting.id);
            toast("Cliente eliminado");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo eliminar el cliente."), "error");
            throw e;
          }
        }}
        title="Eliminar cliente"
        message={
          deleting && customerDebt(deleting.id, sales) > 0
            ? `${deleting.name} te debe ${formatMoney(customerDebt(deleting.id, sales))}. Si lo eliminas, ya no sabrás quién te debía y sus ventas quedarán sin nombre. ¿Continuar?`
            : `¿Eliminar a ${deleting?.name}? Sus ventas quedarán sin nombre. Esto no se puede deshacer.`
        }
      />
    </div>
  );
}
