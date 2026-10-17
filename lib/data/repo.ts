/**
 * Operaciones de negocio de Sarah & Tin.
 *
 * Con Supabase (producción) cada operación es UNA llamada a una función de la
 * base (RPC) que valida permisos y se ejecuta completa o no se ejecuta
 * (venta + ítems + stock + cobro). Cada llamada lleva una clave de idempotencia:
 * un doble toque o un reintento tras un corte de red no duplica el registro.
 *
 * En modo demo (sin Supabase) se ejecuta la misma lógica en el navegador.
 */
import { list, create, update, remove, createSilent, updateSilent, usingSupabase } from "./client";
import { emitChange } from "./bus";
import { requestSync } from "./sync-client";
import { newId } from "./adapter";
import { createClient } from "@/lib/supabase/client";
import { TABLES } from "./types";
import type {
  Sale, SaleItem, Payment, Ingredient, IngredientPurchase, Expense, Order, OrderItem,
  Product, Recipe, RecipeIngredient, Customer, PaymentMethod, PaymentStatus, PaymentKind,
  MeasureUnit, OrderStatus, BusinessSettings,
} from "./types";
import { toBase } from "@/lib/domain/units";
import { computeRecipeCost } from "@/lib/domain/costing";

/** Clave nueva de idempotencia (una por intento de registro de la usuaria). */
export function newOperationKey(): string {
  return newId();
}

// ---------------------------------------------------------------------------
// Infraestructura
// ---------------------------------------------------------------------------

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) throw error;
  emitChange();
  requestSync();
  return data as T;
}

const IDEM_KEY = "sarahtin_v1_idempotency";

const inFlight = new Map<string, Promise<unknown>>();

/** Idempotencia en modo demo (localStorage), también para toques simultáneos. */
async function localOnce<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
  if (!key || typeof window === "undefined") return fn();
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const p = localOnceInner(key, fn).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function localOnceInner<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let done: Record<string, T> = {};
  try {
    done = JSON.parse(window.localStorage.getItem(IDEM_KEY) ?? "{}");
  } catch {
    done = {};
  }
  if (key in done) return done[key];
  const r = await fn();
  done[key] = r;
  window.localStorage.setItem(IDEM_KEY, JSON.stringify(done));
  return r;
}

// ---------------------------------------------------------------------------
// Inventario y costo (modo demo; en Supabase lo hace la base)
// ---------------------------------------------------------------------------

async function localProductUnitCost(productId: string): Promise<number | null> {
  const [products, recipes, lines, ingredients, settings] = await Promise.all([
    list<Product>(TABLES.products),
    list<Recipe>(TABLES.recipes),
    list<RecipeIngredient>(TABLES.recipe_ingredients),
    list<Ingredient>(TABLES.ingredients),
    list<BusinessSettings>(TABLES.business_settings),
  ]);
  const p = products.find((x) => x.id === productId);
  if (!p) return null;
  const rate = Number(settings[0]?.params?.costo_mano_obra_hora ?? 0) || 0;
  const recipe = p.recipe_id ? recipes.find((r) => r.id === p.recipe_id) : null;
  const recipeCost = recipe
    ? computeRecipeCost(recipe, lines.filter((l) => l.recipe_id === recipe.id), ingredients, rate).perYield
    : 0;
  return recipeCost + (p.additional_cost ?? 0) + (p.packaging_cost ?? 0);
}

/** Descuenta (sign -1) o repone (+1) stock de productos e ingredientes según receta. */
async function applyStockForItems(items: { productId: string | null; quantity: number }[], sign: -1 | 1): Promise<void> {
  const withProduct = items.filter((it) => it.productId);
  if (withProduct.length === 0) return;
  const [products, recipes, recipeLines, ingredients] = await Promise.all([
    list<Product>(TABLES.products),
    list<Recipe>(TABLES.recipes),
    list<RecipeIngredient>(TABLES.recipe_ingredients),
    list<Ingredient>(TABLES.ingredients),
  ]);
  const ingredientDelta = new Map<string, number>();
  for (const it of withProduct) {
    const product = products.find((p) => p.id === it.productId);
    if (!product) continue;
    await updateSilent<Product>(TABLES.products, product.id, { stock: (product.stock ?? 0) + sign * it.quantity });
    product.stock = (product.stock ?? 0) + sign * it.quantity;
    const recipe = product.recipe_id ? recipes.find((r) => r.id === product.recipe_id) : null;
    if (recipe && recipe.yield_qty > 0) {
      const factor = it.quantity / recipe.yield_qty;
      for (const line of recipeLines.filter((l) => l.recipe_id === recipe.id)) {
        const consumed = toBase(line.quantity, line.unit) * factor;
        ingredientDelta.set(line.ingredient_id, (ingredientDelta.get(line.ingredient_id) ?? 0) + consumed);
      }
    }
  }
  for (const [ingId, amount] of ingredientDelta) {
    const ing = ingredients.find((i) => i.id === ingId);
    if (ing) await updateSilent<Ingredient>(TABLES.ingredients, ingId, { stock: ing.stock + sign * amount });
  }
}

