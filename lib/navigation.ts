import {
  Home,
  ShoppingCart,
  Package,
  BookOpen,
  Egg,
  Users,
  Receipt,
  CalendarDays,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Explicación corta, en palabras simples. */
  hint: string;
};

/** Lo de todos los días: siempre visible. */
export const MAIN_NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/", icon: Home, hint: "Lo que pasó hoy" },
  { label: "Clientes", href: "/clientes", icon: Users, hint: "Personas y deudas" },
  { label: "Productos", href: "/productos", icon: Package, hint: "Lo que vendes" },
  { label: "Pedidos", href: "/pedidos", icon: CalendarDays, hint: "Pedidos por entregar" },
];

/** Lo que se usa de vez en cuando: queda dentro de "Más". */
export const MORE_NAV_ITEMS: NavItem[] = [
  { label: "Todas las ventas", href: "/ventas", icon: ShoppingCart, hint: "Buscar ventas de otros días" },
  { label: "Gastos", href: "/gastos", icon: Receipt, hint: "Lo que gastaste" },
  { label: "Reportes", href: "/reportes", icon: BarChart3, hint: "Ganancia estimada y lo más vendido" },
  { label: "Recetas", href: "/recetas", icon: BookOpen, hint: "Cuánto te cuesta hacer cada cosa" },
  { label: "Ingredientes", href: "/ingredientes", icon: Egg, hint: "Lo que compras para cocinar" },
  { label: "Configuración", href: "/configuracion", icon: Settings, hint: "Datos del negocio" },
];

/** Navegación completa (sidebar de escritorio). */
export const NAV_ITEMS: NavItem[] = [...MAIN_NAV_ITEMS, ...MORE_NAV_ITEMS];
