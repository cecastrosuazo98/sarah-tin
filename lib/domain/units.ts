/**
 * Conversión de unidades para el sistema de costeo.
 * Dimensiones: masa (base g), volumen (base ml), conteo (base unidad).
 */
import type { BaseUnit, MeasureUnit } from "@/lib/data/types";

export type Dimension = "masa" | "volumen" | "conteo";

const UNIT_TO_DIMENSION: Record<MeasureUnit, Dimension> = {
  g: "masa",
  kg: "masa",
  ml: "volumen",
  l: "volumen",
  unidad: "conteo",
};

const FACTOR_TO_BASE: Record<MeasureUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  unidad: 1,
};

const DIMENSION_BASE: Record<Dimension, BaseUnit> = {
  masa: "g",
  volumen: "ml",
  conteo: "unidad",
};

export function dimensionOf(unit: MeasureUnit): Dimension {
  return UNIT_TO_DIMENSION[unit];
}

export function baseUnitOf(unit: MeasureUnit): BaseUnit {
  return DIMENSION_BASE[dimensionOf(unit)];
}

/** Convierte una cantidad a su unidad base (g / ml / unidad). */
export function toBase(quantity: number, unit: MeasureUnit): number {
  return quantity * FACTOR_TO_BASE[unit];
}

/** Unidades de compra/uso compatibles con una unidad base. */
export function compatibleUnits(base: BaseUnit): MeasureUnit[] {
  switch (base) {
    case "g":
      return ["g", "kg"];
    case "ml":
      return ["ml", "l"];
    case "unidad":
      return ["unidad"];
  }
}

/** Opciones de "tipo de ingrediente" que definen la unidad base. */
export const INGREDIENT_TYPES: { label: string; base: BaseUnit; hint: string }[] =
  [
    { label: "Peso (kg / g)", base: "g", hint: "harina, azúcar, mantequilla…" },
    { label: "Volumen (l / ml)", base: "ml", hint: "leche, aceite, esencia…" },
    { label: "Unidades", base: "unidad", hint: "huevos, moldes…" },
  ];

export const UNIT_LABEL: Record<MeasureUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  unidad: "un",
};