function paymentStatusOf(paid: number, total: number): PaymentStatus {
  return paid <= 0 ? "pendiente" : paid >= total ? "pagado" : "abono";
}

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export interface NewSaleInput {
  customerId: string | null;
  items: { productId: string | null; name: string; quantity: number; unitPrice: number }[];
  method: PaymentMethod;
  status: PaymentStatus; // pagado | pendiente | abono
  paidAmount: number;
  notes?: string;
  date?: string;
  orderId?: string | null;
  key?: string;
}

export async function createSale(input: NewSaleInput): Promise<{ id: string; duplicate?: boolean }> {
  if (input.items.length === 0) throw new Error("Agrega al menos un producto a la venta.");
  if (input.status !== "pagado" && !input.customerId) throw new Error("Para dejar saldo pendiente elige un cliente.");

  if (usingSupabase()) {
    return rpc("rpc_create_sale", {
      p: {
        idempotency_key: input.key,
        customer_id: input.customerId,
        status: input.status,
        method: input.method,
        paid_amount: input.paidAmount,
        notes: input.notes ?? null,
        sale_date: input.date ?? null,
        order_id: input.orderId ?? null,
        items: input.items.map((it) => ({ product_id: it.productId, name: it.name, quantity: it.quantity, unit_price: it.unitPrice })),
      },
    });
  }

  return localOnce(input.key, async () => {
    const total = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const paid = input.status === "pagado" ? total : input.status === "abono" ? Math.min(Math.max(input.paidAmount, 0), total) : 0;
    const sale = await createSilent<Sale>(TABLES.sales, {
      customer_id: input.customerId,
      sale_date: input.date ?? new Date().toISOString(),
      total,
      subtotal: total,
      paid_amount: paid,
      method: input.method,
      status: paymentStatusOf(paid, total),
      notes: input.notes ?? null,
      order_id: input.orderId ?? null,
    });
    for (const it of input.items) {
      await createSilent<SaleItem>(TABLES.sale_items, {
        sale_id: sale.id,
        product_id: it.productId,
        name_snapshot: it.name,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        line_total: it.quantity * it.unitPrice,
        unit_cost: it.productId ? await localProductUnitCost(it.productId) : null,
      });
    }
    await applyStockForItems(input.items, -1);
    if (paid > 0) {
      await createSilent<Payment>(TABLES.payments, {
        customer_id: input.customerId, sale_id: sale.id, amount: paid, method: input.method,
        kind: "cobro", note: null, paid_at: sale.sale_date,
      });
    }
    emitChange();
    return { id: sale.id };
  });
}

/** Anula una venta (no se borra): repone stock y anula sus cobros. */
export async function voidSale(saleId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Indica el motivo de la anulación.");
  if (usingSupabase()) {
    await rpc("rpc_void_sale", { p_sale: saleId, p_reason: reason.trim() });
    return;
  }
  const sale = (await list<Sale>(TABLES.sales)).find((s) => s.id === saleId);
  if (!sale || sale.voided_at) return;
  const items = (await list<SaleItem>(TABLES.sale_items)).filter((it) => it.sale_id === saleId);
  await applyStockForItems(items.map((it) => ({ productId: it.product_id, quantity: it.quantity })), 1);
  const now = new Date().toISOString();
  await updateSilent<Sale>(TABLES.sales, saleId, { voided_at: now, void_reason: reason.trim() });
  for (const p of (await list<Payment>(TABLES.payments)).filter((x) => x.sale_id === saleId)) {
    if (p.kind === "anticipo" && p.order_id) await updateSilent<Payment>(TABLES.payments, p.id, { sale_id: null });
    else if (!p.voided_at) await updateSilent<Payment>(TABLES.payments, p.id, { voided_at: now });
  }
  for (const o of (await list<Order>(TABLES.orders)).filter((x) => x.sale_id === saleId)) {
    await updateSilent<Order>(TABLES.orders, o.id, { sale_id: null, status: "listo", delivered_at: null });
  }
  emitChange();
}

