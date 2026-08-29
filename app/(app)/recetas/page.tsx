"use client";

import { useState } from "react";
import { Plus, BookOpen, Pencil, Trash2, ChefHat } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { RecipeForm } from "@/components/features/recipes/RecipeForm";
import { useTable } from "@/lib/data/hooks";
import { remove } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Recipe, RecipeIngredient, Ingredient } from "@/lib/data/types";
import { computeRecipeCost } from "@/lib/domain/costing";
import { formatMoney, formatQuantity } from "@/lib/format";

export default function RecetasPage() {
  const toast = useToast();
  const { data: recipes, loading } = useTable<Recipe>(TABLES.recipes);
  const { data: allLines } = useTable<RecipeIngredient>(TABLES.recipe_ingredients);
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState<Recipe | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recetas"
        subtitle="El costo se calcula solo desde tus ingredientes."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        }
      />

      {!loading && recipes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          emoji="📖"
          title="Todavía no tienes recetas"
          description="Crea una receta y calcularemos automáticamente cuánto te cuesta cada preparación."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Crear receta</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => {
            const lines = allLines.filter((l) => l.recipe_id === r.id);
            const cost = computeRecipeCost(r, lines, ingredients);
            return (
              <div key={r.id} className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sarah-50">
                      <ChefHat className="h-5 w-5 text-sarah-dark" />
                    </span>
                    <div>
                      <p className="font-display font-bold text-cocoa">{r.name}</p>
                      <p className="text-xs text-cocoa-soft">
                        Rinde {formatQuantity(r.yield_qty, r.yield_unit)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {lines.slice(0, 4).map((l) => {
                    const ing = ingredients.find((i) => i.id === l.ingredient_id);
                    return (
                      <p key={l.id} className="flex justify-between text-xs text-cocoa-light">
                        <span>{ing?.name ?? "—"}</span>
                        <span>{formatQuantity(l.quantity, l.unit)}</span>
                      </p>
                    );
                  })}
                  {lines.length > 4 && <p className="text-xs text-cocoa-soft">+{lines.length - 4} más…</p>}
                  {lines.length === 0 && <p className="text-xs text-cocoa-soft">Sin ingredientes.</p>}
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FBF1DA]/50 px-3 py-2">
                  <div>
                    <p className="text-[0.7rem] text-cocoa-light">Costo total</p>
                    <p className="font-bold text-cocoa">{formatMoney(cost.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.7rem] text-cocoa-light">Por {r.yield_unit}</p>
                    <p className="font-bold text-gold-dark">{formatMoney(cost.perYield)}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 border-t border-peach/50 pt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(r); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label="Eliminar">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecipeForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            for (const l of allLines.filter((x) => x.recipe_id === deleting.id)) {
              await remove(TABLES.recipe_ingredients, l.id);
            }
            await remove(TABLES.recipes, deleting.id);
            toast("Receta eliminada");
          } catch (e) {
            toast(e instanceof Error ? e.message : "No se pudo eliminar.", "error");
            throw e;
          }
        }}
        title="Eliminar receta"
        message={`¿Eliminar "${deleting?.name}"? Los productos que la usan quedarán sin receta asociada.`}
      />
    </div>
  );
}
