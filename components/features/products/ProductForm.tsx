"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { MoneyInput, NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { useSettings } from "@/lib/data/settings";
import { create, update } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Product, Recipe, RecipeIngredient, Ingredient } from "@/lib/data/types";
import { computeRecipeCost, computeProductEconomics } from "@/lib/domain/costing";
import { formatMoney, formatPercent } from "@/lib/format";

export function ProductForm({
  open,
  onClose,
  editing,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Product | null;
  onDelete?: (p: Product) => void;
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
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowDetails(false);
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
    if (salePrice <= 0) {
      toast("¿A qué precio lo vendes?", "error");
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
    } catch (e) {
      toast(getErrorMessage(e, "No pudimos guardar el producto."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar producto" : "Nuevo producto"}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="¿Cómo se llama?" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Brownie" className="h-12 text-base" />
        </Field>
        <Field label="¿A qué precio lo vendes?" required hint="El precio de una unidad. Se usa solo al registrar ventas.">
          <MoneyInput value={salePrice} onChange={setSalePrice} className="h-12 text-lg" />
        </Field>

        {econ.cost > 0 && salePrice > 0 && (
          <p className="rounded-xl bg-[#EAF4EB] px-3 py-2 text-sm text-cocoa">
            Te cuesta hacerlo {formatMoney(econ.cost)}: ganas <b className="text-success">{formatMoney(econ.profit)}</b> por cada uno.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl bg-peach-light/50 px-3 py-2.5 text-sm font-semibold text-cocoa-light"
        >
          Más detalles (opcional): costos, receta, categoría
          <ChevronDown className={`h-4 w-4 transition ${showDetails ? "rotate-180" : ""}`} />
        </button>

        {showDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {settings.product_categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="¿Cuántos tienes hechos?">
                <NumberInput value={stock} onChange={setStock} />
              </Field>
            </div>

            <Field label="Receta" hint="Si eliges una, el costo se calcula solo.">
              <SearchSelect
                value={recipeId}
                onChange={setRecipeId}
                placeholder="Sin receta"
                searchPlaceholder="Buscar receta…"
                options={[
                  { value: "", label: "Sin receta" },
                  ...recipes.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </Field>

            <Field label="Otros costos por unidad" hint="Envase, caja, decoración…">
              <MoneyInput value={additionalCost} onChange={setAdditionalCost} />
            </Field>

            <Field label="Descripción">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción…" />
            </Field>

            {/* Panel de economía */}
            <div className="rounded-2xl border border-peach/60 bg-peach-light/30 p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[0.7rem] text-cocoa-light">Te cuesta</p>
                  <p className="font-bold text-cocoa">{formatMoney(econ.cost)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] text-cocoa-light">Ganas</p>
                  <p className="font-bold text-success">{formatMoney(econ.profit)}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] text-cocoa-light">Margen</p>
                  <p className={`font-bold ${econ.belowTarget ? "text-danger" : "text-cocoa"}`}>
                    {formatPercent(econ.margin, 1)}
                  </p>
                </div>
              </div>

              {econ.belowTarget && econ.cost > 0 && (
                <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#FBEDED] px-3 py-2 text-xs font-medium text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ganas menos de lo que te propusiste ({formatPercent(settings.target_margin, 0)}).
                </p>
              )}

              {econ.cost > 0 && (
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
              )}
            </div>
          </div>
        )}

        {editing && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(editing)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-danger transition hover:bg-[#FBEDED]"
          >
            <Trash2 className="h-4 w-4" /> Eliminar producto
          </button>
        )}
      </div>
    </Modal>
  );
}
