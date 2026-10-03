"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Plus } from "lucide-react";
import { SaleForm } from "./SaleForm";

/**
 * "Registrar venta" disponible desde cualquier pantalla: un solo formulario
 * para toda la app y un botón flotante siempre a mano.
 */
const SaleFlowContext = createContext<{
  openSale: () => void;
  /** Día de la última venta guardada (Inicio salta a ese día). */
  lastSaleDate: Date | null;
} | null>(null);

export function useSaleFlow() {
  const ctx = useContext(SaleFlowContext);
  if (!ctx) throw new Error("useSaleFlow debe usarse dentro de SaleFlowProvider");
  return ctx;
}

export function SaleFlowProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [lastSaleDate, setLastSaleDate] = useState<Date | null>(null);
  const openSale = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <SaleFlowContext.Provider value={{ openSale, lastSaleDate }}>
      {children}
      <SaleForm open={open} onClose={close} onSaved={setLastSaleDate} />
    </SaleFlowContext.Provider>
  );
}

/** Botón flotante: la acción más importante de la app. */
export function RegisterSaleButton() {
  const { openSale } = useSaleFlow();
  return (
    <button
      type="button"
      onClick={openSale}
      className="fixed bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex h-14 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-sarah px-7 font-display text-lg font-extrabold text-white shadow-lift ring-4 ring-cream-50 transition active:scale-95 hover:bg-sarah-dark lg:bottom-8 lg:left-auto lg:right-8 lg:translate-x-0"
    >
      <Plus className="h-6 w-6" strokeWidth={3} />
      Registrar venta
    </button>
  );
}
