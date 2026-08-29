"use client";

import { useEffect } from "react";
import { getAdapter, usingSupabase } from "@/lib/data/client";
import { buildSeed } from "@/lib/data/seed";
import { emitChange } from "@/lib/data/bus";

/**
 * En modo local (localStorage) carga los datos de ejemplo la primera vez.
 * En modo Supabase no hace nada (los datos son reales).
 */
export function DataBootstrap() {
  useEffect(() => {
    if (usingSupabase()) return;
    getAdapter()
      .seedIfEmpty(buildSeed())
      .then(() => emitChange())
      .catch(() => {});
  }, []);
  return null;
}
