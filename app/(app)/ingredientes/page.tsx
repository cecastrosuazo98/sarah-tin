"use client";

import { useState } from "react";
import { Plus, Egg, ShoppingBag, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { IngredientForm } from "@/components/features/ingredients/IngredientForm";
import { PurchaseForm } from "@/components/features/ingredients/PurchaseForm";
import { useTable } from "@/lib/data/hooks";
import { remove } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Ingredient, RecipeIngredient } from "@/lib/data/types";
import { formatMoney, formatQuantity } from "@/lib/format";
import { UNIT_LABEL } from "@/lib/domain/units";

export default function IngredientesPage() {
  const toast = useToast();
  const { data: ingredients, loading } = useTable<Ingredient>(TABLES.ingredients);
  const { data: recipeLines } = useTable<RecipeIngredient>(TABLES.recipe_ingredients);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [buying, setBuying] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);
  const [query, setQuery] = useState("");

  const sorted = [...ingredients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((i) => matchesSearch(query, i.name, i.category));
  const lowCount = ingredients.filter((i) => i.stock <= i.min_stock).length;

  const friendlyCost = (i: Ingredient) => {
    const factor = i.unit === "unidad" ? 1 : 1000;
    const label = i.unit === "g" ? "kg" : i.unit === "ml" ? "l" : "un";
    return `${formatMoney(i.cost_per_unit * factor)}/${label}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredientes"
        subtitle="Inventario con stock y costo por unidad."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {lowCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-[#FBF1DA]/60 px-4 py-3 text-sm text-cocoa">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {lowCount === 1 ? "1 ingrediente está" : `${lowCount} ingredientes están`} en stock bajo.
        </div>
      )}

      {!loading && ingredients.length === 0 ? (
        <EmptyState
          icon={Egg}
          emoji="🥚"
          title="Todavía no tienes ingredientes"
          description="Agrega tus insumos para calcular el costo de tus recetas y productos."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar ingrediente</Button>}
        />
      ) : (
        <>
          {ingredients.length > 0 && (
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar ingrediente…" />
          )}
          {sorted.length === 0 ? (
            <EmptyState emoji="🔍" title="Sin resultados" description={`No hay ingredientes que coincidan con "${query}".`} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((i) => {
            const low = i.stock <= i.min_stock;
            return (
              <div key={i.id} className="rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-cocoa">{i.name}</p>
                    {i.category && <p className="text-xs text-cocoa-soft">{i.category}</p>}
                  </div>
                  {low ? <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> Stock bajo</Badge> : <Badge tone="success">OK</Badge>}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-cocoa-light">Stock</p>
                    <p className="font-display text-lg font-extrabold text-cocoa">
                      {formatQuantity(i.stock, UNIT_LABEL[i.unit])}
                    </p>
                    <p className="text-xs text-cocoa-soft">Mín: {formatQuantity(i.min_stock, UNIT_LABEL[i.unit])}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cocoa-light">Costo</p>
                    <p className="font-semibold text-cocoa">{friendlyCost(i)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 border-t border-peach/50 pt-3">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setBuying(i)}>
                    <ShoppingBag className="h-4 w-4" /> Comprar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(i); setFormOpen(true); }} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(i)} aria-label="Eliminar">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <IngredientForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <PurchaseForm open={!!buying} onClose={() => setBuying(null)} ingredient={buying} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            // Quita el ingrediente de las recetas que lo usan (evita el error de
            // llave foránea en Supabase) antes de eliminarlo.
            const lines = recipeLines.filter((l) => l.ingredient_id === deleting.id);
            for (const l of lines) {
              await remove(TABLES.recipe_ingredients, l.id);
            }
            await remove(TABLES.ingredients, deleting.id);
            toast(
              lines.length > 0
                ? `Ingrediente eliminado (quitado de ${lines.length} receta${lines.length > 1 ? "s" : ""})`
                : "Ingrediente eliminado"
            );
          } catch (e) {
            toast(e instanceof Error ? e.message : "No se pudo eliminar el ingrediente.", "error");
            throw e;
          }
        }}
        title="Eliminar ingrediente"
        message={
          (() => {
            const uses = deleting ? recipeLines.filter((l) => l.ingredient_id === deleting.id).length : 0;
            return uses > 0
              ? `"${deleting?.name}" se usa en ${uses} receta${uses > 1 ? "s" : ""}. Si lo eliminas, se quitará de ellas y sus costos cambiarán. ¿Continuar?`
              : `¿Seguro que quieres eliminar "${deleting?.name}"? Esta acción no se puede deshacer.`;
          })()
        }
      />
    </div>
  );
}
