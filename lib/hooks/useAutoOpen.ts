"use client";

import { useEffect } from "react";

/**
 * Abre un formulario automáticamente cuando la URL trae ?nuevo=1
 * (usado por el botón "+" de acciones rápidas para saltar directo al formulario).
 */
export function useAutoOpen(open: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("nuevo")) {
      open();
      // Limpia el parámetro para que no reabra al navegar atrás.
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
