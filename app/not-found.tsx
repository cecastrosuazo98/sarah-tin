import Link from "next/link";
import { Brandmark } from "@/components/brand/Brandmark";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <Brandmark size={64} />
      <h1 className="mt-5 font-display text-2xl font-extrabold text-cocoa">
        No encontramos esta página <span aria-hidden>🍰</span>
      </h1>
      <p className="mt-2 max-w-xs text-cocoa-light">
        Puede que el enlace haya cambiado. Volvamos al inicio.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-2xl bg-sarah px-6 font-semibold text-white shadow-soft transition hover:bg-sarah-dark"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
