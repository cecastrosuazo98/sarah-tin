import { it, expect } from "vitest";
import { freshDb, createUser, asUser, readSql, migrate } from "./harness";

it("el respaldo interno copia todas las tablas antes de migrar", async () => {
  const db = await freshDb();
  const u = await createUser(db, "admin@prueba.local");
  await asUser(db, u, () => db.query(`insert into customers (owner_id, name) values ($1,'Cliente prueba')`, [u]));
  const r = await db.exec(readSql("supabase/migrations/000_respaldo_antes_v2.sql"));
  const counts = r[r.length - 1].rows as { table_name: string; filas: number }[];
  expect(counts.find((c) => c.table_name === "customers")?.filas).toBe(1);
  await migrate(db);
  const n = await db.query<{ n: number }>(`select count(*)::int n from respaldo_v1.customers`);
  expect(n.rows[0].n).toBe(1);
});
