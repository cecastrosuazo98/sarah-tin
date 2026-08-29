"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { create, update } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Ingredient, BaseUnit } from "@/lib/data/types";
import { INGREDIENT_TYPES, UNIT_LABEL } from "@/lib/domain/units";
import { formatMoney } from "@/lib/format";

/**
 * Alta/edición de ingrediente. El costo se ingresa como "compré X por $Y" y el
 * sistema calcula automáticamente el costo por unidad base.
 */
export function IngredientForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Ingredient | null;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [base, setBase] = useState<BaseUnit>("g");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [buyQty, setBuyQty] = useState(0);
  const [buyCost, setBuyCost] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setBase((editing?.unit as BaseUnit) ?? "g");
      setCategory(editing?.category ?? "");
      setStock(editing?.stock ?? 0);
      setMinStock(editing?.min_stock ?? 0);
      // Costo por unidad base convertido a la unidad de compra habitual.
      setBuyQty(0);
      setBuyCost(0);
    }
  }, [open, editing]);

  // Unidad de compra amigable (kg/l/unidad) para calcular costo por base.
  const buyUnitFactor = base === "unidad" ? 1 : 1000; // 1 kg=1000g, 1 l=1000ml
  const buyUnitLabel = base === "g" ? "kg" : base === "ml" ? "l" : "un";
  const computedCostPerUnit =
    buyQty > 0 ? buyCost / (buyQty * buyUnitFactor) : editing?.cost_per_unit ?? 0;

  const save = async () => {
    if (!name.trim()) {
      toast("Escribe el nombre del ingrediente.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        unit: base,
        stock,
        min_stock: minStock,
        cost_per_unit: computedCostPerUnit,
      };
      if (editing) {
        await update(TABLES.ingredients, editing.id, payload);
        toast("Ingrediente actualizado 💕");
      } else {
        await create(TABLES.ingredients, {
          ...payload,
          supplier: null,
          last_purchase_at: buyQty > 0 ? new Date().toISOString() : null,
        });
        toast("Ingrediente agregado 💕");
      }
      onClose();
    } catch {
      toast("No pudimos guardar. Intenta de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar ingrediente" : "Nuevo ingrediente"}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Harina" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de medida">
            <Select value={base} onChange={(e) => setBase(e.target.value as BaseUnit)}>
              {INGREDIENT_TYPES.map((t) => (
                <option key={t.base} value={t.base}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Secos, Frescos…" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Stock actual (${UNIT_LABEL[base]})`}>
            <NumberInput value={stock} onChange={setStock} suffix={UNIT_LABEL[base]} />
          </Field>
          <Field label={`Stock mínimo (${UNIT_LABEL[base]})`} hint="Aviso de stock bajo">
            <NumberInput value={minStock} onChange={setMinStock} suffix={UNIT_LABEL[base]} />
          </Field>
        </div>

        <div className="rounded-2xl border border-peach/60 bg-peach-light/40 p-4">
          <p className="mb-2 text-sm font-semibold text-cocoa">Costo (opcional)</p>
          <p className="mb-3 text-xs text-cocoa-light">
            Ingresa cuánto compraste y su precio; calculamos el costo por unidad.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Compré (${buyUnitLabel})`}>
              <NumberInput value={buyQty} onChange={setBuyQty} suffix={buyUnitLabel} />
            </Field>
            <Field label="Precio total">
              <MoneyInput value={buyCost} onChange={setBuyCost} />
            </Field>
          </div>
          {computedCostPerUnit > 0 && (
            <p className="mt-2 text-sm font-semibold text-success">
              ≈ {formatMoney(computedCostPerUnit * buyUnitFactor)} por {buyUnitLabel}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
