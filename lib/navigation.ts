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
};

/** Navegación completa (sidebar de escritorio). */
export const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Recetas", href: "/recetas", icon: BookOpen },
  { label: "Ingredientes", href: "/ingredientes", icon: Egg },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Gastos", href: "/gastos", icon: Receipt },
  { label: "Pedidos", href: "/pedidos", icon: CalendarDays },
  { label: "Reportes", href: "/reportes", icon: BarChart3 },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

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
