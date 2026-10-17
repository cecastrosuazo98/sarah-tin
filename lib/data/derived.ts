"use client";

import { useMemo } from "react";
import { useTable } from "./hooks";
import { useSettings } from "./settings";
import { TABLES } from "./types";
import type {
  Product,
  Recipe,
  RecipeIngredient,
  Ingredient,
} from "./types";
import {
  computeRecipeCost,
  computeProductEconomics,
  type ProductEconomics,
  type RecipeCost,
} from "@/lib/domain/costing";

export type ProductWithEconomics = Product & { econ: ProductEconomics };

/** Productos anotados con costo, margen y precio sugerido (recalculado). */
export function useProductsEconomics(): {
  products: ProductWithEconomics[];
  loading: boolean;
} {
  const { data: products, loading: lp } = useTable<Product>(TABLES.products);
  const { data: recipes } = useTable<Recipe>(TABLES.recipes);
  const { data: recipeIngredients } = useTable<RecipeIngredient>(
    TABLES.recipe_ingredients
  );
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);
  const { settings } = useSettings();

  const result = useMemo(() => {
    return products.map((p) => {
      let recipeCostPerUnit = 0;
      let pending: string[] = [];
      if (p.recipe_id) {
        const recipe = recipes.find((r) => r.id === p.recipe_id);
        if (recipe) {
          const lines = recipeIngredients.filter(
            (ri) => ri.recipe_id === recipe.id
          );
          const rc = computeRecipeCost(recipe, lines, ingredients, settings.labor_rate);
          recipeCostPerUnit = rc.perYield;
          pending = rc.pending;
        } else {
          pending = ["receta no encontrada"];
        }
      }
      const econ = computeProductEconomics(
        p,
        recipeCostPerUnit,
        settings.target_margin,
        settings.rounding,
        pending
      );
      return { ...p, econ };
    });
  }, [products, recipes, recipeIngredients, ingredients, settings]);

  return { products: result, loading: lp };
}

/** Costo detallado de una receta. */
export function useRecipeCost(recipeId: string | null): {
  recipe: Recipe | null;
  cost: RecipeCost | null;
} {
  const { data: recipes } = useTable<Recipe>(TABLES.recipes);
  const { data: recipeIngredients } = useTable<RecipeIngredient>(
    TABLES.recipe_ingredients
  );
  const { data: ingredients } = useTable<Ingredient>(TABLES.ingredients);
  const { settings } = useSettings();

  return useMemo(() => {
    const recipe = recipes.find((r) => r.id === recipeId) ?? null;
    if (!recipe) return { recipe: null, cost: null };
    const lines = recipeIngredients.filter((ri) => ri.recipe_id === recipe.id);
    return { recipe, cost: computeRecipeCost(recipe, lines, ingredients, settings.labor_rate) };
  }, [recipeId, recipes, recipeIngredients, ingredients, settings.labor_rate]);
}
