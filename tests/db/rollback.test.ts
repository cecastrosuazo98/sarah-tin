import { describe, it, expect } from "vitest";
import { freshDb, migrate, createUser, asUser, rpc, readSql } from "./harness";

describe("reversión de la migración", () => {
  it("vuelve a v1 sin perder datos y permite aplicar v2 otra vez", async () => {
    const db = await freshDb();
    const admin = await createUser(db, "admin@prueba.local");
    await asUser(db, admin, () =>
      db.query(`insert into products (owner_id, name, sale_price, stock) values ($1,'Producto prueba',1000,5)`, [admin])
    );
    await migrate(db);

    await asUser(db, admin, () => rpc(db, "rpc_invite_member", "op@prueba.local", "operador", "Op"));
    const op = await createUser(db, "op@prueba.local");
    const prod = (await db.query<{ id: string }>(`select id from products`)).rows[0].id;
    await asUser(db, op, () =>
      rpc(db, "rpc_create_sale", { idempotency_key: "k1", method: "transferencia", items: [{ product_id: prod, quantity: 1, unit_price: 1000 }] })
    );

    await db.exec(readSql("supabase/migrations/001_v2_down.sql"));

    // La dueña ve todo, incluida la venta que hizo la operadora.
    const n = await asUser(db, admin, () => db.query<{ n: number }>(`select count(*)::int n from sales`));
    expect(n.rows[0].n).toBe(1);
    // La app v1 inserta con owner_id explícito.
    await asUser(db, admin, () =>
      db.query(`insert into sales (owner_id, total, subtotal, paid_amount, method, status) values ($1,500,500,500,'efectivo','pagado')`, [admin])
    );
    const t = await db.query<{ t: string }>(`select data_type t from information_schema.columns where table_name='sales' and column_name='method'`);
    expect(t.rows[0].t).toBe("USER-DEFINED");

    // Reaplicar v2 funciona y conserva todo.
    await migrate(db);
    const n2 = await asUser(db, op, () => db.query<{ n: number }>(`select count(*)::int n from sales`));
    expect(n2.rows[0].n).toBe(2);
  });
});