// ---------------------------------------------------------------------------
// Cobros, abonos y reembolsos
// ---------------------------------------------------------------------------

export interface PaymentInput {
  kind: PaymentKind; // cobro | abono (deuda) · anticipo (pedido) · reembolso
  amount: number;
  method: PaymentMethod;
  customerId?: string | null;
  saleId?: string | null;
  orderId?: string | null;
  note?: string;
  key?: string;
}

export async function registerPayment(input: PaymentInput): Promise<void> {
  if (!(input.amount > 0)) throw new Error("El monto debe ser mayor a cero.");
  if (usingSupabase()) {
    await rpc("rpc_register_payment", {
      p: {
        idempotency_key: input.key, kind: input.kind, amount: input.amount, method: input.method,
        note: input.note ?? null, customer_id: input.customerId ?? null, sale_id: input.saleId ?? null,
        order_id: input.orderId ?? null,
      },
    });
    return;
  }
  await localOnce(input.key, async () => {
    const now = new Date().toISOString();
    const sales = (await list<Sale>(TABLES.sales)).filter((s) => !s.voided_at);

    if (input.kind === "reembolso" && input.orderId) {
      const o = (await list<Order>(TABLES.orders)).find((x) => x.id === input.orderId);
      if (!o) throw new Error("Pedido no encontrado.");
      if (o.sale_id) throw new Error("Este pedido ya se entregó: el reembolso se hace sobre su venta.");
      if (input.amount > o.deposit) throw new Error("El reembolso supera lo abonado al pedido.");
      await updateSilent<Order>(TABLES.orders, o.id, { deposit: o.deposit - input.amount, payment_status: paymentStatusOf(o.deposit - input.amount, o.total) });
      await createSilent<Payment>(TABLES.payments, { customer_id: o.customer_id, order_id: o.id, sale_id: null, amount: -input.amount, method: input.method, kind: "reembolso", note: input.note ?? null, paid_at: now });
      emitChange();
      return true;
    }

    if (input.kind === "reembolso") {
      const s = sales.find((x) => x.id === input.saleId);
      if (!s) throw new Error("Elige la venta a reembolsar.");
      if (input.amount > s.paid_amount) throw new Error("El reembolso supera lo cobrado en esa venta.");
      await updateSilent<Sale>(TABLES.sales, s.id, { paid_amount: s.paid_amount - input.amount, status: s.paid_amount - input.amount <= 0 ? "pendiente" : "abono" });
      await createSilent<Payment>(TABLES.payments, { customer_id: s.customer_id, sale_id: s.id, amount: -input.amount, method: input.method, kind: "reembolso", note: input.note ?? null, paid_at: now });
      emitChange();
      return true;
    }

    if (input.orderId) {
      const o = (await list<Order>(TABLES.orders)).find((x) => x.id === input.orderId);
      if (!o) throw new Error("Pedido no encontrado.");
      if (o.sale_id) {
        await registerPayment({ ...input, orderId: null, saleId: o.sale_id, kind: "abono", key: undefined });
        return true;
      }
      if (input.amount > o.total - o.deposit) throw new Error("El abono supera el saldo del pedido.");
      await updateSilent<Order>(TABLES.orders, o.id, { deposit: o.deposit + input.amount, payment_status: paymentStatusOf(o.deposit + input.amount, o.total) });
      await createSilent<Payment>(TABLES.payments, { customer_id: o.customer_id, order_id: o.id, sale_id: null, amount: input.amount, method: input.method, kind: "anticipo", note: input.note ?? null, paid_at: now });
      emitChange();
      return true;
    }

    const pending = sales
      .filter((s) => s.status !== "pagado" && (input.saleId ? s.id === input.saleId : s.customer_id === input.customerId))
      .sort((a, b) => +new Date(a.sale_date) - +new Date(b.sale_date));
    const debt = pending.reduce((sum, s) => sum + Math.max(s.total - s.paid_amount, 0), 0);
    if (debt <= 0) throw new Error("No hay saldo pendiente que cobrar.");
    if (input.amount > debt) throw new Error("El pago supera la deuda pendiente.");
    let remaining = input.amount;
    for (const sale of pending) {
      if (remaining <= 0) break;
      const applied = Math.min(sale.total - sale.paid_amount, remaining);
      if (applied <= 0) continue;
      await updateSilent<Sale>(TABLES.sales, sale.id, { paid_amount: sale.paid_amount + applied, status: paymentStatusOf(sale.paid_amount + applied, sale.total) });
      await createSilent<Payment>(TABLES.payments, { customer_id: sale.customer_id, sale_id: sale.id, amount: applied, method: input.method, kind: input.kind, note: input.note ?? null, paid_at: now });
      remaining -= applied;
    }
    emitChange();
    return true;
  });
}

