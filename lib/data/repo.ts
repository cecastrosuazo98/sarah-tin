/**
 * Operaciones de negocio de Sarah & Tin.
 * Encapsulan la lógica que toca varias tablas (venta + ítems + pago,
 * pago + aplicación a deudas, compra + inventario, etc.).
 */
import {
  list,
  create,
  update,
  remove,
  createSilent,
  updateSilent,
} from "./client";
import { emitChange } from "./bus";
import { TABLES } from "./types";
import type {
  Sale,
  SaleItem,
  Payment,
  Ingredient,
  IngredientPurchase,
  Expense,
  Order,
  OrderItem,
  Product,
  Recipe,
  RecipeIngredient,
  PaymentMethod,
  PaymentStatus,
  MeasureUnit,
  OrderStatus,
} from "./types";
import { toBase } from "@/lib/domain/units";
import { toYmd } from "@/lib/domain/dates";
import { normalize } from "@/lib/search";

// ---------------- Inventario (descuento/reposición por venta) ----------------

/**
 * Calcula cuánto stock de productos e ingredientes consume (o repone) un
 * conjunto de ítems vendidos. `sign` = -1 descuenta (venta), +1 repone
 * (al eliminar una venta). Aplica los cambios en el store.
 */
async function applyStockForItems(
  items: { productId: string | null; quantity: number }[],
  sign: -1 | 1
): Promise<void> {
  const withProduct = items.filter((it) => it.productId);
  if (withProduct.length === 0) return;

  const [products, recipes, recipeLines, ingredients] = await Promise.all([
    list<Product>(TABLES.products),
    list<Recipe>(TABLES.recipes),
    list<RecipeIngredient>(TABLES.recipe_ingredients),
    list<Ingredient>(TABLES.ingredients),
  ]);

  const ingredientDelta = new Map<string, number>(); // ingredient_id -> unidades base

  for (const it of withProduct) {
    const product = products.find((p) => p.id === it.productId);
    if (!product) continue;

    // Stock del producto (trozos / unidades).
    await updateSilent<Product>(TABLES.products, product.id, {
      stock: (product.stock ?? 0) + sign * it.quantity,
    });

    // Ingredientes, proporcional al rendimiento de la receta.
    if (product.recipe_id) {
      const recipe = recipes.find((r) => r.id === product.recipe_id);
      if (recipe && recipe.yield_qty > 0) {
        const factor = it.quantity / recipe.yield_qty;
        for (const line of recipeLines.filter((l) => l.recipe_id === recipe.id)) {
          const consumed = toBase(line.quantity, line.unit) * factor;
          ingredientDelta.set(
            line.ingredient_id,
            (ingredientDelta.get(line.ingredient_id) ?? 0) + consumed
          );
        }
      }
    }
  }

  for (const [ingId, amount] of ingredientDelta) {
    const ing = ingredients.find((i) => i.id === ingId);
    if (!ing) continue;
    await updateSilent<Ingredient>(TABLES.ingredients, ingId, {
      stock: ing.stock + sign * amount,
    });
  }
}

// ---------------- Ventas ----------------

export interface NewSaleInput {
  customerId: string | null;
  items: { productId: string | null; name: string; quantity: number; unitPrice: number }[];
  method: PaymentMethod;
  status: PaymentStatus; // pagado | pendiente | abono
  paidAmount: number;
  notes?: string;
  date?: string;
  /**
   * Parte de `paidAmount` que ya se pagó antes y tiene su propio registro en
   * `payments` (ej: el adelanto de un pedido). No se vuelve a registrar.
   */
  alreadyPaid?: number;
}

export async function createSale(input: NewSaleInput): Promise<Sale> {
  const total = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const paid =
    input.status === "pagado"
      ? total
      : input.status === "abono"
        ? Math.min(input.paidAmount, total)
        : 0;

  const sale = await createSilent<Sale>(TABLES.sales, {
    customer_id: input.customerId,
    sale_date: input.date ?? new Date().toISOString(),
    total,
    paid_amount: paid,
    method: input.method,
    status: input.status,
    notes: input.notes ?? null,
  });

  for (const it of input.items) {
    await createSilent<SaleItem>(TABLES.sale_items, {
      sale_id: sale.id,
      product_id: it.productId,
      name_snapshot: it.name,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      line_total: it.quantity * it.unitPrice,
    });
  }

  // Lo que pagó al momento de comprar queda como un pago ligado a la venta,
  // así "Recibiste" del día se calcula solo, sumando los pagos.
  const paidNow = paid - Math.min(input.alreadyPaid ?? 0, paid);
  if (paidNow > 0) {
    await createSilent<Payment>(TABLES.payments, {
      customer_id: input.customerId,
      sale_id: sale.id,
      amount: paidNow,
      method: input.method === "fiado" ? "efectivo" : input.method,
      note: "Pagó al comprar",
      paid_at: sale.sale_date,
    });
  }

  // Descuenta inventario: stock de productos e ingredientes (según receta).
  await applyStockForItems(input.items, -1);

  emitChange();
  return sale;
}

