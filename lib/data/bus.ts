/** Bus de eventos simple para revalidar datos tras una mutación. */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange(): void {
  listeners.forEach((fn) => fn());
}
