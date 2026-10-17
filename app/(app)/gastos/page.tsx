"use client";

import { useMemo, useState } from "react";
import { Plus, Receipt, Ban } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoidDialog } from "@/components/ui/void-dialog";
import { ExpenseForm } from "@/components/features/expenses/ExpenseForm";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { voidExpense } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Expense } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { startOfMonth, inRange, toDate } from "@/lib/domain/dates";

export default function GastosPage() {
  const toast = useToast();
  const { data: expenses, loading } = useTable<Expense>(TABLES.expenses);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  useAutoOpen(() => setOpen(true));


  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [expenses]
  );
  const filtered = sorted.filter((e) => matchesSearch(query, e.description, e.category));
  const now = new Date();
  const monthTotal = expenses
    .filter((e) => !e.voided_at && inRange(e.expense_date, startOfMonth(now), now))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        subtitle="Registra tus gastos por categoría."
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
        <p className="text-xs text-cocoa-light">Gastos de este mes</p>
        <p className="font-display text-2xl font-extrabold text-gold-dark">{formatMoney(monthTotal)}</p>
      </div>

      {sorted.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar gasto…" />
      )}

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          emoji="💸"
          title="Todavía no hay gastos"
          description="Registra tus gastos para ver tu resultado real del mes."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registrar gasto</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay gastos que coincidan con tu búsqueda." />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className={`flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card ${e.voided_at ? "opacity-60" : ""}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF1DA] text-gold-dark">
                <Receipt className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cocoa">{e.description}</p>
                <div className="flex items-center gap-2">
                  {e.voided_at && <Badge tone="danger">Anulado</Badge>}
                  {e.category && <Badge tone="gold">{e.category}</Badge>}
                  <span className="text-xs text-cocoa-soft">
                    {toDate(e.expense_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
              <p className={`font-display text-lg font-extrabold text-cocoa ${e.voided_at ? "line-through" : ""}`}>{formatMoney(e.amount)}</p>
              {!e.voided_at && (
                <button onClick={() => setDeleting(e)} className="text-cocoa-soft hover:text-danger" aria-label="Anular gasto" title="Anular gasto">
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ExpenseForm open={open} onClose={() => setOpen(false)} />

      <VoidDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          if (!deleting) return;
          try {
            await voidExpense(deleting.id, reason);
            toast("Gasto anulado");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo anular."), "error");
            throw e;
          }
        }}
        title="Anular gasto"
        message="El gasto no se borra: queda marcado como anulado con su motivo y deja de contar en los totales."
      />
    </div>
  );
}