/**
 * Elimina una venta y repone el inventario que había descontado
 * (para no descuadrar el stock).
 */
export async function deleteSale(saleId: string): Promise<void> {
  const items = (await list<SaleItem>(TABLES.sale_items)).filter(
    (it) => it.sale_id === saleId
  );
  await applyStockForItems(
    items.map((it) => ({ productId: it.product_id, quantity: it.quantity })),
    1
  );
  for (const it of items) {
    await remove(TABLES.sale_items, it.id);
  }
  // Los pagos de esa venta también se van (si no, "Recibiste" quedaría inflado).
  const linkedPayments = (await list<Payment>(TABLES.payments)).filter(
    (p) => p.sale_id === saleId
  );
  for (const p of linkedPayments) {
    await remove(TABLES.payments, p.id);
  }
  await remove(TABLES.sales, saleId);
  emitChange();
}

// ---------------- Pagos de deuda ----------------

/**
 * Registra un pago de un cliente. Se aplica solo a sus ventas pendientes (las
 * más antiguas primero, o solo a `saleId` si se indica). Se guarda una fila de
 * pago por cada venta a la que se aplicó, para saber siempre qué pagó.
 */
export async function registerPayment(input: {
  customerId: string;
  amount: number;
  method?: PaymentMethod;
  note?: string;
  saleId?: string;
}): Promise<void> {
  const method = input.method ?? "efectivo";
  const paidAt = new Date().toISOString();

  const sales = (await list<Sale>(TABLES.sales))
    .filter(
      (s) =>
        s.customer_id === input.customerId &&
        s.status !== "pagado" &&
        (input.saleId ? s.id === input.saleId : true)
    )
    .sort((a, b) => +new Date(a.sale_date) - +new Date(b.sale_date));

  let remaining = input.amount;
  for (const sale of sales) {
    if (remaining <= 0) break;
    const outstanding = sale.total - sale.paid_amount;
    if (outstanding <= 0) continue;
    const applied = Math.min(outstanding, remaining);
    const newPaid = sale.paid_amount + applied;
    await createSilent<Payment>(TABLES.payments, {
      customer_id: input.customerId,
      sale_id: sale.id,
      amount: applied,
      method,
      note: input.note ?? null,
      paid_at: paidAt,
    });
    await updateSilent<Sale>(TABLES.sales, sale.id, {
      paid_amount: newPaid,
      status: newPaid >= sale.total ? "pagado" : "abono",
    });
    remaining -= applied;
  }

  // Si pagó más de lo que debía, el resto igual queda registrado.
  if (remaining > 0) {
    await createSilent<Payment>(TABLES.payments, {
      customer_id: input.customerId,
      sale_id: null,
      amount: remaining,
      method,
      note: input.note ?? null,
      paid_at: paidAt,
    });
  }

  emitChange();
}

// ---------------- Compras de ingredientes ----------------

export async function registerPurchase(input: {
  ingredientId: string;
  quantity: number;
  unit: MeasureUnit;
  totalCost: number;
  supplier?: string;
  registerAsExpense?: boolean;
}): Promise<void> {
  const ingredients = await list<Ingredient>(TABLES.ingredients);
  const ing = ingredients.find((i) => i.id === input.ingredientId);
  if (!ing) throw new Error("Ingrediente no encontrado.");

  const baseQty = toBase(input.quantity, input.unit);

  await createSilent<IngredientPurchase>(TABLES.ingredient_purchases, {
    ingredient_id: input.ingredientId,
    quantity: input.quantity,
    unit: input.unit,
    total_cost: input.totalCost,
    supplier: input.supplier ?? null,
  });

  // Actualiza stock y recalcula el costo por unidad base.
  await updateSilent<Ingredient>(TABLES.ingredients, ing.id, {
    stock: ing.stock + baseQty,
    cost_per_unit: baseQty > 0 ? input.totalCost / baseQty : ing.cost_per_unit,
    supplier: input.supplier ?? ing.supplier,
    last_purchase_at: new Date().toISOString(),
  });

  if (input.registerAsExpense) {
    await createSilent<Expense>(TABLES.expenses, {
      category: "Ingredientes",
      description: `Compra: ${ing.name}`,
      amount: input.totalCost,
      expense_date: toYmd(new Date()),
    });
  }

  emitChange();
}

// ---------------- Gastos ----------------

export async function addExpense(input: {
  category: string;
  description: string;
  amount: number;
  date?: string;
}): Promise<void> {
  await createSilent<Expense>(TABLES.expenses, {
    category: input.category,
    description: input.description,
    amount: input.amount,
    expense_date: input.date ?? toYmd(new Date()),
  });
  emitChange();
}

// ---------------- Pedidos ----------------

export interface NewOrderInput {
  customerId: string | null;
  code: string;
  date: string;
  time?: string;
  items: { name: string; quantity: number; unitPrice: number; details?: string }[];
  deposit: number;
  notes?: string;
}

