"use client";

import { useMemo, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { useSettings } from "@/lib/data/settings";
import { addExpense } from "@/lib/data/repo";
import { remove } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Expense } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { startOfMonth, inRange } from "@/lib/domain/dates";

export default function GastosPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const { data: expenses, loading } = useTable<Expense>(TABLES.expenses);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  useAutoOpen(() => setOpen(true));

  const [category, setCategory] = useState(settings.expense_categories[0] ?? "Otros");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromCash, setFromCash] = useState(false);

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [expenses]
  );
  const now = new Date();
  const monthTotal = expenses
    .filter((e) => inRange(e.expense_date, startOfMonth(now), now))
    .reduce((s, e) => s + e.amount, 0);

  const save = async () => {
    if (!description.trim() || amount <= 0) {
      toast("Completa la descripción y el monto.", "error");
      return;
    }
    try {
      await addExpense({ category, description: description.trim(), amount, date, payFromCash: fromCash });
      toast("Gasto registrado 💕");
      setOpen(false);
      setDescription("");
      setAmount(0);
      setFromCash(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  };

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

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          emoji="💸"
          title="Todavía no hay gastos"
          description="Registra tus gastos para ver tu resultado real del mes."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registrar gasto</Button>}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF1DA] text-gold-dark">
                <Receipt className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cocoa">{e.description}</p>
                <div className="flex items-center gap-2">
                  {e.category && <Badge tone="gold">{e.category}</Badge>}
                  <span className="text-xs text-cocoa-soft">
                    {new Date(e.expense_date + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
              <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(e.amount)}</p>
              <button onClick={() => setDeleting(e)} className="text-cocoa-soft hover:text-danger" aria-label="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo gasto"
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={save}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Descripción" required>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Compra de harina" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {settings.expense_categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Monto" required>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
          </div>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-cocoa">
            <input type="checkbox" checked={fromCash} onChange={(e) => setFromCash(e.target.checked)} className="h-4 w-4 accent-sarah" />
            Pagar desde la caja (efectivo)
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await remove(TABLES.expenses, deleting.id);
            toast("Gasto eliminado");
          }
        }}
        title="Eliminar gasto"
        message="¿Eliminar este gasto? Esta acción no se puede deshacer."
      />
    </div>
  );
}
