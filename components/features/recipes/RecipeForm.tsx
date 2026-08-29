"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { create, update, remove, createSilent } from "@/lib/data/client";
import { emitChange } from "@/lib/data/bus";
import { TABLES } from "@/lib/data/types";
import type { Ingredient, Recipe, RecipeIngredient, MeasureUnit } from "@/lib/data/types";
import { compatibleUnits } from "@/lib/domain/units";
import { computeRecipeCost } from "@/lib/domain/costing";
import { formatMoney } from "@/lib/format";

type Line = { ingredient_id: string; quantity: number; unit: MeasureUnit };

export function RecipeForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Recipe | null;
}) {
  const toast = useToast();
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);
  const { data: allLines } = useTable<RecipeIngredient>(TABLES.recipe_ingredients);

  const [name, setName] = useState("");
  const [yieldQty, setYieldQty] = useState(1);
  const [yieldUnit, setYieldUnit] = useState("unidad");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setYieldQty(editing?.yield_qty ?? 1);
    setYieldUnit(editing?.yield_unit ?? "unidad");
    setNotes(editing?.notes ?? "");
    if (editing) {
      setLines(
        allLines
          .filter((l) => l.recipe_id === editing.id)
          .map((l) => ({ ingredient_id: l.ingredient_id, quantity: l.quantity, unit: l.unit }))
      );
    } else {
      setLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const addLine = () => {
    const first = ingredients[0];
    if (!first) {
      toast("Primero agrega ingredientes.", "info");
      return;
    }
    setLines((l) => [
      ...l,
      { ingredient_id: first.id, quantity: 0, unit: compatibleUnits(first.unit)[0] },
    ]);
  };

  const cost = useMemo(() => {
    const fakeRecipe = { yield_qty: yieldQty } as Recipe;
    return computeRecipeCost(
      fakeRecipe,
      lines.map((l, i) => ({ ...l, id: String(i), recipe_id: "x", owner_id: "x", created_at: "" })),
      ingredients
    );
  }, [lines, yieldQty, ingredients]);

  const save = async () => {
    if (!name.trim()) {
      toast("Escribe el nombre de la receta.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        yield_qty: yieldQty || 1,
        yield_unit: yieldUnit,
        notes: notes.trim() || null,
      };
      let recipeId: string;
      if (editing) {
        await update(TABLES.recipes, editing.id, payload);
        recipeId = editing.id;
        // Reemplaza las líneas existentes.
        for (const l of allLines.filter((x) => x.recipe_id === editing.id)) {
          await remove(TABLES.recipe_ingredients, l.id);
        }
      } else {
        const rec = await create<Recipe>(TABLES.recipes, payload);
        recipeId = rec.id;
      }
      for (const l of lines) {
        if (!l.ingredient_id || l.quantity <= 0) continue;
        await createSilent(TABLES.recipe_ingredients, {
          recipe_id: recipeId,
          ingredient_id: l.ingredient_id,
          quantity: l.quantity,
          unit: l.unit,
        });
      }
      // Refresca la UI para mostrar los ingredientes recién guardados y
      // recalcular el costo de los productos que usan esta receta.
      emitChange();
      toast(editing ? "Receta actualizada 💕" : "Receta creada 💕");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No pudimos guardar la receta.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Editar receta" : "Nueva receta"}
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
          <Field label="Rendimiento" hint="¿Cuántas unidades/porciones rinde?">
            <NumberInput value={yieldQty} onChange={setYieldQty} min={1} />
          </Field>
          <Field label="Unidad de rendimiento">
            <Input value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} placeholder="unidad, porción…" />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-cocoa">Ingredientes</p>
            <Button variant="ghost" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
          {lines.length === 0 && (
            <p className="rounded-xl bg-peach-light/40 px-3 py-4 text-center text-sm text-cocoa-soft">
              Aún no agregas ingredientes.
            </p>
          )}
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const ing = ingredients.find((i) => i.id === line.ingredient_id);
              const units = ing ? compatibleUnits(ing.unit) : (["unidad"] as MeasureUnit[]);
              return (
                <div key={idx} className="flex items-end gap-2 rounded-xl border border-peach/50 bg-white/60 p-2">
                  <div className="flex-1">
                    <Select
                      value={line.ingredient_id}
                      onChange={(e) => {
                        const newIng = ingredients.find((i) => i.id === e.target.value);
                        setLines((ls) =>
                          ls.map((l, i) =>
                            i === idx
                              ? { ...l, ingredient_id: e.target.value, unit: newIng ? compatibleUnits(newIng.unit)[0] : l.unit }
                              : l
                          )
                        );
                      }}
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-20">
                    <NumberInput
                      value={line.quantity}
                      onChange={(v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))}
                    />
                  </div>
                  <div className="w-20">
                    <Select
                      value={line.unit}
                      onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unit: e.target.value as MeasureUnit } : l)))}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                  </div>
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                    className="mb-2.5 shrink-0 text-danger"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones, tips…" />
        </Field>

        <div className="flex items-center justify-between rounded-2xl border border-gold/30 bg-[#FBF1DA]/50 p-4">
          <div>
            <p className="text-sm text-cocoa-light">Costo total</p>
            <p className="font-display text-xl font-extrabold text-cocoa">{formatMoney(cost.total)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-cocoa-light">Costo por {yieldUnit}</p>
            <p className="font-display text-xl font-extrabold text-gold-dark">{formatMoney(cost.perYield)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