// ---------------------------------------------------------------------------
// Compras de insumos (entran a inventario; NO son gasto)
// ---------------------------------------------------------------------------

export async function registerPurchase(input: {
  ingredientId: string;
  quantity: number;
  unit: MeasureUnit;
  totalCost: number;
  supplier?: string;
  paidAmount?: number;
  key?: string;
}): Promise<void> {
  if (!(input.quantity > 0)) throw new Error("La cantidad debe ser mayor a cero.");
  if (usingSupabase()) {
    await rpc("rpc_register_purchase", {
      p: {
        idempotency_key: input.key,
        supplier_name: input.supplier ?? null,
        paid_amount: input.paidAmount ?? input.totalCost,
        items: [{ ingredient_id: input.ingredientId, quantity: input.quantity, unit: input.unit, line_total: input.totalCost }],
      },
    });
    return;
  }
  await localOnce(input.key, async () => {
    const ing = (await list<Ingredient>(TABLES.ingredients)).find((i) => i.id === input.ingredientId);
    if (!ing) throw new Error("Ingrediente no encontrado.");
    const baseQty = toBase(input.quantity, input.unit);
    await createSilent<IngredientPurchase>(TABLES.ingredient_purchases, {
      ingredient_id: input.ingredientId, quantity: input.quantity, unit: input.unit,
      total_cost: input.totalCost, supplier: input.supplier ?? null,
    });
    await updateSilent<Ingredient>(TABLES.ingredients, ing.id, {
      stock: ing.stock + baseQty,
      cost_per_unit: baseQty > 0 ? input.totalCost / baseQty : ing.cost_per_unit,
      supplier: input.supplier ?? ing.supplier,
      last_purchase_at: new Date().toISOString(),
    });
    emitChange();
    return true;
  });
}

// ---------------------------------------------------------------------------
// Gastos operativos
// ---------------------------------------------------------------------------

export async function addExpense(input: {
  category: string;
  description: string;
  amount: number;
  date?: string;
  method?: string;
  notes?: string;
  key?: string;
}): Promise<void> {
  if (!(input.amount > 0)) throw new Error("El monto debe ser mayor a cero.");
  if (!input.description.trim()) throw new Error("Escribe una descripción del gasto.");
  if (usingSupabase()) {
    await rpc("rpc_add_expense", {
      p: {
        idempotency_key: input.key, category: input.category, description: input.description,
        amount: input.amount, expense_date: input.date ?? null, method: input.method ?? "efectivo", notes: input.notes ?? null,
      },
    });
    return;
  }
  await localOnce(input.key, async () => {
    await createSilent<Expense>(TABLES.expenses, {
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      expense_date: input.date ?? new Date().toISOString().slice(0, 10),
      method: input.method ?? "efectivo",
      notes: input.notes ?? null,
    });
    emitChange();
    return true;
  });
}

