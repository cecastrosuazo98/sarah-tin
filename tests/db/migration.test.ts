import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, migrate, createUser, asUser, rpc } from "./harness";

// Datos ficticios de prueba (no son datos reales del negocio).
let db: PGlite;
let admin: string;
let operadora: string;
let otro: string;
let ing: string;
let recipe: string;
let product: string;
let customer: string;
let oldSale: string;

async function one<T = any>(sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

beforeAll(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@prueba.local", "Admin Prueba");

  // Datos "antiguos" creados con el esquema v1 (owner_id).
  await asUser(db, admin, async () => {
    await db.query(`update business_settings set product_categories = '{Tortas,Galletas}', expense_categories = '{Luz}'`);
    ing = (await one<{ id: string }>(
      `insert into ingredients (owner_id, name, unit, stock, cost_per_unit) values ($1,'Harina prueba','g',10000,2) returning id`, [admin])).id;
    recipe = (await one<{ id: string }>(
      `insert into recipes (owner_id, name, yield_qty) values ($1,'Receta prueba',10) returning id`, [admin])).id;
    await db.query(`insert into recipe_ingredients (owner_id, recipe_id, ingredient_id, quantity, unit) values ($1,$2,$3,1,'kg')`, [admin, recipe, ing]);
    product = (await one<{ id: string }>(
      `insert into products (owner_id, name, sale_price, recipe_id, additional_cost, stock) values ($1,'Producto prueba',1000,$2,50,20) returning id`,
      [admin, recipe])).id;
    customer = (await one<{ id: string }>(
      `insert into customers (owner_id, name) values ($1,'Cliente prueba') returning id`, [admin])).id;
    oldSale = (await one<{ id: string }>(
      `insert into sales (owner_id, customer_id, total, subtotal, paid_amount, method, status) values ($1,$2,3000,3000,3000,'efectivo','pagado') returning id`,
      [admin, customer])).id;
    await db.query(`insert into sales (owner_id, customer_id, total, subtotal, paid_amount, method, status) values ($1,$2,2000,2000,0,'fiado','pendiente')`, [admin, customer]);
  });

  await migrate(db);
  otro = await createUser(db, "otro@prueba.local");
});

describe("migración de datos existentes", () => {
  it("crea el negocio con el mismo id y deja a la dueña como admin", async () => {
    const m = await one<{ business_id: string; role: string }>(`select business_id, role from business_members where user_id = $1`, [admin]);
    expect(m.business_id).toBe(admin);
    expect(m.role).toBe("admin");
    const n = await one<{ n: number }>(`select count(*)::int n from sales where business_id = $1`, [admin]);
    expect(n.n).toBe(2);
  });

  it("crea el cobro faltante de las ventas al contado, una sola vez", async () => {
    const p = await one<{ n: number; s: string }>(`select count(*)::int n, sum(amount)::text s from payments where sale_id = $1`, [oldSale]);
    expect(p.n).toBe(1);
    expect(Number(p.s)).toBe(3000);
    const fiado = await one<{ n: number }>(`select count(*)::int n from payments p join sales s on s.id = p.sale_id where s.method = 'fiado'`);
    expect(fiado.n).toBe(0);
  });

  it("copia categorías y crea configuración por defecto", async () => {
    const c = await one<{ n: number }>(`select count(*)::int n from categories where business_id = $1`, [admin]);
    expect(c.n).toBe(3);
    const pm = await one<{ n: number }>(`select count(*)::int n from payment_methods where business_id = $1 and is_active`, [admin]);
    expect(pm.n).toBe(5);
    const st = await one<{ n: number }>(`select count(*)::int n from order_statuses where business_id = $1`, [admin]);
    expect(st.n).toBe(6);
  });

  it("un usuario nuevo sin invitación crea su propio negocio y no ve el de Sarah & Tin", async () => {
    const m = await one<{ business_id: string }>(`select business_id from business_members where user_id = $1`, [otro]);
    expect(m.business_id).toBe(otro);
    const n = await asUser(db, otro, () => one<{ n: number }>(`select count(*)::int n from sales`));
    expect(n.n).toBe(0);
  });
});

