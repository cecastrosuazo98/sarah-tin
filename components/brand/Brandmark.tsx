"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Emblema circular de Sarah & Tin.
 *
 * Usa el logo oficial (`public/logo.png`), optimizado con next/image.
 * - `crop` (por defecto): hace zoom sobre los dos niños del logo para que sean
 *   el protagonista del emblema, incluso a tamaños pequeños.
 * - `crop={false}`: muestra el logo completo (útil en tamaños grandes, como el
 *   login, donde se aprecia todo el detalle).
 *
 * Si el archivo no existe, cae a un emblema dibujado (cupcake) con los colores
 * de la marca, para no mostrar nunca un ícono de "imagen rota".
 */
export function Brandmark({
  size = 44,
  crop = true,
  className,
}: {
  size?: number;
  crop?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-peach ring-1 ring-gold/40",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Fallback dibujado (solo visible si el logo no carga). */}
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r="50" fill="#F2908E" />
        <path d="M34 58 h32 l-5 24 a4 4 0 0 1 -4 3 h-14 a4 4 0 0 1 -4 -3 z" fill="#F0D8C4" />
        <path d="M32 58 q-6 -10 4 -14 q-2 -12 12 -12 q14 -1 14 11 q10 2 6 15 z" fill="#EDA6C1" />
        <circle cx="50" cy="32" r="5" fill="#C13B6A" />
      </svg>

      {/* Logo oficial. Con zoom a los dos niños cuando crop está activo. */}
      {!failed && (
        <Image
          src="/logo1.png"
          alt="Sarah & Tin"
          fill
          sizes={`${Math.round(size * 2)}px`}
          priority={size >= 64}
          onError={() => setFailed(true)}
          className="object-cover"
          style={
            crop
              ? { transform: "scale(2.19)", transformOrigin: "50% 26%" }
              : undefined
          }
        />
      )}
    </span>
  );
}
