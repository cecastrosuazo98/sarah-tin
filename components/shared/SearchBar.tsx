"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Barra de búsqueda con ícono y botón para limpiar. */
export function SearchBar({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-soft" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Buscar…"}
        className="h-11 w-full rounded-xl border border-peach-dark bg-white/80 pl-9 pr-9 text-cocoa placeholder:text-cocoa-soft focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/30 [&::-webkit-search-cancel-button]:appearance-none"
        aria-label={placeholder ?? "Buscar"}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-cocoa-soft transition hover:bg-peach-light hover:text-cocoa"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