describe("roles", () => {
  it("la admin invita a la operadora y al crearse el usuario entra al mismo negocio", async () => {
    const r = await asUser(db, admin, () => rpc(db, "rpc_invite_member", "operadora@prueba.local", "operador", "Operadora"));
    expect(r.existing_user).toBe(false);
    operadora = await createUser(db, "operadora@prueba.local");
    const m = await one<{ business_id: string; role: string }>(`select business_id, role from business_members where user_id = $1`, [operadora]);
    expect(m).toEqual({ business_id: admin, role: "operador" });
    const n = await asUser(db, operadora, () => one<{ n: number }>(`select count(*)::int n from products`));
    expect(n.n).toBe(1);
  });

  it("la operadora no puede cambiar precios ni configuración", async () => {
    const r = await asUser(db, operadora, () => db.query(`update products set sale_price = 1 where id = $1`, [product]));
    expect(r.affectedRows).toBe(0);
    await expect(
      asUser(db, operadora, () => db.query(`insert into payment_methods (code, label) values ('x','X')`))
    ).rejects.toThrow();
    const p = await one<{ sale_price: string }>(`select sale_price::text from products where id = $1`, [product]);
    expect(Number(p.sale_price)).toBe(1000);
  });

  it("la operadora no puede registrar aportes/retiros ni ver la bitácora", async () => {
    await expect(
      asUser(db, operadora, () => rpc(db, "rpc_owner_movement", { kind: "retiro", amount: 100 }))
    ).rejects.toThrow(/administración/);
    const n = await asUser(db, operadora, () => one<{ n: number }>(`select count(*)::int n from audit_log`));
    expect(n.n).toBe(0);
  });

  it("la operadora no puede borrar ventas", async () => {
    const r = await asUser(db, operadora, () => db.query(`delete from sales where id = $1`, [oldSale]));
    expect(r.affectedRows).toBe(0);
  });

  it("un usuario de otro negocio no puede operar sobre productos ajenos", async () => {
    await expect(
      asUser(db, otro, () => rpc(db, "rpc_create_order", { order_date: "2026-10-20", items: [{ product_id: product, quantity: 1 }] }))
    ).rejects.toThrow(/no existe/);
  });
});

