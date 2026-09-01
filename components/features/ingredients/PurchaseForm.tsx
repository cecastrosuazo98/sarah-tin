"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { registerPurchase } from "@/lib/data/repo";
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
  const [asExpense, setAsExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && ingredient) {
      const u = compatibleUnits(ingredient.unit);
      setUnit(u[u.length - 1]);
      setQty(0);
      setCost(0);
      setAsExpense(true);
    }
  }, [open, ingredient]);

  const save = async () => {
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
        registerAsExpense: asExpense,
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
      description="Suma stock y recalcula el costo por unidad."
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
        <label className="flex items-center gap-2 text-sm text-cocoa">
          <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} className="h-4 w-4 accent-sarah" />
          Registrar también como gasto
        </label>
      </div>
    </Modal>
  );
}
