import { Sparkles } from "lucide-react";

/**
 * Aviso sutil de "modo demo": aparece mientras Supabase no está conectado,
 * dejando claro que los datos son de ejemplo (regla 48).
 */
export function DemoBanner() {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-gold/30 bg-[#FBF1DA]/70 px-4 py-3 text-sm text-cocoa">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
      <p>
        <span className="font-semibold">Modo demo.</span> Estás viendo datos de
        ejemplo. Conecta Supabase (ver <code className="rounded bg-white/70 px-1">README</code>)
        para empezar a guardar tu información real.
      </p>
    </div>
  );
}
