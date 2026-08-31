"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";

export type SearchOption = { value: string; label: string; hint?: string };

/**
 * Selector con búsqueda: se ve como un campo; al abrirlo puedes escribir para
 * filtrar (sin tildes, por palabras) y elegir. El menú se dibuja en un portal
 * para que no se corte dentro de los modales.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Escribe para buscar…",
  emptyText = "Sin resultados",
  className,
  id,
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) => matchesSearch(query, o.label, o.hint))
    : options;

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 280 && r.top > spaceBelow;
    setPos({ left: r.left, top: up ? r.top : r.bottom, width: r.width, up });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onScrollResize = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [query, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (opt: SearchOption) => {
    onChange(opt.value);
    close();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-peach-dark bg-white/80 px-3 text-left text-cocoa transition focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/30"
      >
        <span className={cn("truncate", !selected && "text-cocoa-soft")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-cocoa-soft" />
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              ...(pos.up
                ? { bottom: window.innerHeight - pos.top + 4 }
                : { top: pos.top + 4 }),
            }}
            className="z-[100] overflow-hidden rounded-xl border border-peach-dark bg-white shadow-lift"
          >
            <div className="relative border-b border-peach/60 p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-soft" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered[active]) choose(filtered[active]);
                  } else if (e.key === "Escape") {
                    close();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg bg-peach-light/40 pl-8 pr-2 text-sm text-cocoa placeholder:text-cocoa-soft focus:outline-none"
              />
            </div>
            <ul className="soft-scroll max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-center text-sm text-cocoa-soft">{emptyText}</li>
              )}
              {filtered.map((o, i) => (
                <li key={o.value || "__empty"}>
                  <button
                    type="button"
                    onClick={() => choose(o)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      i === active ? "bg-peach-light" : "hover:bg-peach-light/60",
                      o.value === value && "text-sarah-dark"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-cocoa">{o.label}</span>
                      {o.hint && (
                        <span className="block truncate text-xs text-cocoa-soft">{o.hint}</span>
                      )}
                    </span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-sarah-dark" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
