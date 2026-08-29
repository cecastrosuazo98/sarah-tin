"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { signIn, type AuthState } from "@/lib/actions/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sarah font-semibold text-white shadow-soft transition hover:bg-sarah-dark disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          Entrar <ArrowRight className="h-5 w-5" />
        </>
      )}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(signIn, null);
  const configured = isSupabaseConfigured();

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold text-cocoa">
          Correo
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cocoa-soft" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="camila@correo.com"
            className="h-12 w-full rounded-2xl border border-peach-dark bg-white/70 pl-11 pr-4 text-cocoa placeholder:text-cocoa-soft focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/40"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-cocoa">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cocoa-soft" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 w-full rounded-2xl border border-peach-dark bg-white/70 pl-11 pr-4 text-cocoa placeholder:text-cocoa-soft focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/40"
          />
        </div>
      </div>

      {state?.error && (
        <p className="rounded-xl bg-[#FBEDED] px-4 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      <SubmitButton />

      {!configured && (
        <Link
          href="/"
          className="mt-1 block rounded-2xl border border-tin/40 bg-tin-50/60 px-4 py-2.5 text-center text-sm font-semibold text-tin-dark transition hover:bg-tin-50"
        >
          Explorar en modo demo →
        </Link>
      )}
    </form>
  );
}
