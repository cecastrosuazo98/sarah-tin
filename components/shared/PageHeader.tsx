import { type ReactNode } from "react";

/** Encabezado estándar de sección: título, subtítulo y acción opcional. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 animate-fade-up">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold text-cocoa sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-cocoa-light">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
