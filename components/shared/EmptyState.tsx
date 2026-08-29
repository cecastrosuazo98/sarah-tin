import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado vacío cálido y explicativo.
 * Nunca dejamos una pantalla en blanco sin contexto.
 */
export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-peach-dark bg-white/50 px-6 py-14 text-center animate-fade-up",
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-peach-light text-3xl">
        {emoji ? (
          <span aria-hidden>{emoji}</span>
        ) : Icon ? (
          <Icon className="h-7 w-7 text-gold" />
        ) : null}
      </div>
      <h3 className="font-display text-lg font-bold text-cocoa">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-cocoa-light">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
