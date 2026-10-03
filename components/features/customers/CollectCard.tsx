"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { PaymentForm } from "./PaymentForm";
import { reminderMessage, whatsappLink } from "./whatsapp";
import { debtAge, type Debtor } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";

const VISIBLE = 3;

/** ¿A quién cobrar? Las deudas más antiguas primero, con WhatsApp y "Me pagó". */
export function CollectCard({ debtors }: { debtors: Debtor[] }) {
  // Se guarda al abrir: si paga todo, sale de la lista pero la confirmación sigue visible.
  const [paying, setPaying] = useState<Debtor | null>(null);

  const payment = (
    <PaymentForm
      open={!!paying}
      onClose={() => setPaying(null)}
      customer={paying?.customer ?? null}
      debt={paying?.debt ?? 0}
    />
  );
  const total = debtors.reduce((s, d) => s + d.debt, 0);

  // El formulario de pago queda siempre en el mismo lugar del árbol para que no
  // se reinicie cuando la lista cambia (ej: alguien termina de pagar).
  return (
    <>
      {debtors.length > 0 && (
        <section className="rounded-3xl border border-peach/60 bg-white/85 p-4 shadow-card animate-fade-up">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-cocoa">💰 ¿A quién cobrar?</h2>
            <span className="text-sm text-cocoa-light">
              Te deben <b className="text-danger">{formatMoney(total)}</b>
            </span>
          </div>

          <ul className="mt-2 divide-y divide-peach/50">
            {debtors.slice(0, VISIBLE).map((d) => (
              <li key={d.customer.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cocoa">{d.customer.name}</p>
                  <p className={`text-xs ${d.days >= 14 ? "font-semibold text-danger" : "text-cocoa-light"}`}>
                    Debe {formatMoney(d.debt)} · {debtAge(d.days)}
                  </p>
                </div>
                {d.customer.phone && (
                  <a
                    href={whatsappLink(d.customer.phone, reminderMessage(d.customer.name, d.debt))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EB] text-success transition hover:brightness-95"
                    aria-label={`Recordarle a ${d.customer.name} por WhatsApp`}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPaying(d)}
                  className="h-10 shrink-0 rounded-xl bg-sarah px-3 text-sm font-semibold text-white transition hover:bg-sarah-dark"
                >
                  Me pagó
                </button>
              </li>
            ))}
          </ul>

          {debtors.length > VISIBLE && (
            <Link href="/clientes" className="mt-1 flex items-center justify-center py-1 text-sm font-semibold text-sarah-dark">
              Ver los {debtors.length} que te deben <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}
      {payment}
    </>
  );
}
