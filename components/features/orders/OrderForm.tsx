"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { createOrder } from "@/lib/data/repo";
import { TABLES } from "@/lib/data/types";
import type { Customer, Product, Order } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";

type Line = { name: string; quantity: number; unitPrice: number; details: string };

export function OrderForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: products } = useTable<Product>(TABLES.products);
  const { data: orders } = useTable<Order>(TABLES.orders);

  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: 1, unitPrice: 0, details: "" }]);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setDate(new Date().toISOString().slice(0, 10));
      setTime("");
      setLines([{ name: "", quantity: 1, unitPrice: 0, details: "" }]);
      setDeposit(0);
      setNotes("");
    }
  }, [open]);

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
      toast("Pedido creado 💕");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear el pedido.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Nuevo pedido ${nextCode}`}
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
        <Field label="Cliente">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Sin cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de entrega" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-cocoa">Productos del pedido</p>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-xl border border-peach/50 bg-white/60 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    list="order-products"
                    value={line.name}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)))}
                    placeholder="Producto"
                    className="h-10 flex-1 rounded-xl border border-peach-dark bg-white/80 px-3 text-sm text-cocoa focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/30"
                  />
                  <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="text-danger" aria-label="Quitar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
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
          <Field label="Abono / seña" hint="Opcional">
            <MoneyInput value={deposit} onChange={setDeposit} />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones especiales…" />
        </Field>
      </div>
    </Modal>
  );
}
