"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal responsivo: hoja inferior en móvil, tarjeta centrada en escritorio.
 * Se cierra con Escape o tocando el fondo.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-cocoa/40 backdrop-blur-sm animate-fade-up"
      />
      <div
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-peach bg-cream-50 shadow-lift animate-fade-up sm:rounded-3xl",
          size === "md" ? "sm:max-w-md" : "sm:max-w-2xl"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-peach/60 p-5">
          <div className="mx-auto -mt-2 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-peach-dark sm:hidden" />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-cocoa">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-cocoa-light">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-cocoa-light transition hover:bg-peach-light"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="soft-scroll flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex gap-3 border-t border-peach/60 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
