import { describe, it, expect } from "vitest";
import { computeRecipeCost, computeProductEconomics } from "@/lib/domain/costing";
import { computeDay } from "@/lib/domain/daily";
import { freshDb, createUser, asUser, rpc } from "../db/harness";
import { migrate } from "../db/harness";
import type { Ingredient, Recipe, RecipeIngredient, Sale, Payment, Expense, Order, SaleItem } from "@/lib/data/types";

// Datos ficticios (no son recetas ni cantidades reales del negocio).
const base = { owner_id: "x", created_at: "2026-01-01T00:00:00Z" };
const ingA = { ...base, id: "a", name: "Ingrediente A", unit: "g", cost_per_unit: 2, stock: 0, min_stock: 0, category: null, supplier: null, last_purchase_at: null } as Ingredient;
const ingB = { ...base, id: "b", name: "Ingrediente B", unit: "unidad", cost_per_unit: 0, stock: 0, min_stock: 0, category: null, supplier: null, last_purchase_at: null } as Ingredient;
const recipe = { ...base, id: "r", name: "Receta", yield_qty: 10, yield_unit: "u", notes: null, labor_minutes: 30, other_cost: 100 } as Recipe;
const lineA = { ...base, id: "l1", recipe_id: "r", ingredient_id: "a", quantity: 1, unit: "kg" } as RecipeIngredient;
const lineB = { ...base, id: "l2", recipe_id: "r", ingredient_id: "b", quantity: 2, unit: "unidad" } as RecipeIngredient;

describe("motor de costeo", () => {
  it("suma ingredientes, mano de obra y otros costos del lote; costo unitario por rendimiento", () => {
    const c = computeRecipeCost(recipe, [lineA], [ingA], 6000);
    expect(c.ingredientsCost).toBe(2000);
    expect(c.laborCost).toBe(3000); // 30 min a $6.000/h
    expect(c.otherCost).toBe(100);
    expect(c.total).toBe(5100);
    expect(c.perYield).toBe(510);
    expect(c.pending).toEqual([]);
  });

  it("marca pendiente de costeo si un ingrediente no tiene costo o falta rendimiento", () => {
    expect(computeRecipeCost(recipe, [lineA, lineB], [ingA, ingB]).pending).toEqual(["sin costo: Ingrediente B"]);
    expect(computeRecipeCost({ ...recipe, yield_qty: 0 }, [lineA], [ingA]).pending).toContain("rendimiento en cero");
    expect(computeRecipeCost(recipe, [], []).pending).toContain("sin ingredientes");
  });

  it("producto: empaque y adicionales, margen ≠ markup, precio sugerido redondeado", () => {
    const e = computeProductEconomics({ sale_price: 1000, additional_cost: 50, packaging_cost: 150, recipe_id: "r" }, 200, 0.6, 100);
    expect(e.cost).toBe(400);
    expect(e.margin).toBeCloseTo(0.6);
    expect(e.markup).toBeCloseTo(1.5);
    expect(e.suggestedPrice).toBe(1000);
    expect(e.pendingCosting).toBe(false);
    expect(computeProductEconomics({ sale_price: 1000, additional_cost: 0, packaging_cost: 0, recipe_id: null }, 0, 0.6, 100).pendingCosting).toBe(true);
  });

  it("el costo de la app y el de la base de datos coinciden", async () => {
    const db = await freshDb();
    const admin = await createUser(db, "admin@prueba.local");
    await migrate(db);
    const ids = await asUser(db, admin, async () => {
      await db.query(`update business_settings set params = params || '{"costo_mano_obra_hora": 6000}'::jsonb`);
      const a = (await db.query<{ id: string }>(`insert into ingredients (name, unit, cost_per_unit) values ('A','g',2) returning id`)).rows[0].id;
      const r = (await db.query<{ id: string }>(`insert into recipes (name, yield_qty, labor_minutes, other_cost) values ('R',10,30,100) returning id`)).rows[0].id;
      await db.query(`insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values ($1,$2,1,'kg')`, [r, a]);
      const p = (await db.query<{ id: string }>(`insert into products (name, sale_price, recipe_id, additional_cost, packaging_cost) values ('P',2000,$1,50,150) returning id`, [r])).rows[0].id;
      return { p };
    });
    const sql = (await db.query<{ c: string }>(`select public.product_unit_cost($1)::text c`, [ids.p])).rows[0].c;
    const ts = computeRecipeCost(recipe, [lineA], [ingA], 6000).perYield + 50 + 150;
    expect(Number(sql)).toBeCloseTo(ts, 6);
    expect(ts).toBe(710);
  }, 60_000);
});

describe("resumen del día", () => {
  const day = new Date(2026, 9, 17, 15, 0);
  const sale = (id: string, total: number, paid: number, extra: Partial<Sale> = {}) =>
    ({ ...base, id, customer_id: null, sale_date: new Date(2026, 9, 17, 12).toISOString(), total, paid_amount: paid, method: "efectivo", status: paid >= total ? "pagado" : "abono", notes: null, ...extra }) as Sale;
  const pay = (amount: number, method: string, extra: Partial<Payment> = {}) =>
    ({ ...base, id: Math.random().toString(), customer_id: null, sale_id: null, amount, method, note: null, paid_at: new Date(2026, 9, 17, 13).toISOString(), ...extra }) as Payment;

  it("separa lo vendido del dinero recibido y no cuenta anulados", () => {
    const s = computeDay({
      sales: [sale("s1", 10000, 4000), sale("s2", 5000, 5000, { voided_at: "2026-10-17T20:00:00Z" })],
      saleItems: [{ ...base, id: "i", sale_id: "s1", product_id: null, name_snapshot: "x", quantity: 3, unit_price: 1, line_total: 3 } as SaleItem],
      payments: [pay(4000, "efectivo"), pay(7000, "transferencia", { kind: "abono" }), pay(-1000, "efectivo", { kind: "reembolso" }), pay(9999, "efectivo", { voided_at: "x" })],
      expenses: [{ ...base, id: "e", category: null, description: "gas", amount: 2500, expense_date: "2026-10-17" } as Expense],
      orders: [] as Order[],
    }, day);
    expect(s.sold).toBe(10000);
    expect(s.units).toBe(3);
    expect(s.received).toBe(10000);
    expect(s.refunds).toBe(1000);
    expect(s.creditGiven).toBe(6000);
    expect(s.expenses).toBe(2500);
    expect(s.receivedByMethod).toEqual([{ method: "transferencia", amount: 7000 }, { method: "efectivo", amount: 3000 }]);
  });

  it("sin registros dice que está vacío (no inventa cifras)", () => {
    expect(computeDay({ sales: [], saleItems: [], payments: [], expenses: [], orders: [] }, day).empty).toBe(true);
  });
});
