import { Brandmark } from "@/components/brand/Brandmark";
import { LoginForm } from "@/components/auth/LoginForm";
import { BRAND } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm animate-scale-in">
      <div className="mb-6 flex flex-col items-center text-center">
        <Brandmark size={124} className="shadow-lift ring-2 ring-gold/30" />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
          <span className="text-sarah-dark">Sarah</span>
          <span className="text-gold"> & </span>
          <span className="text-tin-dark">Tin</span>
        </h1>
        <p className="text-sm font-medium text-cocoa-light">{BRAND.tagline}</p>
      </div>

      <div className="rounded-3xl border border-peach/60 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
        <h2 className="mb-1 font-display text-xl font-bold text-cocoa">
          ¡Hola de nuevo! <span aria-hidden>💕</span>
        </h2>
        <p className="mb-5 text-sm text-cocoa-light">
          Ingresa para administrar tu pastelería.
        </p>
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-xs text-cocoa-soft">
        Hecho con cariño para {BRAND.name}
      </p>
    </div>
  );
}
