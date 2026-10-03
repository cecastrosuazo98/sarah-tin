"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { registerPayment } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Customer } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";

/**
 * Registrar un pago: solo se pregunta "¿Cuánto pagó?".
 * El pago se descuenta solo de lo que debe (de esa venta, si se indica una).
 */
export function PaymentForm({
  open,
  onClose,
  customer,
  debt,
  saleId,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  debt: number;
  /** Si se paga una venta puntual en vez de la deuda completa. */
  saleId?: string;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ paid: number; left: number } | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(0);
      setDone(null);
    }
  }, [open]);

  const name = customer?.name.split(" ")[0] ?? "";
  const tooMuch = amount > debt;
  const left = Math.max(debt - amount, 0);

  const save = async () => {
    if (!customer) return;
    if (amount <= 0) {
      toast("¿Cuánto pagó?", "error");
      return;
    }
    if (tooMuch) return;
    setSaving(true);
    try {
      await registerPayment({ customerId: customer.id, amount, saleId });
      setDone({ paid: amount, left });
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo guardar el pago."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? "¡Listo!" : "Registrar pago"}
      footer={
        done ? (
          <Button size="lg" className="w-full" onClick={onClose}>Listo</Button>
        ) : (
          <Button size="lg" className="w-full text-lg" onClick={save} disabled={saving || amount <= 0 || tooMuch}>
            {saving ? "Guardando…" : "Guardar pago"}
          </Button>
        )
      }
    >
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-5xl" aria-hidden>✅</p>
          <p className="font-display text-2xl font-extrabold text-cocoa">
            Pago de {formatMoney(done.paid)} guardado
          </p>
          {done.left > 0 ? (
            <div className="rounded-2xl bg-[#FBF1DA] px-4 py-4">
              <p className="text-sm font-semibold text-cocoa">Ahora {name} debe</p>
              <p className="font-display text-3xl font-extrabold text-warning">{formatMoney(done.left)}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#EAF4EB] px-4 py-4 font-display text-2xl font-extrabold text-success">
              🟢 {name} quedó al día
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#FBEDED] px-4 py-3 text-center">
            <p className="text-sm font-semibold text-cocoa">{customer?.name} debe</p>
            <p className="font-display text-3xl font-extrabold text-danger">{formatMoney(debt)}</p>
          </div>

          <div>
            <p className="mb-1 font-display text-xl font-extrabold text-cocoa">¿Cuánto pagó?</p>
            <MoneyInput value={amount} onChange={setAmount} className="h-14 text-2xl" />
            {debt > 0 && (
              <button
                type="button"
                onClick={() => setAmount(debt)}
                className="mt-2 rounded-full bg-peach-light px-4 py-2 text-sm font-semibold text-cocoa"
              >
                Pagó todo ({formatMoney(debt)})
              </button>
            )}
          </div>

          {amount > 0 &&
            (tooMuch ? (
              <p className="rounded-2xl bg-[#FBEDED] px-4 py-3 text-center text-sm font-semibold text-danger">
                {name} solo debe {formatMoney(debt)}.
              </p>
            ) : left > 0 ? (
              <div className="rounded-2xl bg-[#FBF1DA] px-4 py-3 text-center">
                <p className="text-sm font-semibold text-cocoa">Después de este pago debe</p>
                <p className="font-display text-2xl font-extrabold text-warning">{formatMoney(left)}</p>
              </div>
            ) : (
              <p className="rounded-2xl bg-[#EAF4EB] px-4 py-3 text-center font-display text-xl font-extrabold text-success">
                🟢 Queda al día
              </p>
            ))}
        </div>
      )}
    </Modal>
  );
}
