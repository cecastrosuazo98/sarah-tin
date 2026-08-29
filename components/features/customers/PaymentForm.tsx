"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { registerPayment } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Customer, PaymentMethod } from "@/lib/data/types";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export function PaymentForm({
  open,
  onClose,
  customer,
  debt,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  debt: number;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(debt);
      setMethod("efectivo");
    }
  }, [open, debt]);

  const save = async () => {
    if (!customer) return;
    if (amount <= 0) {
      toast("Ingresa el monto del pago.", "error");
      return;
    }
    setSaving(true);
    try {
      await registerPayment({ customerId: customer.id, amount, method });
      toast("Pago registrado 💕");
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo registrar el pago."), "error");
    } finally {
      setSaving(false);
    }
  };

  const saldo = Math.max(debt - amount, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar pago · ${customer?.name ?? ""}`}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Registrar pago</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-[#FBEDED] px-4 py-3">
          <span className="text-sm font-medium text-cocoa">Deuda actual</span>
          <span className="font-display text-lg font-extrabold text-danger">{formatMoney(debt)}</span>
        </div>
        <Field label="Monto del pago">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {debt > 0 && (
            <button onClick={() => setAmount(debt)} className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">
              Pago total ({formatMoney(debt)})
            </button>
          )}
          <button onClick={() => setAmount(Math.round(debt / 2))} className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">
            Mitad
          </button>
        </div>
        <Field label="Método">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.filter((m) => m.value !== "fiado").map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center justify-between rounded-2xl bg-[#EAF4EB] px-4 py-3">
          <span className="text-sm font-medium text-cocoa">Saldo restante</span>
          <span className="font-display text-lg font-extrabold text-success">{formatMoney(saldo)}</span>
        </div>
      </div>
    </Modal>
  );
}
