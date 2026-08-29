import { type LucideIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";

/**
 * Página de sección aún no implementada (fases 2 en adelante).
 * Muestra un encabezado con la identidad de la sección y un estado vacío
 * cálido que explica qué llegará ahí. Nada de pantallas en blanco.
 */
export function PlaceholderPage({
  title,
  description,
  icon,
  emoji,
  phase,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emoji: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-extrabold text-cocoa sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-cocoa-light">{description}</p>
      </header>

      <EmptyState
        icon={icon}
        emoji={emoji}
        title="Muy pronto disponible"
        description={`Esta sección llega en la ${phase}. Estamos construyendo Sarah & Tin paso a paso para que quede perfecta.`}
      />
    </div>
  );
}
