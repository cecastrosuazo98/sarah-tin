"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { createSale } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Product, Customer, PaymentMethod, PaymentStatus } from "@/lib/data/types";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type CartLine = { productId: string | null; name: string; quantity: number; unitPrice: number };

export function SaleForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: products } = useTable<Product>(TABLES.products);
  const { data: customers } = useTable<Customer>(TABLES.customers);

  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [status, setStatus] = useState<PaymentStatus>("pagado");
  const [partial, setPartial] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setCart([]);
      setMethod("efectivo");
      setStatus("pagado");
      setPartial(0);
    }
  }, [open]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [cart]
  );

  const addProduct = (id: string) => {
    if (!id) return;
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setCart((c) => {
      const existing = c.find((l) => l.productId === id);
      if (existing) {
        return c.map((l) => (l.productId === id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...c, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.sale_price }];
    });
  };

  const setQty = (idx: number, delta: number) =>
    setCart((c) =>
      c
        .map((l, i) => (i === idx ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );

  const save = async () => {
    if (cart.length === 0) {
      toast("Agrega al menos un producto.", "error");
      return;
    }
    if (status !== "pagado" && !customerId) {
      toast("Para ventas fiadas elige un cliente.", "error");
      return;
    }
    setSaving(true);
    try {
      await createSale({
        customerId: customerId || null,
        items: cart,
        method: status === "pagado" ? method : "fiado",
        status,
        paidAmount: status === "abono" ? partial : 0,
      });
      toast("Venta registrada correctamente 💕");
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo registrar la venta."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Nueva venta"
      footer={
        <>
          <div className="flex-1">
            <p className="text-xs text-cocoa-light">Total</p>
            <p className="font-display text-xl font-extrabold text-cocoa">{formatMoney(total)}</p>
          </div>
          <Button className="flex-[2]" onClick={save} disabled={saving}>
            Registrar venta
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Cliente" hint="Opcional (obligatorio si es fiado).">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Sin cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Agregar producto">
          <Select
            value=""
            onChange={(e) => { addProduct(e.target.value); e.target.value = ""; }}
          >
            <option value="">Elige un producto…</option>
            {products.filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.sale_price)}</option>
            ))}
          </Select>
        </Field>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl bg-peach-light/40 px-3 py-6 text-center text-sm text-cocoa-soft">
            <ShoppingCart className="h-6 w-6" />
            Agrega productos a la venta.
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl border border-peach/50 bg-white/60 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-cocoa">{l.name}</p>
                  <p className="text-xs text-cocoa-soft">{formatMoney(l.unitPrice)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-peach-light text-cocoa" aria-label="Menos">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-semibold text-cocoa">{l.quantity}</span>
                  <button onClick={() => setQty(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-peach-light text-cocoa" aria-label="Más">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-bold text-cocoa">{formatMoney(l.quantity * l.unitPrice)}</p>
                <button onClick={() => setCart((c) => c.filter((_, i) => i !== idx))} className="text-danger" aria-label="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado del pago">
            <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              <option value="pagado">Pagado</option>
              <option value="abono">Abono parcial</option>
              <option value="pendiente">Fiado / pendiente</option>
            </Select>
          </Field>
          {status === "pagado" ? (
            <Field label="Método de pago">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.filter((m) => m.value !== "fiado").map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </Field>
          ) : status === "abono" ? (
            <Field label="Abono recibido">
              <MoneyInput value={partial} onChange={setPartial} />
            </Field>
          ) : (
            <Field label=" ">
              <div className="flex h-11 items-center rounded-xl bg-[#FBEDED] px-3 text-sm font-medium text-danger">
                Quedará como deuda
              </div>
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
