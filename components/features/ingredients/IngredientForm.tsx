"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { create, update } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
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
  const [costPerUnit, setCostPerUnit] = useState(0); // costo por unidad base
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
      setCostPerUnit(editing?.cost_per_unit ?? 0);
      setBuyQty(0);
      setBuyCost(0);
    }
  }, [open, editing]);

  // Unidad de compra amigable (kg/l/unidad) para mostrar y calcular el costo.
  const buyUnitFactor = base === "unidad" ? 1 : 1000; // 1 kg=1000g, 1 l=1000ml
  const buyUnitLabel = base === "g" ? "kg" : base === "ml" ? "l" : "un";
  const friendlyCost = Math.round(costPerUnit * buyUnitFactor);

  const calcFromPurchase = () => {
    if (buyQty > 0 && buyCost > 0) {
      setCostPerUnit(buyCost / (buyQty * buyUnitFactor));
    }
  };

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
        cost_per_unit: costPerUnit,
      };
      if (editing) {
        await update(TABLES.ingredients, editing.id, payload);
        toast("Ingrediente actualizado 💕");
      } else {
        await create(TABLES.ingredients, {
          ...payload,
          supplier: null,
          last_purchase_at: null,
        });
        toast("Ingrediente agregado 💕");
      }
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No pudimos guardar. Intenta de nuevo."), "error");
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
          <Field
            label={`Costo por ${buyUnitLabel}`}
            hint="Necesario para calcular el costo de tus recetas y productos."
          >
            <MoneyInput value={friendlyCost} onChange={(v) => setCostPerUnit(v / buyUnitFactor)} />
          </Field>

          {friendlyCost <= 0 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#FBF1DA] px-2.5 py-1.5 text-xs font-medium text-gold-dark">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Sin costo, tus recetas y productos quedarán en $0.
            </p>
          )}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-sarah-dark">
              ¿No sabes el costo por {buyUnitLabel}? Calcúlalo desde una compra
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label={`Compré (${buyUnitLabel})`}>
                <NumberInput value={buyQty} onChange={setBuyQty} suffix={buyUnitLabel} />
              </Field>
              <Field label="Precio total">
                <MoneyInput value={buyCost} onChange={setBuyCost} />
              </Field>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={calcFromPurchase}
              disabled={buyQty <= 0 || buyCost <= 0}
            >
              Calcular: {formatMoney(buyQty > 0 ? Math.round(buyCost / buyQty) : 0)} por {buyUnitLabel}
            </Button>
          </details>
        </div>
      </div>
    </Modal>
  );
}