export async function voidExpense(expenseId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("Indica el motivo de la anulación.");
  if (usingSupabase()) {
    await rpc("rpc_void_expense", { p_expense: expenseId, p_reason: reason.trim() });
    return;
  }
  await update<Expense>(TABLES.expenses, expenseId, { voided_at: new Date().toISOString(), void_reason: reason.trim() });
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export interface NewOrderInput {
  customerId: string | null;
  newCustomer?: { name: string; phone?: string } | null;
  date: string;
  time?: string;
  items: { productId?: string | null; name: string; quantity: number; unitPrice: number; details?: string }[];
  deposit: number;
  method?: PaymentMethod;
  notes?: string;
  /** Solo modo demo: número visible (en Supabase lo asigna la base). */
  code?: string;
  key?: string;
}

export async function createOrder(input: NewOrderInput): Promise<{ id: string; code?: string }> {
  if (input.items.length === 0) throw new Error("Agrega al menos un producto al pedido.");
  if (!input.date) throw new Error("Indica la fecha de entrega.");
  if (usingSupabase()) {
    return rpc("rpc_create_order", {
      p: {
        idempotency_key: input.key,
        customer_id: input.customerId,
        new_customer: input.newCustomer ?? null,
        order_date: input.date,
        order_time: input.time || null,
        deposit: input.deposit,
        method: input.method ?? "efectivo",
        notes: input.notes ?? null,
        items: input.items.map((it) =>
          it.productId
            ? { product_id: it.productId, quantity: it.quantity, details: it.details ?? null }
            : { name: it.name, unit_price: it.unitPrice, quantity: it.quantity, details: it.details ?? null }
        ),
      },
    });
  }

  return localOnce(input.key, async () => {
    const total = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    if (input.deposit < 0 || input.deposit > total) throw new Error("El abono debe estar entre 0 y el total del pedido.");
    let customerId = input.customerId;
    if (!customerId && input.newCustomer?.name.trim()) {
      const c = await createSilent<Customer>(TABLES.customers, {
        name: input.newCustomer.name.trim(), phone: input.newCustomer.phone?.trim() || null, email: null, address: null, notes: null,
      });
      customerId = c.id;
    }
    const orders = await list<Order>(TABLES.orders);
    const maxCode = orders.reduce((m, o) => Math.max(m, Number(String(o.code ?? "").replace(/\D/g, "")) || 0), 1000);
    const code = input.code ?? `#${maxCode + 1}`;
    const order = await createSilent<Order>(TABLES.orders, {
      code, customer_id: customerId, order_date: input.date, order_time: input.time || null,
      status: "pendiente", payment_status: paymentStatusOf(input.deposit, total),
      total, deposit: input.deposit, notes: input.notes ?? null,
    });
    for (const it of input.items) {
      await createSilent<OrderItem>(TABLES.order_items, {
        order_id: order.id, product_id: it.productId ?? null, name_snapshot: it.name, quantity: it.quantity,
        unit_price: it.unitPrice, line_total: it.quantity * it.unitPrice, details: it.details ?? null,
      });
    }
    if (input.deposit > 0) {
      await createSilent<Payment>(TABLES.payments, {
        customer_id: customerId, order_id: order.id, sale_id: null, amount: input.deposit,
        method: input.method ?? "efectivo", kind: "anticipo", note: null, paid_at: new Date().toISOString(),
      });
    }
    emitChange();
    return { id: order.id, code };
  });
}

/** Cambia el estado. "Entregado" genera la venta (una sola vez) con el abono como cobro. */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<{ saleId?: string; warning?: string }> {
  if (usingSupabase()) {
    const r = await rpc<{ sale_id?: string; warning?: string }>("rpc_set_order_status", { p_order: orderId, p_status: status });
    return { saleId: r?.sale_id, warning: r?.warning ?? undefined };
  }
  const o = (await list<Order>(TABLES.orders)).find((x) => x.id === orderId);
  if (!o || o.status === status) return {};
  if (o.sale_id && status !== "entregado") throw new Error("Este pedido ya generó una venta. Para revertirlo, anula la venta.");
  if (status === "entregado" && !o.sale_id) {
    const items = (await list<OrderItem>(TABLES.order_items)).filter((it) => it.order_id === o.id);
    const sale = await createSilent<Sale>(TABLES.sales, {
      customer_id: o.customer_id, sale_date: new Date().toISOString(), total: o.total, subtotal: o.total,
      paid_amount: o.deposit, method: "efectivo", status: paymentStatusOf(o.deposit, o.total),
      notes: `Pedido ${o.code ?? ""}`.trim(), order_id: o.id,
    });
    for (const it of items) {
      await createSilent<SaleItem>(TABLES.sale_items, {
        sale_id: sale.id, product_id: it.product_id, name_snapshot: it.name_snapshot, quantity: it.quantity,
        unit_price: it.unit_price, line_total: it.line_total,
        unit_cost: it.product_id ? await localProductUnitCost(it.product_id) : null,
      });
    }
    await applyStockForItems(items.map((it) => ({ productId: it.product_id, quantity: it.quantity })), -1);
    for (const p of (await list<Payment>(TABLES.payments)).filter((x) => x.order_id === o.id && x.kind === "anticipo" && !x.voided_at)) {
      await updateSilent<Payment>(TABLES.payments, p.id, { sale_id: sale.id });
    }
    await update<Order>(TABLES.orders, o.id, { status, sale_id: sale.id, delivered_at: new Date().toISOString() });
    return { saleId: sale.id };
  }
  await update<Order>(TABLES.orders, o.id, { status });
  return status === "cancelado" && o.deposit > 0
    ? { warning: "El pedido tenía un abono: si lo devuelves, regístralo como reembolso." }
    : {};
}

/** @deprecated usar setOrderStatus */
export const updateOrderStatus = setOrderStatus;

// ---------------- Genéricos reexportados ----------------
export { list, create, update, remove };
