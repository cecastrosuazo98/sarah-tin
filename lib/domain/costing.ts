/**
 * Motor de costeo de Sarah & Tin.
 * Calcula costo de recetas, costo por unidad, costo de producto, margen y
 * precio sugerido. Todo automático a partir de los ingredientes.
 */
import type {
  Ingredient,
  Product,
  Recipe,
  RecipeIngredient,
} from "@/lib/data/types";
import { toBase } from "./units";

export interface RecipeLineCost {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  missing: boolean; // ingrediente no encontrado
}

export interface RecipeCost {
  lines: RecipeLineCost[];
  total: number;
  perYield: number; // costo por unidad de rendimiento
}

/** Costo total de una receta y por unidad de rendimiento. */
export function computeRecipeCost(
  recipe: Recipe,
  lines: RecipeIngredient[],
  ingredients: Ingredient[]
): RecipeCost {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const detail = lines.map<RecipeLineCost>((line) => {
    const ing = byId.get(line.ingredient_id);
    if (!ing) {
      return {
        ingredientId: line.ingredient_id,
        name: "Ingrediente eliminado",
        quantity: line.quantity,
        unit: line.unit,
        cost: 0,
        missing: true,
      };
    }
    const baseQty = toBase(line.quantity, line.unit);
    const cost = baseQty * ing.cost_per_unit;
    return {
      ingredientId: ing.id,
      name: ing.name,
      quantity: line.quantity,
      unit: line.unit,
      cost,
      missing: false,
    };
  });
  const total = detail.reduce((s, l) => s + l.cost, 0);
  const yieldQty = recipe.yield_qty > 0 ? recipe.yield_qty : 1;
  return { lines: detail, total, perYield: total / yieldQty };
}

export interface ProductEconomics {
  cost: number; // costo de producción por unidad (receta/rendimiento + adicionales)
  recipeCost: number;
  additionalCost: number;
  price: number;
  profit: number;
  margin: number; // fracción (0..1)
  belowTarget: boolean;
  suggestedPrice: number; // según margen objetivo
}

/** Redondea hacia arriba al múltiplo indicado (ej: 100 -> $2.100). */
export function roundUpTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.ceil(value / step) * step;
}

/** Economía completa de un producto: costo, margen y precio sugerido. */
export function computeProductEconomics(
  product: Pick<Product, "sale_price" | "additional_cost">,
  recipeCostPerUnit: number,
  targetMargin: number,
  rounding: number
): ProductEconomics {
  const additionalCost = product.additional_cost ?? 0;
  const cost = recipeCostPerUnit + additionalCost;
  const price = product.sale_price ?? 0;
  const profit = price - cost;
  const margin = price > 0 ? profit / price : 0;

  // Precio para alcanzar el margen objetivo: precio = costo / (1 - margen)
  const target = Math.min(Math.max(targetMargin, 0), 0.95);
  const rawSuggested = target < 1 ? cost / (1 - target) : cost;
  const suggestedPrice = roundUpTo(rawSuggested, rounding);

  return {
    cost,
    recipeCost: recipeCostPerUnit,
    additionalCost,
    price,
    profit,
    margin,
    belowTarget: price > 0 && margin < targetMargin,
    suggestedPrice,
  };
}
