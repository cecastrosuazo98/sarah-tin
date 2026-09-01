/**
 * Datos de ejemplo para el modo local (localStorage).
 * Se cargan solo la primera vez. Camila puede borrarlos desde Configuración.
 */
import { TABLES } from "./types";

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
function ymd(offsetDays: number): string {
  return iso(offsetDays).slice(0, 10);
}
const base = { owner_id: "local", created_at: new Date().toISOString() };

// --- Ingredientes ---
const ING = {
  harina: "seed-ing-harina",
  azucar: "seed-ing-azucar",
  huevos: "seed-ing-huevos",
  leche: "seed-ing-leche",
  aceite: "seed-ing-aceite",
  mantequilla: "seed-ing-mantequilla",
  chocolate: "seed-ing-chocolate",
};

const ingredients = [
  { id: ING.harina, ...base, name: "Harina", category: "Secos", unit: "g", stock: 8500, min_stock: 2000, cost_per_unit: 1.2, supplier: "Distribuidora Central", last_purchase_at: iso(-6) },
  { id: ING.azucar, ...base, name: "Azúcar", category: "Secos", unit: "g", stock: 5000, min_stock: 1500, cost_per_unit: 1.0, supplier: "Distribuidora Central", last_purchase_at: iso(-6) },
  { id: ING.huevos, ...base, name: "Huevos", category: "Frescos", unit: "unidad", stock: 24, min_stock: 6, cost_per_unit: 250, supplier: "Granja Doña Rosa", last_purchase_at: iso(-2) },
  { id: ING.leche, ...base, name: "Leche", category: "Frescos", unit: "ml", stock: 2000, min_stock: 500, cost_per_unit: 1.1, supplier: null, last_purchase_at: iso(-3) },
  { id: ING.aceite, ...base, name: "Aceite", category: "Líquidos", unit: "ml", stock: 900, min_stock: 300, cost_per_unit: 3.2, supplier: null, last_purchase_at: iso(-10) },
  { id: ING.mantequilla, ...base, name: "Mantequilla", category: "Frescos", unit: "g", stock: 500, min_stock: 200, cost_per_unit: 9.0, supplier: null, last_purchase_at: iso(-4) },
  { id: ING.chocolate, ...base, name: "Cobertura de chocolate", category: "Repostería", unit: "g", stock: 300, min_stock: 500, cost_per_unit: 12.0, supplier: null, last_purchase_at: iso(-8) },
];

// --- Recetas ---
const REC_QUEQUE = "seed-rec-queque";
const recipes = [
  { id: REC_QUEQUE, ...base, name: "Queque tradicional", yield_qty: 10, yield_unit: "unidad", notes: "Rinde 10 porciones." },
];
const recipe_ingredients = [
  { id: "seed-ri-1", ...base, recipe_id: REC_QUEQUE, ingredient_id: ING.harina, quantity: 500, unit: "g" },
  { id: "seed-ri-2", ...base, recipe_id: REC_QUEQUE, ingredient_id: ING.azucar, quantity: 300, unit: "g" },
  { id: "seed-ri-3", ...base, recipe_id: REC_QUEQUE, ingredient_id: ING.huevos, quantity: 4, unit: "unidad" },
  { id: "seed-ri-4", ...base, recipe_id: REC_QUEQUE, ingredient_id: ING.aceite, quantity: 100, unit: "ml" },
  { id: "seed-ri-5", ...base, recipe_id: REC_QUEQUE, ingredient_id: ING.leche, quantity: 200, unit: "ml" },
];

// --- Productos ---
const PRD = {
  queque: "seed-prd-queque",
  torta: "seed-prd-torta",
  cupcakes: "seed-prd-cupcakes",
  galletas: "seed-prd-galletas",
};
const products = [
  { id: PRD.queque, ...base, name: "Queque tradicional", description: "Queque casero, esponjoso.", category: "Queques", image_url: null, sale_price: 1000, recipe_id: REC_QUEQUE, additional_cost: 50, stock: 8, is_active: true },
  { id: PRD.torta, ...base, name: "Torta de chocolate", description: "Torta de chocolate para toda ocasión.", category: "Tortas", image_url: null, sale_price: 25000, recipe_id: null, additional_cost: 14500, stock: 0, is_active: true },
  { id: PRD.cupcakes, ...base, name: "Cupcakes decorados", description: "Cupcakes con crema y decoración.", category: "Cupcakes", image_url: null, sale_price: 1500, recipe_id: null, additional_cost: 600, stock: 20, is_active: true },
  { id: PRD.galletas, ...base, name: "Galletas decoradas", description: "Galletas mantequilla decoradas.", category: "Galletas", image_url: null, sale_price: 800, recipe_id: null, additional_cost: 300, stock: 40, is_active: true },
];

// --- Clientes ---
const CUS = { juan: "seed-cus-juan", maria: "seed-cus-maria", fer: "seed-cus-fer" };
const customers = [
  { id: CUS.juan, ...base, name: "Juan Pérez", phone: "56912345678", email: null, address: null, notes: "Cliente frecuente." },
  { id: CUS.maria, ...base, name: "María González", phone: "56987654321", email: null, address: "Los Aromos 123", notes: null },
  { id: CUS.fer, ...base, name: "Fernanda López", phone: "56955501122", email: null, address: null, notes: null },
];

