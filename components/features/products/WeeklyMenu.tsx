"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { productEmoji } from "@/components/features/sales/sale-text";
import { update } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Product } from "@/lib/data/types";
import { WEEKDAYS, WEEK_ORDER, inMenu, weekdayPlural } from "@/lib/domain/planning";
import { cn } from "@/lib/utils";

/**
 * Menú de la semana: qué se vende cada día. Esos productos aparecen primero
 * al registrar una venta y en "Para preparar".
 */
export function WeeklyMenu({ products }: { products: Product[] }) {
  const toast = useToast();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // El día de hoy depende del reloj del navegador: solo en el cliente.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(new Date().getDay()), []);

  const active = products.filter((p) => p.is_active).sort((a, b) => a.name.localeCompare(b.name));
  if (active.length === 0) return null;

  const open = (day: number) => {
    setSelected(new Set(active.filter((p) => inMenu(p, day)).map((p) => p.id)));
    setEditingDay(day);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (editingDay === null) return;
    setSaving(true);
    try {
      // Solo se actualizan los productos que cambiaron.
      for (const p of active) {
        const was = inMenu(p, editingDay);
        const now = selected.has(p.id);
        if (was === now) continue;
        const days = new Set(p.sale_days ?? []);
        if (now) days.add(editingDay);
        else days.delete(editingDay);
        await update(TABLES.products, p.id, { sale_days: Array.from(days).sort((a, b) => a - b) });
      }
      toast(`Menú de ${weekdayPlural(editingDay)} guardado`);
      setEditingDay(null);
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo guardar el menú."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-peach/60 bg-white/80 p-4 shadow-card">
      <h2 className="font-display text-lg font-extrabold text-cocoa">🗓️ Menú de la semana</h2>
      <p className="text-xs text-cocoa-light">
        Lo que vendes cada día. Aparece primero al registrar una venta. Toca un día para cambiarlo.
      </p>
      <ul className="mt-2 divide-y divide-peach/50">
        {WEEK_ORDER.map((day) => {
          const items = active.filter((p) => inMenu(p, day));
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => open(day)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left",
                  day === today && "bg-sarah-50/70"
                )}
              >
                <span className="w-24 shrink-0 font-semibold text-cocoa">
                  {WEEKDAYS[day]}
                  {day === today && <span className="block text-xs font-semibold text-sarah-dark">Hoy</span>}
                </span>
                <span className={cn("min-w-0 flex-1 text-sm", items.length ? "text-cocoa" : "text-cocoa-soft")}>
                  {items.length ? items.map((p) => p.name).join(", ") : "Nada definido"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-cocoa-soft" />
              </button>
            </li>
          );
        })}
      </ul>

      <Modal
        open={editingDay !== null}
        onClose={() => setEditingDay(null)}
        title={editingDay !== null ? `¿Qué vendes ${weekdayPlural(editingDay)}?` : ""}
        description="Marca los productos de ese día."
        footer={
          <Button size="lg" className="w-full" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        }
      >
        <div className="space-y-2">
          {active.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition",
                  on ? "border-sarah bg-sarah-50" : "border-peach/60 bg-white/80"
                )}
              >
                <span className="text-2xl" aria-hidden>{productEmoji(p.name, p.category)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-cocoa">{p.name}</span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border-2",
                    on ? "border-sarah bg-sarah text-white" : "border-peach-dark"
                  )}
                >
                  {on && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </section>
  );
}
