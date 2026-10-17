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
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Solo administración (César). La base de datos aplica el permiso real. */
  admin?: boolean;
};

/** Navegación completa (sidebar de escritorio). */
export const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Pedidos", href: "/pedidos", icon: CalendarDays },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Gastos", href: "/gastos", icon: Receipt },
  { label: "Resumen del día", href: "/resumen", icon: ClipboardList },
  { label: "Productos", href: "/productos", icon: Package, admin: true },
  { label: "Recetas", href: "/recetas", icon: BookOpen, admin: true },
  { label: "Ingredientes", href: "/ingredientes", icon: Egg, admin: true },
  { label: "Panel", href: "/panel", icon: LayoutDashboard, admin: true },
  { label: "Reportes", href: "/reportes", icon: BarChart3, admin: true },
  { label: "Configuración", href: "/configuracion", icon: Settings, admin: true },
];

/** Rutas que solo ve administración. */
export const ADMIN_PATHS = NAV_ITEMS.filter((i) => i.admin).map((i) => i.href);

export function navFor(role: "admin" | "operador"): NavItem[] {
  return role === "admin" ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.admin);
}

/** Ítems principales de la navegación inferior (móvil). El centro es el botón "+". */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { label: "Pedidos", href: "/pedidos", icon: CalendarDays },
];

/** Enlaces del menú "Más" en móvil. */
export const MORE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !["/", "/ventas", "/pedidos"].includes(item.href)
);

export function moreNavFor(role: "admin" | "operador"): NavItem[] {
  return navFor(role).filter((item) => !["/", "/ventas", "/pedidos"].includes(item.href));
}
