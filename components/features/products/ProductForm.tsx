"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { useSettings } from "@/lib/data/settings";
import { create, update } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Product, Recipe, RecipeIngredient, Ingredient } from "@/lib/data/types";
import { computeRecipeCost, computeProductEconomics } from "@/lib/domain/costing";
import { formatMoney, formatPercent } from "@/lib/format";

export function ProductForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Product | null;
}) {
  const toast = useToast();
  const { settings } = useSettings();
  const { data: recipes } = useTable<Recipe>(TABLES.recipes);
  const { data: recipeIngredients } = useTable<RecipeIngredient>(TABLES.recipe_ingredients);
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(settings.product_categories[0] ?? "Otros");
  const [recipeId, setRecipeId] = useState("");
  const [additionalCost, setAdditionalCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setCategory(editing?.category ?? settings.product_categories[0] ?? "Otros");
    setRecipeId(editing?.recipe_id ?? "");
    setAdditionalCost(editing?.additional_cost ?? 0);
    setSalePrice(editing?.sale_price ?? 0);
    setStock(editing?.stock ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const recipeCostPerUnit = useMemo(() => {
    if (!recipeId) return 0;
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return 0;
    const lines = recipeIngredients.filter((l) => l.recipe_id === recipe.id);
    return computeRecipeCost(recipe, lines, ingredients).perYield;
  }, [recipeId, recipes, recipeIngredients, ingredients]);

  const econ = useMemo(
    () =>
      computeProductEconomics(
        { sale_price: salePrice, additional_cost: additionalCost },
        recipeCostPerUnit,
        settings.target_margin,
        settings.rounding
      ),
    [salePrice, additionalCost, recipeCostPerUnit, settings]
  );

  const save = async () => {
    if (!name.trim()) {
      toast("Escribe el nombre del producto.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        recipe_id: recipeId || null,
        additional_cost: additionalCost,
        sale_price: salePrice,
        stock,
      };
      if (editing) {
        await update(TABLES.products, editing.id, payload);
        toast("Producto actualizado 💕");
      } else {
        await create(TABLES.products, { ...payload, image_url: null, is_active: true });
        toast("Producto agregado 💕");
      }
      onClose();
    } catch {
      toast("No pudimos guardar el producto.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Editar producto" : "Nuevo producto"}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Queque tradicional" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {settings.product_categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stock">
            <NumberInput value={stock} onChange={setStock} />
          </Field>
        </div>

        <Field label="Receta asociada" hint="Opcional: usa el costo de una receta.">
          <Select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
            <option value="">Sin receta</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Costos adicionales" hint="Envase, decoración, etc.">
            <MoneyInput value={additionalCost} onChange={setAdditionalCost} />
          </Field>
          <Field label="Precio de venta" required>
            <MoneyInput value={salePrice} onChange={setSalePrice} />
          </Field>
        </div>

        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción…" />
        </Field>

        {/* Panel de economía */}
        <div className="rounded-2xl border border-peach/60 bg-peach-light/30 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[0.7rem] text-cocoa-light">Costo</p>
              <p className="font-bold text-cocoa">{formatMoney(econ.cost)}</p>
            </div>
            <div>
              <p className="text-[0.7rem] text-cocoa-light">Ganancia</p>
              <p className="font-bold text-success">{formatMoney(econ.profit)}</p>
            </div>
            <div>
              <p className="text-[0.7rem] text-cocoa-light">Margen</p>
              <p className={`font-bold ${econ.belowTarget ? "text-danger" : "text-cocoa"}`}>
                {formatPercent(econ.margin, 1)}
              </p>
            </div>
          </div>

          {econ.belowTarget && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#FBEDED] px-3 py-2 text-xs font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Bajo tu margen objetivo ({formatPercent(settings.target_margin, 0)}).
            </p>
          )}

          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm text-cocoa">
              <Sparkles className="h-4 w-4 text-gold" />
              Precio sugerido: <span className="font-bold">{formatMoney(econ.suggestedPrice)}</span>
            </div>
            <button
              type="button"
              onClick={() => setSalePrice(econ.suggestedPrice)}
              className="text-xs font-semibold text-sarah-dark hover:underline"
            >
              Usar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