/** Nota con la que se guarda el adelanto de un pedido (para ligarlo al entregarlo). */
const advanceNote = (code: string) => `Adelanto pedido ${code}`;

/** Producto con ese nombre (sin importar mayúsculas ni tildes), si existe. */
function productByName(products: Product[], name: string): Product | undefined {
  const n = normalize(name).trim();
  return products.find((p) => normalize(p.name).trim() === n);
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  const products = await list<Product>(TABLES.products);
  const total = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const paymentStatus: PaymentStatus =
    input.deposit <= 0 ? "pendiente" : input.deposit >= total ? "pagado" : "abono";

  const order = await createSilent<Order>(TABLES.orders, {
    code: input.code,
    customer_id: input.customerId,
    order_date: input.date,
    order_time: input.time ?? null,
    status: "pendiente",
    payment_status: paymentStatus,
    total,
    deposit: input.deposit,
    notes: input.notes ?? null,
  });

  for (const it of input.items) {
    const product = productByName(products, it.name);
    await createSilent<OrderItem>(TABLES.order_items, {
      order_id: order.id,
      product_id: product?.id ?? null,
      name_snapshot: product?.name ?? it.name,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      line_total: it.quantity * it.unitPrice,
      details: it.details ?? null,
    });
  }

  // El adelanto es dinero que entra hoy: queda como pago (aún sin venta).
  const deposit = Math.min(input.deposit, total);
  if (deposit > 0) {
    await createSilent<Payment>(TABLES.payments, {
      customer_id: input.customerId,
      sale_id: null,
      amount: deposit,
      method: "efectivo",
      note: advanceNote(input.code),
      paid_at: new Date().toISOString(),
    });
  }

  emitChange();
  return order;
}

/**
 * Entregar un pedido: queda anotado como venta de hoy (con su deuda, si no
 * pagó todo) y el adelanto se liga a esa venta.
 */
export async function deliverOrder(input: { orderId: string; paidNow: number }): Promise<Sale> {
  const [orders, orderItems, products, payments] = await Promise.all([
    list<Order>(TABLES.orders),
    list<OrderItem>(TABLES.order_items),
    list<Product>(TABLES.products),
    list<Payment>(TABLES.payments),
  ]);
  const order = orders.find((o) => o.id === input.orderId);
  if (!order) throw new Error("No encontramos ese pedido.");

  const items = orderItems
    .filter((it) => it.order_id === order.id)
    .map((it) => ({
      productId: it.product_id ?? productByName(products, it.name_snapshot)?.id ?? null,
      name: it.name_snapshot,
      quantity: it.quantity,
      unitPrice: it.unit_price,
    }));
  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const deposit = Math.min(order.deposit, total);
  const paid = Math.min(deposit + Math.max(input.paidNow, 0), total);
  const status: PaymentStatus = paid >= total ? "pagado" : paid > 0 ? "abono" : "pendiente";
  if (status !== "pagado" && !order.customer_id) {
    throw new Error("Para anotar una deuda, el pedido necesita el nombre del cliente.");
  }

  const sale = await createSale({
    customerId: order.customer_id,
    items,
    method: status === "pagado" ? "efectivo" : "fiado",
    status,
    paidAmount: paid,
    notes: `Pedido ${order.code}`,
    alreadyPaid: deposit,
  });

  if (deposit > 0) {
    const advance = payments.find(
      (p) => !p.sale_id && p.note === advanceNote(order.code) && p.customer_id === order.customer_id
    );
    if (advance) {
      await updateSilent<Payment>(TABLES.payments, advance.id, { sale_id: sale.id });
    } else {
      // Pedidos antiguos: el adelanto no estaba registrado como pago.
      await createSilent<Payment>(TABLES.payments, {
        customer_id: order.customer_id,
        sale_id: sale.id,
        amount: deposit,
        method: "efectivo",
        note: advanceNote(order.code),
        paid_at: order.created_at,
      });
    }
  }

  await updateSilent<Order>(TABLES.orders, order.id, {
    status: "entregado",
    payment_status: status,
  });
  emitChange();
  return sale;
}

/** Elimina un pedido, sus productos y su adelanto si aún no se entregó. */
export async function deleteOrder(orderId: string): Promise<void> {
  const [orders, orderItems, payments] = await Promise.all([
    list<Order>(TABLES.orders),
    list<OrderItem>(TABLES.order_items),
    list<Payment>(TABLES.payments),
  ]);
  const order = orders.find((o) => o.id === orderId);
  for (const it of orderItems.filter((x) => x.order_id === orderId)) {
    await remove(TABLES.order_items, it.id);
  }
  if (order) {
    for (const p of payments.filter(
      (p) => !p.sale_id && p.note === advanceNote(order.code) && p.customer_id === order.customer_id
    )) {
      await remove(TABLES.payments, p.id);
    }
  }
  await remove(TABLES.orders, orderId);
  emitChange();
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await update<Order>(TABLES.orders, orderId, { status });
}

// ---------------- Genéricos reexportados ----------------
export { list, create, update, remove };
