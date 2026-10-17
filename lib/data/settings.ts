"use client";

import { useTable } from "./hooks";
import { create, update } from "./client";
import { TABLES } from "./types";
import type { BusinessSettings, CategoryRow } from "./types";
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_TARGET_MARGIN,
  BRAND,
} from "@/lib/constants";

export type Settings = {
  id?: string;
  name: string;
  tagline: string;
  currency: string;
  target_margin: number;
  rounding: number;
  product_categories: string[];
  expense_categories: string[];
  /** $ por hora de trabajo (se usa con los minutos de cada receta). */
  labor_rate: number;
  /** Días de anticipación para marcar pedidos como urgentes. */
  alert_days: number;
  /** Abono sugerido para pedidos (fracción). */
  min_deposit_pct: number;
};

export const DEFAULT_SETTINGS: Settings = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  currency: "CLP",
  target_margin: DEFAULT_TARGET_MARGIN,
  rounding: 100,
  product_categories: [...DEFAULT_PRODUCT_CATEGORIES],
  expense_categories: [...DEFAULT_EXPENSE_CATEGORIES],
  labor_rate: 0,
  alert_days: 2,
  min_deposit_pct: 0,
};

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Configuración efectiva (valores por defecto + lo guardado). */
export function useSettings(): { settings: Settings; loading: boolean } {
  const { data, loading } = useTable<BusinessSettings>(TABLES.business_settings);
  // v2: las categorías se administran en la tabla categories (editable desde Sheets).
  const { data: categories } = useTable<CategoryRow>(TABLES.categories);
  const row = data[0];
  const active = categories.filter((c) => c.is_active !== false);
  const catsOf = (kind: CategoryRow["kind"]) =>
    active.filter((c) => c.kind === kind).map((c) => c.name).sort((a, b) => a.localeCompare(b, "es"));
  const params = row?.params ?? {};
  const settings: Settings = row
    ? {
        id: row.id,
        name: row.name ?? DEFAULT_SETTINGS.name,
        tagline: row.tagline ?? DEFAULT_SETTINGS.tagline,
        currency: row.currency ?? DEFAULT_SETTINGS.currency,
        target_margin: row.target_margin ?? DEFAULT_SETTINGS.target_margin,
        rounding: row.rounding ?? DEFAULT_SETTINGS.rounding,
        product_categories: catsOf("producto").length
          ? catsOf("producto")
          : row.product_categories?.length
            ? row.product_categories
            : DEFAULT_SETTINGS.product_categories,
        expense_categories: catsOf("gasto").length
          ? catsOf("gasto")
          : row.expense_categories?.length
            ? row.expense_categories
            : DEFAULT_SETTINGS.expense_categories,
        labor_rate: num(params.costo_mano_obra_hora, 0),
        alert_days: num(params.dias_alerta_pedido, 2),
        min_deposit_pct: num(params.abono_minimo_pct, 0),
      }
    : DEFAULT_SETTINGS;
  return { settings, loading };
}

export async function saveSettings(
  current: Settings,
  patch: Partial<Settings>
): Promise<void> {
  if (current.id) {
    await update(TABLES.business_settings, current.id, patch);
  } else {
    await create(TABLES.business_settings, {
      name: current.name,
      tagline: current.tagline,
      currency: current.currency,
      target_margin: current.target_margin,
      rounding: current.rounding,
      product_categories: current.product_categories,
      expense_categories: current.expense_categories,
      phone: null,
      address: null,
      ...patch,
    });
  }
}
