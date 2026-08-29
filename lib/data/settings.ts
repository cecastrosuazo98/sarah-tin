"use client";

import { useTable } from "./hooks";
import { create, update } from "./client";
import { TABLES } from "./types";
import type { BusinessSettings } from "./types";
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
};

export const DEFAULT_SETTINGS: Settings = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  currency: "CLP",
  target_margin: DEFAULT_TARGET_MARGIN,
  rounding: 100,
  product_categories: [...DEFAULT_PRODUCT_CATEGORIES],
  expense_categories: [...DEFAULT_EXPENSE_CATEGORIES],
};

/** Configuración efectiva (valores por defecto + lo guardado). */
export function useSettings(): { settings: Settings; loading: boolean } {
  const { data, loading } = useTable<BusinessSettings>(TABLES.business_settings);
  const row = data[0];
  const settings: Settings = row
    ? {
        id: row.id,
        name: row.name ?? DEFAULT_SETTINGS.name,
        tagline: row.tagline ?? DEFAULT_SETTINGS.tagline,
        currency: row.currency ?? DEFAULT_SETTINGS.currency,
        target_margin: row.target_margin ?? DEFAULT_SETTINGS.target_margin,
        rounding: row.rounding ?? DEFAULT_SETTINGS.rounding,
        product_categories: row.product_categories?.length
          ? row.product_categories
          : DEFAULT_SETTINGS.product_categories,
        expense_categories: row.expense_categories?.length
          ? row.expense_categories
          : DEFAULT_SETTINGS.expense_categories,
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
