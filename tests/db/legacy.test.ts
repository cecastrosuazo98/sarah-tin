import { it, expect } from "vitest";
import { freshDb, createUser, readSql } from "./harness";

it("migra una base antigua sin created_at en tablas de detalle", async () => {
  const db = await freshDb();
  await createUser(db, "admin@prueba.local");
  for (const t of ["order_items", "sale_items", "payments", "recipe_ingredients"]) {
    await db.exec(`alter table public.${t} drop column if exists created_at`);
  }
  await db.exec(readSql("supabase/migrations/000_respaldo_antes_v2.sql"));
  await db.exec(readSql("supabase/migrations/001_v2_negocio_roles_sync.sql"));
  await db.exec(readSql("supabase/migrations/002_v2_vistas_sync.sql"));
  const r = await db.query<{ n: number }>(`select count(*)::int n from public.sync_order_items`);
  expect(r.rows[0].n).toBe(0);
});
