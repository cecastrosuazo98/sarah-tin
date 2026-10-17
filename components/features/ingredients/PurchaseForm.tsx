"use client";

import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { registerPurchase, newOperationKey } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Ingredient, MeasureUnit } from "@/lib/data/types";
import { compatibleUnits } from "@/lib/domain/units";

export function PurchaseForm({
  open,
  onClose,
  ingredient,
}: {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
}) {
  const toast = useToast();
  const units = ingredient ? compatibleUnits(ingredient.unit) : (["unidad"] as MeasureUnit[]);
  const [qty, setQty] = useState(0);
  const [unit, setUnit] = useState<MeasureUnit>(units[units.length - 1]);
  const [cost, setCost] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [opKey, setOpKey] = useState(newOperationKey);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && ingredient) {
      const u = compatibleUnits(ingredient.unit);
      setUnit(u[u.length - 1]);
      setQty(0);
      setCost(0);
      setSupplier(ingredient.supplier ?? "");
      setPaidNow(true);
      setOpKey(newOperationKey());
    }
  }, [open, ingredient]);

  // Bloqueo inmediato contra doble toque (el estado "saving" llega un render tarde).
  const guard = useRef(false);
  const save = async () => {
    if (guard.current) return;
    guard.current = true;
    try {
      await saveInner();
    } finally {
      guard.current = false;
    }
  };
  const saveInner = async () => {
    if (!ingredient) return;
    if (qty <= 0 || cost <= 0) {
      toast("Ingresa la cantidad y el precio.", "error");
      return;
    }
    setSaving(true);
    try {
      await registerPurchase({
        ingredientId: ingredient.id,
        quantity: qty,
        unit,
        totalCost: cost,
        supplier: supplier.trim() || undefined,
        paidAmount: paidNow ? cost : 0,
        key: opKey,
      });
      toast("Compra registrada 💕");
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo registrar."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Compra de ${ingredient?.name ?? ""}`}
      description="Suma stock y actualiza el costo. Las compras de insumos van a inventario: no se cuentan como gasto."
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Registrar compra</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad">
            <NumberInput value={qty} onChange={setQty} />
          </Field>
          <Field label="Unidad">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as MeasureUnit)}>
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Precio total pagado">
          <MoneyInput value={cost} onChange={setCost} />
        </Field>
        <Field label="Proveedor" hint="Opcional.">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej: distribuidora" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-cocoa">
          <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-4 w-4 accent-sarah" />
          Pagada ahora (si no, queda como cuenta por pagar)
        </label>
      </div>
    </Modal>
  );
}
