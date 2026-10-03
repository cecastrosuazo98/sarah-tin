"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { createOrder } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Customer, Product, Order } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { toYmd } from "@/lib/domain/dates";
import { normalize } from "@/lib/search";

type Line = { name: string; quantity: number; unitPrice: number; details: string };

export function OrderForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: products } = useTable<Product>(TABLES.products);
  const { data: orders } = useTable<Order>(TABLES.orders);

  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(() => toYmd(new Date()));
  const [time, setTime] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: 1, unitPrice: 0, details: "" }]);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setDate(toYmd(new Date()));
      setTime("");
      setLines([{ name: "", quantity: 1, unitPrice: 0, details: "" }]);
      setDeposit(0);
      setNotes("");
    }
  }, [open]);

  // Si el nombre coincide con un producto, el precio se completa solo.
  const setName = (idx: number, name: string) =>
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const p = products.find((x) => normalize(x.name).trim() === normalize(name).trim());
        return { ...l, name, unitPrice: l.unitPrice || p?.sale_price || 0 };
      })
    );

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [lines]
  );

  const nextCode = useMemo(() => {
    const nums = orders
      .map((o) => parseInt((o.code || "").replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 1023;
    return `#${max + 1}`;
  }, [orders]);

  const save = async () => {
    const valid = lines.filter((l) => l.name.trim() && l.quantity > 0);
    if (valid.length === 0) {
      toast("Agrega al menos un producto al pedido.", "error");
      return;
    }
    setSaving(true);
    try {
      await createOrder({
        customerId: customerId || null,
        code: nextCode,
        date,
        time: time || undefined,
        items: valid,
        deposit,
        notes: notes.trim() || undefined,
      });
      toast(`Pedido anotado para el ${new Date(date + "T00:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}`);
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo crear el pedido."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Nuevo pedido"
      footer={
        <>
          <div className="flex-1">
            <p className="text-xs text-cocoa-light">Total</p>
            <p className="font-display text-lg font-extrabold text-cocoa">{formatMoney(total)}</p>
          </div>
          <Button className="flex-[2]" onClick={save} disabled={saving}>Crear pedido</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="¿Para quién?">
          <SearchSelect
            value={customerId}
            onChange={setCustomerId}
            placeholder="Sin cliente"
            searchPlaceholder="Buscar cliente…"
            options={[
              { value: "", label: "Sin cliente" },
              ...customers.map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined })),
            ]}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="¿Qué día lo entregas?" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora (opcional)">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-cocoa">¿Qué te encargaron?</p>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-xl border border-peach/50 bg-white/60 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    list="order-products"
                    value={line.name}
                    onChange={(e) => setName(idx, e.target.value)}
                    placeholder="Producto (ej: Torta de chocolate)"
                    className="h-10 flex-1 rounded-xl border border-peach-dark bg-white/80 px-3 text-sm text-cocoa focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/30"
                  />
                  <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="text-danger" aria-label="Quitar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-cocoa-light">
                  <span>Cantidad</span>
                  <span>Precio de cada uno</span>
                </div>
                <div className="-mt-1 grid grid-cols-2 gap-2">
                  <NumberInput value={line.quantity} onChange={(v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))} />
                  <MoneyInput value={line.unitPrice} onChange={(v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unitPrice: v } : l)))} />
                </div>
                <Input
                  value={line.details}
                  onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, details: e.target.value } : l)))}
                  placeholder="Detalles (personas, decoración…)"
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <datalist id="order-products">
            {products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setLines((l) => [...l, { name: "", quantity: 1, unitPrice: 0, details: "" }])}>
            <Plus className="h-4 w-4" /> Agregar producto
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="¿Cuánto pagó por adelantado?" hint="Si no pagó nada, déjalo vacío">
            <MoneyInput value={deposit} onChange={setDeposit} />
          </Field>
        </div>

        <Field label="Notas (opcional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones especiales…" />
        </Field>
      </div>
    </Modal>
  );
}
