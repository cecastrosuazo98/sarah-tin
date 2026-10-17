/**
 * Sincronización de punta a punta: Postgres embebido con las migraciones reales
 * + Google Sheets simulado en memoria. Datos ficticios.
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, migrate, createUser, asUser, rpc, pgliteSql } from "../db/harness";
import { FakeSheets } from "./fake-sheets";
import { SyncDb } from "@/lib/sync/db";
import { runSync, resolveConflict } from "@/lib/sync/run";
import { getTab, headersOf } from "@/lib/sync/schema";

let db: PGlite;
let admin: string;
let op: string;
let sheets: FakeSheets;
let sync: SyncDb;
let product: string;

async function one<T = any>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows[0];
}

beforeAll(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@prueba.local");
  await migrate(db);
  await asUser(db, admin, () => rpc(db, "rpc_invite_member", "op@prueba.local", "operador", "Op"));
  op = await createUser(db, "op@prueba.local");
  await asUser(db, admin, async () => {
    const ing = (await one<{ id: string }>(`insert into ingredients (name, unit, cost_per_unit, stock) values ('Ingrediente A','g',2,5000) returning id`)).id;
    const rec = (await one<{ id: string }>(`insert into recipes (name, yield_qty) values ('Receta A', 10) returning id`)).id;
    await db.query(`insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values ($1,$2,500,'g')`, [rec, ing]);
    product = (await one<{ id: string }>(`insert into products (name, sale_price, recipe_id, stock) values ('Producto A', 1000, $1, 10) returning id`, [rec])).id;
    await db.query(`insert into products (name, sale_price) values ('Producto sin costo', 500)`);
  });
  sheets = new FakeSheets();
  // Igual que la plantilla .xlsx: Parametros trae claves y textos, sin valores.
  const tab = getTab("Parametros");
  sheets.tabs.set("Parametros", [headersOf(tab), ...tab.params!.map((p) => [p.key, p.label, "", p.help ?? ""])]);
  sync = new SyncDb(pgliteSql(db), admin);
});

describe("sincronización app ↔ Sheets", () => {
  it("primera sincronización llena todas las hojas con encabezados, IDs y columnas calculadas", async () => {
    const r = await runSync(sheets, sync, "prueba");
    expect(r.status).toBe("ok");
    const row = sheets.findRow("Productos", "ID", product);
    expect(row).toBeGreaterThan(0);
    expect(sheets.get("Productos", row, "Costo unitario")).toBe(100); // 500 g × $2 / 10
    expect(sheets.get("Productos", row, "Margen")).toBe(0.9);
    expect(sheets.get("Productos", row, "_estado_sync")).toBe("OK");
    const sinCosto = sheets.findRow("Productos", "Producto", "Producto sin costo");
    expect(sheets.get("Productos", sinCosto, "Estado costeo")).toBe("PENDIENTE DE COSTEO");
    expect(sheets.findRow("Metodos_Pago", "Código", "transferencia")).toBeGreaterThan(0);
    const tm = sheets.findRow("Parametros", "Clave", "target_margin");
    expect(sheets.get("Parametros", tm, "Valor")).toBe(0.6); // la plantilla vacía no borró la configuración
    const s = await one<{ name: string }>(`select name from business_settings where business_id = $1`, [admin]);
    expect(s.name).toBe("Sarah & Tin");
  });

  it("una segunda sincronización sin cambios no escribe nada (sin bucles)", async () => {
    const before = sheets.calls.cellsWritten;
    sheets.lastWrites = [];
    const r = await runSync(sheets, sync, "prueba");
    expect(sheets.lastWrites).toEqual([]);
    expect(r.status).toBe("ok");
    expect(sheets.calls.cellsWritten).toBe(before);
    const calls = { ...sheets.calls };
    const again = await runSync(sheets, sync, "prueba");
    expect(again.tabs.every((t) => t.pulled === 0 && t.pushed === 0)).toBe(true);
    // Cuota de Google: una corrida sin cambios = 2 lecturas en lote (hojas + bitácora), 0 escrituras.
    expect(sheets.calls.read - calls.read).toBe(2);
    expect(sheets.calls.write - calls.write).toBe(0);
  });

  it("César cambia un precio en Sheets → la app lo recibe con origen 'sheets'", async () => {
    const row = sheets.findRow("Productos", "ID", product);
    sheets.set("Productos", row, "Precio venta", "1.500");
    const r = await runSync(sheets, sync, "prueba");
    expect(r.tabs.find((t) => t.tab === "Productos")!.pulled).toBe(1);
    const p = await one<{ sale_price: string; updated_source: string; version: number }>(`select sale_price::text, updated_source, version from products where id = $1`, [product]);
    expect(Number(p.sale_price)).toBe(1500);
    expect(p.updated_source).toBe("sheets");
    expect(sheets.get("Productos", row, "_versión")).toBe(p.version);
    expect(sheets.get("Productos", row, "Precio venta")).toBe(1500);
    // Y no rebota: la siguiente corrida no cambia nada.
    const r2 = await runSync(sheets, sync, "prueba");
    expect(r2.tabs.find((t) => t.tab === "Productos")!.pulled).toBe(0);
  });

  it("Camila registra una venta en la app → aparece en Sheets y baja el stock", async () => {
    await asUser(db, op, () => rpc(db, "rpc_create_sale", { idempotency_key: "s-1", items: [{ product_id: product, quantity: 2, unit_price: 1500 }] }));
    await runSync(sheets, sync, "prueba");
    const g = sheets.grid("Ventas");
    expect(g.length).toBe(2);
    expect(sheets.get("Ventas", 1, "Total venta")).toBe(3000);
    expect(sheets.get("Ventas", 1, "Costo de lo vendido")).toBe(200);
    expect(sheets.get("Productos", sheets.findRow("Productos", "ID", product), "Stock")).toBe(8);
    expect(sheets.findRow("Cobros", "Monto", 3000)).toBeGreaterThan(0);
  });

  it("valor inválido en Sheets: se marca ERROR y no se aplica", async () => {
    const row = sheets.findRow("Productos", "ID", product);
    sheets.set("Productos", row, "Precio venta", "mil");
    await runSync(sheets, sync, "prueba");
    expect(String(sheets.get("Productos", row, "_estado_sync"))).toMatch(/^ERROR: "Precio venta" debe ser un número/);
    const p = await one<{ sale_price: string }>(`select sale_price::text from products where id = $1`, [product]);
    expect(Number(p.sale_price)).toBe(1500);
    sheets.set("Productos", row, "Precio venta", 1500);
    await runSync(sheets, sync, "prueba");
    expect(sheets.get("Productos", row, "_estado_sync")).toBe("OK");
  });

  it("editar una columna calculada en Sheets no cambia la app: se restaura", async () => {
    const row = sheets.findRow("Productos", "ID", product);
    sheets.set("Productos", row, "Stock", 999);
    await runSync(sheets, sync, "prueba");
    expect(sheets.get("Productos", row, "Stock")).toBe(8);
  });

  it("cambio en ambos lados → conflicto; ninguno se sobrescribe; César decide", async () => {
    const row = sheets.findRow("Productos", "ID", product);
    sheets.set("Productos", row, "Precio venta", 1800);
    await asUser(db, admin, () => db.query(`update products set sale_price = 1700 where id = $1`, [product]));
    const r = await runSync(sheets, sync, "prueba");
    expect(r.status).toBe("partial");
    expect(sheets.get("Productos", row, "_estado_sync")).toBe("CONFLICTO");
    expect(sheets.get("Productos", row, "Precio venta")).toBe(1800);
    expect(Number((await one<{ p: string }>(`select sale_price::text p from products where id = $1`, [product])).p)).toBe(1700);
    const c = await sync.openConflicts();
    expect(c.length).toBe(1);
    expect(c[0].summary).toContain("Precio venta");
    // La siguiente corrida no duplica el conflicto.
    await runSync(sheets, sync, "prueba");
    expect((await sync.openConflicts()).length).toBe(1);

    await resolveConflict(sheets, sync, c[0].id, "sheets", admin);
    expect(Number((await one<{ p: string }>(`select sale_price::text p from products where id = $1`, [product])).p)).toBe(1800);
    expect(sheets.get("Productos", row, "_estado_sync")).toBe("OK");
    const after = await runSync(sheets, sync, "prueba");
    expect(after.tabs.find((t) => t.tab === "Productos")!.conflicts).toBe(0);
  });

  it("fila nueva en Sheets crea el registro y recibe su ID; reintentos no duplican", async () => {
    sheets.addRow("Ingredientes", { "Ingrediente": "Ingrediente nuevo", "Unidad base": "g", "Costo por unidad base": "1,2", "Activo": true });
    sheets.failNextWriteOn = "Ingredientes"; // falla de red al fijar el ID → no se crea nada
    const r1 = await runSync(sheets, sync, "prueba");
    expect(r1.tabs.find((t) => t.tab === "Ingredientes")!.fatal).toMatch(/red/);
    expect((await one<{ n: number }>(`select count(*)::int n from ingredients where name = 'Ingrediente nuevo'`)).n).toBe(0);

    await runSync(sheets, sync, "prueba");
    expect((await one<{ n: number }>(`select count(*)::int n from ingredients where name = 'Ingrediente nuevo'`)).n).toBe(1);
    const row = sheets.findRow("Ingredientes", "Ingrediente", "Ingrediente nuevo");
    const id = String(sheets.get("Ingredientes", row, "ID"));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sheets.get("Ingredientes", row, "Estado costo")).toBe("OK");

    // Simula que la escritura final falló: la fila tiene ID pero no versión.
    sheets.set("Ingredientes", row, "_versión", "");
    sheets.set("Ingredientes", row, "_huella", "");
    await runSync(sheets, sync, "prueba");
    expect((await one<{ n: number }>(`select count(*)::int n from ingredients where name = 'Ingrediente nuevo'`)).n).toBe(1);
  });

  it("hojas de operación no aceptan filas nuevas desde Sheets", async () => {
    const row = sheets.addRow("Ventas", { "Total venta": 5000 });
    await runSync(sheets, sync, "prueba");
    expect(String(sheets.get("Ventas", row, "_estado_sync"))).toMatch(/se crean desde la app/);
    expect((await one<{ n: number }>(`select count(*)::int n from sales`)).n).toBe(1);
  });

  it("una fila borrada en Sheets se restaura (los registros se desactivan, no se borran)", async () => {
    const g = sheets.grid("Clientes");
    await asUser(db, op, () => db.query(`insert into customers (name) values ('Cliente B')`));
    await runSync(sheets, sync, "prueba");
    const row = sheets.findRow("Clientes", "Cliente", "Cliente B");
    g.splice(row, 1);
    await runSync(sheets, sync, "prueba");
    expect(sheets.findRow("Clientes", "Cliente", "Cliente B")).toBeGreaterThan(0);
  });

  it("parámetros: cambiar el margen objetivo actualiza la configuración y el precio sugerido", async () => {
    const row = sheets.findRow("Parametros", "Clave", "target_margin");
    sheets.set("Parametros", row, "Valor", "50%");
    const cm = sheets.findRow("Parametros", "Clave", "costo_mano_obra_hora");
    sheets.set("Parametros", cm, "Valor", 6000);
    await runSync(sheets, sync, "prueba");
    const s = await one<{ target_margin: string; params: any }>(`select target_margin::text, params from business_settings where business_id = $1`, [admin]);
    expect(Number(s.target_margin)).toBe(0.5);
    expect(s.params.costo_mano_obra_hora).toBe(6000);
    expect(sheets.get("Parametros", row, "_estado_sync")).toBe("OK");
  });

  it("encabezados alterados: esa hoja no se toca y las demás siguen", async () => {
    sheets.grid("Canales")[0][1] = "Canal de venta";
    const r = await runSync(sheets, sync, "prueba");
    expect(r.tabs.find((t) => t.tab === "Canales")!.fatal).toMatch(/encabezados/);
    expect(r.tabs.find((t) => t.tab === "Productos")!.fatal).toBeUndefined();
    sheets.grid("Canales")[0][1] = "Canal";
  });

  it("no corren dos sincronizaciones a la vez", async () => {
    const id = await sync.startRun("manual");
    expect(id).toBeTruthy();
    const r = await runSync(sheets, sync, "programada");
    expect(r.status).toBe("busy");
    await sync.finishRun(id!, "ok", {});
  });

  // ---- Pruebas de aceptación 1 a 6 (spec §13) ----

  let newProduct = "";
  it("P1: producto creado en Sheets aparece en la app", async () => {
    sheets.addRow("Productos", { "Producto": "Producto desde Sheets", "Precio venta": "2.000", "Costo empaque ($/u)": 100, "Activo": true });
    await runSync(sheets, sync, "prueba");
    const p = await one<{ id: string; sale_price: string; updated_source: string }>(`select id, sale_price::text, updated_source from products where name = 'Producto desde Sheets'`);
    expect(Number(p.sale_price)).toBe(2000);
    expect(p.updated_source).toBe("sheets");
    newProduct = p.id;
    // La operadora lo ve con su sesión (RLS).
    const seen = await asUser(db, op, () => one<{ n: number }>(`select count(*)::int n from products where id = $1`, [newProduct]));
    expect(seen.n).toBe(1);
    const row = sheets.findRow("Productos", "ID", newProduct);
    expect(sheets.get("Productos", row, "Estado costeo")).toBe("OK");
  });

  it("P2: cambio de precio en Sheets → las operaciones nuevas usan el precio nuevo", async () => {
    const row = sheets.findRow("Productos", "ID", newProduct);
    sheets.set("Productos", row, "Precio venta", 2500);
    await runSync(sheets, sync, "prueba");
    const o = await asUser(db, op, () => rpc(db, "rpc_create_order", { idempotency_key: "p2", order_date: "2026-11-01", new_customer: { name: "Cliente P2" }, items: [{ product_id: newProduct, quantity: 2 }] }));
    expect(Number(o.total)).toBe(5000);
  });

  let orderId = "";
  it("P3: pedido creado en la app aparece en Sheets con el mismo ID", async () => {
    const o = await asUser(db, op, () => rpc(db, "rpc_create_order", { idempotency_key: "p3", order_date: "2026-11-02", new_customer: { name: "Cliente P3" }, deposit: 1000, items: [{ product_id: newProduct, quantity: 1 }] }));
    orderId = o.id;
    await runSync(sheets, sync, "prueba");
    const row = sheets.findRow("Pedidos", "ID", orderId);
    expect(row).toBeGreaterThan(0);
    expect(sheets.get("Pedidos", row, "Cliente")).toBe("Cliente P3");
    expect(sheets.get("Pedidos", row, "Saldo")).toBe(1500);
    expect(sheets.findRow("Pedido_Detalle", "ID Pedido", orderId)).toBeGreaterThan(0);
  });

  it("P4: editar el pedido en Sheets (fecha y notas) se refleja en la app", async () => {
    const row = sheets.findRow("Pedidos", "ID", orderId);
    sheets.set("Pedidos", row, "Fecha entrega", "05-11-2026");
    sheets.set("Pedidos", row, "Notas", "Retira en local");
    await runSync(sheets, sync, "prueba");
    const o = await one<{ d: string; notes: string }>(`select order_date::text d, notes from orders where id = $1`, [orderId]);
    expect(o).toEqual({ d: "2026-11-05", notes: "Retira en local" });
    // Las columnas de la operación (montos, estado) no se pueden cambiar desde Sheets.
    sheets.set("Pedidos", row, "Total", 1);
    await runSync(sheets, sync, "prueba");
    expect(sheets.get("Pedidos", row, "Total")).toBe(2500);
  });

  it("P5: abono desde la app actualiza el saldo sin crear ventas", async () => {
    const ventas = await one<{ n: number }>(`select count(*)::int n from sales`);
    await asUser(db, op, () => rpc(db, "rpc_register_payment", { idempotency_key: "p5", order_id: orderId, amount: 500, method: "transferencia" }));
    await runSync(sheets, sync, "prueba");
    expect(sheets.get("Pedidos", sheets.findRow("Pedidos", "ID", orderId), "Saldo")).toBe(1000);
    expect((await one<{ n: number }>(`select count(*)::int n from sales`)).n).toBe(ventas.n);
    expect(sheets.findRow("Cobros", "Monto", 500)).toBeGreaterThan(0);
  });

  it("P6: gasto registrado en la app llega a la hoja Gastos (base del Resumen_Mensual)", async () => {
    await asUser(db, op, () => rpc(db, "rpc_add_expense", { idempotency_key: "p6", description: "Gas prueba", amount: 4321, category: "Servicios" }));
    await runSync(sheets, sync, "prueba");
    const row = sheets.findRow("Gastos", "Descripción", "Gas prueba");
    expect(sheets.get("Gastos", row, "Monto")).toBe(4321);
    expect(sheets.get("Gastos", row, "Anulado")).toBe(false);
  });

  it("la bitácora queda en la base y en la hoja Sync_Bitacora", async () => {
    const n = await one<{ n: number }>(`select count(*)::int n from sync_log where business_id = $1`, [admin]);
    expect(n.n).toBeGreaterThan(5);
    expect(sheets.grid("Sync_Bitacora").length).toBeGreaterThan(5);
  });
});
