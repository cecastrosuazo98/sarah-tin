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
  ingredientsCost: number; // ingredientes del lote
  laborCost: number; // minutos de trabajo × costo por hora
  otherCost: number; // otros costos directos del lote
  total: number; // costo total del lote
  perYield: number; // costo por unidad de rendimiento
  /** Motivos por los que el costo no es confiable ("pendiente de costeo"). */
  pending: string[];
}

/** Costo total de una receta y por unidad de rendimiento. */
export function computeRecipeCost(
  recipe: Recipe,
  lines: RecipeIngredient[],
  ingredients: Ingredient[],
  laborRatePerHour = 0
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
  const ingredientsCost = detail.reduce((s, l) => s + l.cost, 0);
  const laborCost = ((recipe.labor_minutes ?? 0) / 60) * laborRatePerHour;
  const otherCost = recipe.other_cost ?? 0;
  const total = ingredientsCost + laborCost + otherCost;
  const pending: string[] = [];
  if (!(recipe.yield_qty > 0)) pending.push("rendimiento en cero");
  if (detail.length === 0) pending.push("sin ingredientes");
  if (detail.some((l) => l.missing)) pending.push("ingrediente eliminado");
  const noCost = lines
    .map((l) => byId.get(l.ingredient_id))
    .filter((i): i is Ingredient => !!i && !(i.cost_per_unit > 0))
    .map((i) => i.name);
  if (noCost.length) pending.push(`sin costo: ${noCost.join(", ")}`);
  // Igual que la base: rendimiento 0 deja el costo unitario en 0 y marcado pendiente.
  const perYield = recipe.yield_qty > 0 ? total / recipe.yield_qty : 0;
  return { lines: detail, ingredientsCost, laborCost, otherCost, total, perYield, pending };
}

export interface ProductEconomics {
  cost: number; // costo por unidad (receta/rendimiento + adicional + empaque)
  recipeCost: number;
  additionalCost: number;
  packagingCost: number;
  price: number;
  profit: number;
  margin: number; // ganancia / precio (fracción)
  markup: number | null; // ganancia / costo (fracción); null si el costo es 0
  pendingCosting: boolean; // el costo no es confiable todavía
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
  product: Pick<Product, "sale_price" | "additional_cost" | "packaging_cost" | "recipe_id">,
  recipeCostPerUnit: number,
  targetMargin: number,
  rounding: number,
  recipePending: string[] = []
): ProductEconomics {
  const additionalCost = product.additional_cost ?? 0;
  const packagingCost = product.packaging_cost ?? 0;
  const cost = recipeCostPerUnit + additionalCost + packagingCost;
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
    packagingCost,
    price,
    profit,
    margin,
    markup: cost > 0 ? profit / cost : null,
    pendingCosting: product.recipe_id ? recipePending.length > 0 : cost <= 0,
    belowTarget: price > 0 && margin < targetMargin,
    suggestedPrice,
  };
}
