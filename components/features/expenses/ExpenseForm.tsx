"use client";

import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/lib/data/settings";
import { usePaymentMethods } from "@/lib/data/config";
import { addExpense, newOperationKey } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { localToday } from "@/lib/domain/dates";

/** Gasto operativo rápido (luz, gas, transporte…). Las compras de insumos van en Ingredientes. */
export function ExpenseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { settings } = useSettings();
  const methods = usePaymentMethods();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("efectivo");
  const [date, setDate] = useState(localToday());
  const [saving, setSaving] = useState(false);
  const [opKey, setOpKey] = useState(newOperationKey);

  useEffect(() => {
    if (!open) return;
    setCategory((c) => c || settings.expense_categories[0] || "Otros");
    setDate(localToday());
    setOpKey(newOperationKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bloqueo inmediato contra doble toque (el estado "saving" llega un render tarde).
  const guard = useRef(false);
  const save = async () => {
    if (guard.current) return;
    guard.current = true;
    try {
      await saveInner();
    } finally {
      guard.current = false;
    }
  };
  const saveInner = async () => {
    if (saving) return;
    if (!description.trim() || amount <= 0) {
      toast("Completa la descripción y el monto.", "error");
      return;
    }
    setSaving(true);
    try {
      await addExpense({ category, description: description.trim(), amount, date, method, key: opKey });
      toast("Gasto registrado 💕");
      setDescription("");
      setAmount(0);
      onClose();
    } catch (e) {
      // El formulario queda tal cual para reintentar (misma clave: no duplica).
      toast(getErrorMessage(e, "No se pudo registrar el gasto. Revisa tu conexión e inténtalo de nuevo."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar gasto"
      description="Gastos del negocio: luz, gas, transporte, publicidad… Las compras de ingredientes se registran como compra (van a inventario)."
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar gasto"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="¿En qué se gastó?" required>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: gas, bencina, bolsas" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto" required>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {settings.expense_categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pagado con">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
