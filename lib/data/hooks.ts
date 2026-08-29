"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "./bus";
import { list } from "./client";

/**
 * Ejecuta una consulta asíncrona y la vuelve a correr cuando hay cambios en el
 * store (tras cualquier mutación). Sirve igual para localStorage y Supabase.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcherCb = useCallback(fetcher, deps);

  const load = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true);
    fetcherCb()
      .then((d) => {
        if (id === reqId.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (id === reqId.current) setError(e?.message ?? "Ocurrió un error");
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [fetcherCb]);

  useEffect(() => {
    load();
    const unsub = subscribe(load);
    return () => {
      unsub();
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}

/** Atajo para leer una tabla completa de forma reactiva. */
export function useTable<T>(table: string): {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const q = useQuery<T[]>(() => list<T>(table), [table]);
  return { data: q.data ?? [], loading: q.loading, error: q.error, refetch: q.refetch };
}
