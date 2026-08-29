/**
 * Tipos de fila (rows) de Sarah & Tin.
 *
 * Usan snake_case para coincidir 1:1 con las columnas de las tablas de Supabase
 * (ver `supabase/schema.sql`). Así el mismo objeto sirve tanto para el adaptador
 * localStorage como para el de Supabase, sin transformaciones.
 *
 * IDs: uuid (string). Fechas: ISO string. Montos: number (CLP entero).
 */

export type BaseUnit = "g" | "ml" | "unidad";
export type MeasureUnit = "g" | "kg" | "ml" | "l" | "unidad";

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "debito"
  | "credito"
  | "fiado"
  | "otro";

export type PaymentStatus = "pagado" | "pendiente" | "abono";

export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export type MovementType = "ingreso" | "egreso";

export interface BaseRow {
  id: string;
  owner_id: string;
  created_at: string;
}

export interface Ingredient extends BaseRow {
  name: string;
  category: string | null;
  unit: BaseUnit; // unidad base para stock y costo
  stock: number; // en unidad base
  min_stock: number; // en unidad base
  cost_per_unit: number; // $ por unidad base
  supplier: string | null;
  last_purchase_at: string | null;
}

export interface IngredientPurchase extends BaseRow {
  ingredient_id: string;
  quantity: number; // en unidad de compra
  unit: MeasureUnit;
  total_cost: number;
  supplier: string | null;
}

export interface Recipe extends BaseRow {
  name: string;
  yield_qty: number;
  yield_unit: string;
  notes: string | null;
}

export interface RecipeIngredient extends BaseRow {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: MeasureUnit;
}

export interface Product extends BaseRow {
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  sale_price: number;
  recipe_id: string | null;
  additional_cost: number; // costos adicionales por unidad (envase, etc.)
  stock: number;
  is_active: boolean;
}

export interface Customer extends BaseRow {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface Sale extends BaseRow {
  customer_id: string | null;
  sale_date: string;
  total: number;
  paid_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string | null;
}

export interface SaleItem extends BaseRow {
  sale_id: string;
  product_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Payment extends BaseRow {
  customer_id: string | null;
  sale_id: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  paid_at: string;
}

export interface CashRegister extends BaseRow {
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  is_open: boolean;
}

export interface CashMovement extends BaseRow {
  register_id: string | null;
  type: MovementType;
  category: string | null;
  description: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
}

export interface Expense extends BaseRow {
  category: string | null;
  description: string;
  amount: number;
  expense_date: string;
}

export interface Order extends BaseRow {
  code: string;
  customer_id: string | null;
  order_date: string;
  order_time: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  deposit: number;
  notes: string | null;
}

export interface OrderItem extends BaseRow {
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  details: string | null;
}

export interface BusinessSettings extends BaseRow {
  name: string;
  tagline: string;
  currency: string;
  target_margin: number;
  rounding: number;
  phone: string | null;
  address: string | null;
  product_categories: string[];
  expense_categories: string[];
}

/** Nombres de tabla/colección. Coinciden con Supabase. */
export const TABLES = {
  ingredients: "ingredients",
  ingredient_purchases: "ingredient_purchases",
  recipes: "recipes",
  recipe_ingredients: "recipe_ingredients",
  products: "products",
  customers: "customers",
  sales: "sales",
  sale_items: "sale_items",
  payments: "payments",
  cash_registers: "cash_registers",
  cash_movements: "cash_movements",
  expenses: "expenses",
  orders: "orders",
  order_items: "order_items",
  business_settings: "business_settings",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