// --- Ventas (últimos 7 días) ---
type SaleSeed = { id: string; customer_id: string | null; sale_date: string; total: number; paid_amount: number; method: string; status: string; notes: string | null };
type ItemSeed = { id: string; sale_id: string; product_id: string; name_snapshot: string; quantity: number; unit_price: number; line_total: number };

const salesRaw: { day: number; cid: string | null; items: [string, string, number, number][]; method: string; status: string }[] = [
  { day: -6, cid: null, items: [[PRD.queque, "Queque tradicional", 12, 1000], [PRD.galletas, "Galletas decoradas", 20, 800]], method: "efectivo", status: "pagado" },
  { day: -5, cid: CUS.maria, items: [[PRD.cupcakes, "Cupcakes decorados", 12, 1500], [PRD.queque, "Queque tradicional", 6, 1000]], method: "transferencia", status: "pagado" },
  { day: -4, cid: null, items: [[PRD.galletas, "Galletas decoradas", 24, 800]], method: "efectivo", status: "pagado" },
  { day: -3, cid: CUS.fer, items: [[PRD.torta, "Torta de chocolate", 2, 25000]], method: "transferencia", status: "pagado" },
  { day: -2, cid: null, items: [[PRD.cupcakes, "Cupcakes decorados", 18, 1500], [PRD.queque, "Queque tradicional", 9, 1000]], method: "efectivo", status: "pagado" },
  { day: -1, cid: null, items: [[PRD.queque, "Queque tradicional", 30, 1000], [PRD.galletas, "Galletas decoradas", 22, 800]], method: "debito", status: "pagado" },
  { day: 0, cid: null, items: [[PRD.cupcakes, "Cupcakes decorados", 20, 1500], [PRD.queque, "Queque tradicional", 15, 1000]], method: "efectivo", status: "pagado" },
  // Deudas
  { day: -1, cid: CUS.juan, items: [[PRD.queque, "Queque tradicional", 2, 1000], [PRD.cupcakes, "Cupcakes decorados", 1, 1500], [PRD.galletas, "Galletas decoradas", 1, 1000]], method: "fiado", status: "pendiente" },
  { day: -2, cid: CUS.maria, items: [[PRD.cupcakes, "Cupcakes decorados", 8, 1500]], method: "fiado", status: "pendiente" },
];

const sales: SaleSeed[] = [];
const sale_items: ItemSeed[] = [];
salesRaw.forEach((s, i) => {
  const id = `seed-sale-${i}`;
  const total = s.items.reduce((sum, it) => sum + it[2] * it[3], 0);
  sales.push({
    id,
    customer_id: s.cid,
    sale_date: iso(s.day),
    total,
    paid_amount: s.status === "pagado" ? total : 0,
    method: s.method,
    status: s.status,
    notes: null,
  });
  s.items.forEach((it, j) => {
    sale_items.push({
      id: `seed-item-${i}-${j}`,
      sale_id: id,
      product_id: it[0],
      name_snapshot: it[1],
      quantity: it[2],
      unit_price: it[3],
      line_total: it[2] * it[3],
    });
  });
});

// --- Gastos ---
const expenses = [
  { id: "seed-exp-1", ...base, category: "Ingredientes", description: "Compra de harina y azúcar", amount: 11000, expense_date: ymd(-6) },
  { id: "seed-exp-2", ...base, category: "Envases", description: "Cajas y bolsas", amount: 8500, expense_date: ymd(-5) },
  { id: "seed-exp-3", ...base, category: "Delivery", description: "Reparto pedidos", amount: 6000, expense_date: ymd(-3) },
  { id: "seed-exp-4", ...base, category: "Servicios", description: "Gas", amount: 9000, expense_date: ymd(-2) },
];

// --- Pedidos ---
const ORD = { a: "seed-ord-a", b: "seed-ord-b" };
const orders = [
  { id: ORD.a, ...base, code: "#1024", customer_id: CUS.fer, order_date: ymd(2), order_time: "16:00", status: "confirmado", payment_status: "abono", total: 25000, deposit: 10000, notes: "20 personas, decoración frutillas." },
  { id: ORD.b, ...base, code: "#1025", customer_id: CUS.maria, order_date: ymd(3), order_time: "11:30", status: "pendiente", payment_status: "pendiente", total: 18000, deposit: 0, notes: "12 cupcakes decorados." },
];
const order_items = [
  { id: "seed-oi-1", ...base, order_id: ORD.a, product_id: PRD.torta, name_snapshot: "Torta de chocolate", quantity: 1, unit_price: 25000, line_total: 25000, details: "20 personas · frutillas" },
  { id: "seed-oi-2", ...base, order_id: ORD.b, product_id: PRD.cupcakes, name_snapshot: "Cupcakes decorados", quantity: 12, unit_price: 1500, line_total: 18000, details: "Tonos pastel" },
];

export function buildSeed(): Record<string, Record<string, unknown>[]> {
  return {
    [TABLES.ingredients]: ingredients,
    [TABLES.recipes]: recipes,
    [TABLES.recipe_ingredients]: recipe_ingredients,
    [TABLES.products]: products,
    [TABLES.customers]: customers,
    [TABLES.sales]: sales.map((s) => ({ ...base, ...s })),
    [TABLES.sale_items]: sale_items.map((s) => ({ ...base, ...s })),
    [TABLES.expenses]: expenses,
    [TABLES.orders]: orders,
    [TABLES.order_items]: order_items,
  };
}
