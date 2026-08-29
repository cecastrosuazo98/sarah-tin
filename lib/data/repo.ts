/**
 * Operaciones de negocio de Sarah & Tin.
 * Encapsulan la lógica que toca varias tablas (venta + ítems + caja,
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
  CashRegister,
  CashMovement,
  Expense,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentStatus,
  MeasureUnit,
  OrderStatus,
} from "./types";
import { toBase } from "@/lib/domain/units";

// ---------------- Caja ----------------

export async function getOpenRegister(): Promise<CashRegister | null> {
  const regs = await list<CashRegister>(TABLES.cash_registers);
  return regs.find((r) => r.is_open) ?? null;
}

async function addCashMovementFor(
  register: CashRegister | null,
  mov: {
    type: "ingreso" | "egreso";
    amount: number;
    method: PaymentMethod;
    category?: string;
    description?: string;
    reference?: string;
  }
): Promise<void> {
  if (!register) return;
  await createSilent<CashMovement>(TABLES.cash_movements, {
    register_id: register.id,
    type: mov.type,
    amount: mov.amount,
    method: mov.method,
    category: mov.category ?? null,
    description: mov.description ?? null,
    reference: mov.reference ?? null,
  });
}

export async function openCashRegister(opening: number): Promise<void> {
  const current = await getOpenRegister();
  if (current) throw new Error("Ya tienes una caja abierta.");
  await create<CashRegister>(TABLES.cash_registers, {
    opened_at: new Date().toISOString(),
    closed_at: null,
    opening_balance: opening,
    closing_balance: null,
    is_open: true,
  });
}

export async function closeCashRegister(
  registerId: string,
  closing: number
): Promise<void> {
  await update<CashRegister>(TABLES.cash_registers, registerId, {
    is_open: false,
    closed_at: new Date().toISOString(),
    closing_balance: closing,
  });
}

export async function addCashMovement(input: {
  type: "ingreso" | "egreso";
  amount: number;
  method: PaymentMethod;
  category?: string;
  description?: string;
}): Promise<void> {
  const reg = await getOpenRegister();
  if (!reg) throw new Error("Abre la caja primero para registrar movimientos.");
  await addCashMovementFor(reg, input);
  emitChange();
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

  // Ingreso a caja por el monto pagado en efectivo.
  if (paid > 0 && input.method === "efectivo") {
    const reg = await getOpenRegister();
    await addCashMovementFor(reg, {
      type: "ingreso",
      amount: paid,
      method: "efectivo",
      category: "Venta",
      description: "Venta registrada",
    });
  }

  emitChange();
  return sale;
}

// ---------------- Pagos de deuda ----------------

export async function registerPayment(input: {
  customerId: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
  saleId?: string;
}): Promise<void> {
  await createSilent<Payment>(TABLES.payments, {
    customer_id: input.customerId,
    sale_id: input.saleId ?? null,
    amount: input.amount,
    method: input.method,
    note: input.note ?? null,
    paid_at: new Date().toISOString(),
  });

  // Aplica el pago a las ventas pendientes (más antiguas primero).
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
    await updateSilent<Sale>(TABLES.sales, sale.id, {
      paid_amount: newPaid,
      status: newPaid >= sale.total ? "pagado" : "abono",
    });
    remaining -= applied;
  }

  if (input.method === "efectivo") {
    const reg = await getOpenRegister();
    await addCashMovementFor(reg, {
      type: "ingreso",
      amount: input.amount,
      method: "efectivo",
      category: "Pago de deuda",
      description: "Abono de cliente",
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
  payFromCash?: boolean;
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
      expense_date: new Date().toISOString().slice(0, 10),
    });
  }

  if (input.payFromCash) {
    const reg = await getOpenRegister();
    await addCashMovementFor(reg, {
      type: "egreso",
      amount: input.totalCost,
      method: "efectivo",
      category: "Ingredientes",
      description: `Compra: ${ing.name}`,
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
  payFromCash?: boolean;
}): Promise<void> {
  await createSilent<Expense>(TABLES.expenses, {
    category: input.category,
    description: input.description,
    amount: input.amount,
    expense_date: input.date ?? new Date().toISOString().slice(0, 10),
  });
  if (input.payFromCash) {
    const reg = await getOpenRegister();
    await addCashMovementFor(reg, {
      type: "egreso",
      amount: input.amount,
      method: "efectivo",
      category: input.category,
      description: input.description,
    });
  }
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

export async function createOrder(input: NewOrderInput): Promise<Order> {
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
    await createSilent<OrderItem>(TABLES.order_items, {
      order_id: order.id,
      product_id: null,
      name_snapshot: it.name,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      line_total: it.quantity * it.unitPrice,
      details: it.details ?? null,
    });
  }

  emitChange();
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await update<Order>(TABLES.orders, orderId, { status });
}

// ---------------- Genéricos reexportados ----------------
export { list, create, update, remove };