describe("operaciones atómicas", () => {
  it("venta descuenta stock de producto e ingredientes y guarda el costo histórico", async () => {
    const r = await asUser(db, operadora, () =>
      rpc(db, "rpc_create_sale", { idempotency_key: "venta-1", method: "efectivo", items: [{ product_id: product, quantity: 2, unit_price: 1000 }] })
    );
    expect(Number(r.total)).toBe(2000);
    const p = await one<{ stock: string }>(`select stock::text from products where id = $1`, [product]);
    expect(Number(p.stock)).toBe(18);
    const i = await one<{ stock: string }>(`select stock::text from ingredients where id = $1`, [ing]);
    // receta: 1 kg para 10 unidades → 2 unidades = 200 g
    expect(Number(i.stock)).toBe(9800);
    const si = await one<{ unit_cost: string }>(`select unit_cost::text from sale_items where sale_id = $1`, [r.id]);
    // (1000 g × $2) / 10 + $50 adicional = $250
    expect(Number(si.unit_cost)).toBe(250);
    const pay = await one<{ n: number; kind: string }>(`select count(*)::int n, max(kind) kind from payments where sale_id = $1`, [r.id]);
    expect(pay).toEqual({ n: 1, kind: "cobro" });
  });

  it("doble toque: la misma clave no duplica la venta", async () => {
    const before = await one<{ n: number }>(`select count(*)::int n from sales`);
    const r = await asUser(db, operadora, () =>
      rpc(db, "rpc_create_sale", { idempotency_key: "venta-1", method: "efectivo", items: [{ product_id: product, quantity: 2, unit_price: 1000 }] })
    );
    expect(r.duplicate).toBe(true);
    const after = await one<{ n: number }>(`select count(*)::int n from sales`);
    expect(after.n).toBe(before.n);
  });

  it("si falla una línea no queda nada a medias", async () => {
    const before = await one<{ n: number }>(`select count(*)::int n from sales`);
    await expect(
      asUser(db, operadora, () =>
        rpc(db, "rpc_create_sale", { idempotency_key: "venta-mala", items: [{ product_id: product, quantity: 1, unit_price: 1000 }, { product_id: product, quantity: 0, unit_price: 1 }] })
      )
    ).rejects.toThrow(/cantidad/);
    const after = await one<{ n: number }>(`select count(*)::int n from sales`);
    expect(after.n).toBe(before.n);
    const k = await one<{ n: number }>(`select count(*)::int n from idempotency_keys where key = 'venta-mala'`);
    expect(k.n).toBe(0);
  });

  it("subir el costo de un ingrediente no cambia el costo de ventas pasadas", async () => {
    await asUser(db, admin, () => db.query(`update ingredients set cost_per_unit = 5 where id = $1`, [ing]));
    const si = await one<{ unit_cost: string }>(
      `select si.unit_cost::text from sale_items si join idempotency_keys k on (k.result->>'id')::uuid = si.sale_id where k.key = 'venta-1'`);
    expect(Number(si.unit_cost)).toBe(250);
    const h = await one<{ n: number }>(`select count(*)::int n from ingredient_cost_history where ingredient_id = $1`, [ing]);
    expect(h.n).toBeGreaterThanOrEqual(1);
    await asUser(db, admin, () => db.query(`update ingredients set cost_per_unit = 2 where id = $1`, [ing]));
  });

  it("pedido con abono → entregado genera una venta con el abono como cobro", async () => {
    const o = await asUser(db, operadora, () =>
      rpc(db, "rpc_create_order", {
        idempotency_key: "pedido-1", new_customer: { name: "Cliente nuevo prueba", phone: "+56900000000" },
        order_date: "2026-10-20", deposit: 1000, method: "transferencia",
        items: [{ product_id: product, quantity: 3 }],
      })
    );
    expect(Number(o.total)).toBe(3000);
    expect(o.code).toBe("#1001");
    const dup = await asUser(db, operadora, () => rpc(db, "rpc_create_order", { idempotency_key: "pedido-1", order_date: "2026-10-20", items: [{ product_id: product, quantity: 3 }] }));
    expect(dup.duplicate).toBe(true);

    const d = await asUser(db, operadora, () => rpc(db, "rpc_set_order_status", o.id, "entregado"));
    expect(d.sale_id).toBeTruthy();
    const s = await one<{ total: string; paid_amount: string; status: string }>(`select total::text, paid_amount::text, status::text from sales where id = $1`, [d.sale_id]);
    expect(Number(s.total)).toBe(3000);
    expect(Number(s.paid_amount)).toBe(1000);
    expect(s.status).toBe("abono");
    const again = await asUser(db, operadora, () => rpc(db, "rpc_set_order_status", o.id, "entregado"));
    expect(again.unchanged).toBe(true);
    const n = await one<{ n: number }>(`select count(*)::int n from sales where order_id = $1`, [o.id]);
    expect(n.n).toBe(1);

    // Saldo pagado después: abono al pedido va a su venta.
    const pay = await asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "pago-1", order_id: o.id, amount: 2000, method: "efectivo" }));
    expect(Number(pay.applied)).toBe(2000);
    const s2 = await one<{ status: string }>(`select status::text from sales where id = $1`, [d.sale_id]);
    expect(s2.status).toBe("pagado");
    await expect(
      asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "pago-2", sale_id: d.sale_id, amount: 1 }))
    ).rejects.toThrow(/saldo/);
  });

  it("cobro de deuda antigua y reembolso con validaciones", async () => {
    await expect(
      asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "c-1", customer_id: customer, amount: 999999 }))
    ).rejects.toThrow(/supera/);
    const r = await asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "c-2", customer_id: customer, amount: 2000, kind: "cobro" }));
    expect(Number(r.applied)).toBe(2000);
    const rb = await asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "r-1", kind: "reembolso", sale_id: oldSale, amount: 500 }));
    expect(rb.kind).toBe("reembolso");
    const s = await one<{ paid_amount: string; status: string }>(`select paid_amount::text, status::text from sales where id = $1`, [oldSale]);
    expect(Number(s.paid_amount)).toBe(2500);
    expect(s.status).toBe("abono");
  });

  it("anular venta repone stock y deja auditoría", async () => {
    const v = await asUser(db, operadora, () =>
      rpc(db, "rpc_create_sale", { idempotency_key: "venta-anular", items: [{ product_id: product, quantity: 1, unit_price: 1000 }] }));
    const before = await one<{ stock: string }>(`select stock::text from products where id = $1`, [product]);
    await expect(asUser(db, operadora, () => rpc(db, "rpc_void_sale", v.id, ""))).rejects.toThrow(/motivo/);
    await asUser(db, operadora, () => rpc(db, "rpc_void_sale", v.id, "Error de digitación"));
    const after = await one<{ stock: string }>(`select stock::text from products where id = $1`, [product]);
    expect(Number(after.stock)).toBe(Number(before.stock) + 1);
    const a = await one<{ n: number }>(`select count(*)::int n from audit_log where record_id = $1`, [v.id]);
    expect(a.n).toBe(1);
    const pay = await one<{ voided: boolean }>(`select bool_and(voided_at is not null) voided from payments where sale_id = $1`, [v.id]);
    expect(pay.voided).toBe(true);
  });

  it("compra de insumos suma inventario, actualiza costo y no se registra como gasto", async () => {
    const gastosAntes = await one<{ n: number }>(`select count(*)::int n from expenses`);
    const r = await asUser(db, operadora, () =>
      rpc(db, "rpc_register_purchase", { idempotency_key: "compra-1", paid_amount: 0, items: [{ ingredient_id: ing, quantity: 2, unit: "kg", line_total: 6000 }] }));
    expect(Number(r.total)).toBe(6000);
    const i = await one<{ stock: string; cost_per_unit: string }>(`select stock::text, cost_per_unit::text from ingredients where id = $1`, [ing]);
    expect(Number(i.cost_per_unit)).toBe(3);
    const gastos = await one<{ n: number }>(`select count(*)::int n from expenses`);
    expect(gastos.n).toBe(gastosAntes.n);
    const pend = await one<{ balance: string }>(`select balance::text from v_payables`);
    expect(Number(pend.balance)).toBe(6000);
  });

  it("pedido cancelado: el abono se devuelve como reembolso del pedido", async () => {
    const o = await asUser(db, operadora, () =>
      rpc(db, "rpc_create_order", { idempotency_key: "pedido-cancel", customer_id: customer, order_date: "2026-10-25", deposit: 500, items: [{ product_id: product, quantity: 1 }] }));
    const st = await asUser(db, operadora, () => rpc(db, "rpc_set_order_status", o.id, "cancelado"));
    expect(st.warning).toMatch(/reembolso/);
    await expect(
      asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "rb-o-1", kind: "reembolso", order_id: o.id, amount: 600 }))
    ).rejects.toThrow(/supera/);
    await asUser(db, operadora, () => rpc(db, "rpc_register_payment", { idempotency_key: "rb-o-2", kind: "reembolso", order_id: o.id, amount: 500 }));
    const p = await one<{ s: string }>(`select sum(amount)::text s from payments where order_id = $1`, [o.id]);
    expect(Number(p.s)).toBe(0);
    const ord = await one<{ deposit: string }>(`select deposit::text from orders where id = $1`, [o.id]);
    expect(Number(ord.deposit)).toBe(0);
  });

  it("compra con proveedor escrito como texto: se crea una sola vez", async () => {
    for (const k of ["compra-p1", "compra-p2"]) {
      await asUser(db, operadora, () =>
        rpc(db, "rpc_register_purchase", { idempotency_key: k, supplier_name: "Proveedor Prueba", items: [{ ingredient_id: ing, quantity: 1, unit: "kg", line_total: 3000 }] }));
    }
    const n = await one<{ n: number }>(`select count(*)::int n from suppliers where name = 'Proveedor Prueba'`);
    expect(n.n).toBe(1);
  });

  it("cada cambio sube la versión de la fila", async () => {
    const v1 = await one<{ version: number }>(`select version from customers where id = $1`, [customer]);
    await asUser(db, operadora, () => db.query(`update customers set phone = '+56911111111' where id = $1`, [customer]));
    const v2 = await one<{ version: number; updated_by: string }>(`select version, updated_by from customers where id = $1`, [customer]);
    expect(v2.version).toBe(v1.version + 1);
    expect(v2.updated_by).toBe(operadora);
    await asUser(db, operadora, () => db.query(`update customers set phone = '+56911111111' where id = $1`, [customer]));
    const v3 = await one<{ version: number }>(`select version from customers where id = $1`, [customer]);
    expect(v3.version).toBe(v2.version);
  });
});
