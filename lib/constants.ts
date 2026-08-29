/** Constantes de configuración de Sarah & Tin. */

export const BRAND = {
  name: "Sarah & Tin",
  tagline: "Pastelería artesanal",
  ownerFirstName: "Camila",
} as const;

/** Nombre de la usuaria principal (editable en Configuración a futuro). */
export const DEFAULT_USER_NAME = "Camila";

/** Margen objetivo por defecto (fracción). Editable en Configuración. */
export const DEFAULT_TARGET_MARGIN = 0.6;

/** Categorías de producto por defecto (modificables). */
export const DEFAULT_PRODUCT_CATEGORIES = [
  "Queques",
  "Tortas",
  "Cupcakes",
  "Galletas",
  "Postres",
  "Otros",
] as const;

/** Categorías de gasto por defecto. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Ingredientes",
  "Envases",
  "Transporte",
  "Servicios",
  "Equipamiento",
  "Publicidad",
  "Delivery",
  "Otros",
] as const;

/** Métodos de pago disponibles. */
export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "fiado", label: "Fiado / pendiente" },
  { value: "otro", label: "Otro" },
] as const;

/** Estados de pedido. */
export const ORDER_STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "en_preparacion", label: "En preparación" },
  { value: "listo", label: "Listo" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
] as const;
