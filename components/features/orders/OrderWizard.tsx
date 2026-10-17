"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Check, ChevronLeft, Minus, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { useSettings } from "@/lib/data/settings";
import { usePaymentMethods } from "@/lib/data/config";
import { createOrder, newOperationKey } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Customer, Product, PaymentMethod } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { daysUntil, formatDMY, localToday } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

type Line = { productId: string | null; name: string; quantity: number; unitPrice: number; details: string };

const STEPS = ["Cliente", "Productos", "Entrega", "Abono", "Confirmar"] as const;

/** Pedido nuevo, paso a paso, pensado para el celular. */
export function OrderWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: products } = useTable<Product>(TABLES.products);
  const { settings } = useSettings();
  const methods = usePaymentMethods();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [deposit, setDeposit] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [saving, setSaving] = useState(false);
  const [opKey, setOpKey] = useState(newOperationKey);

  // Solo se limpia al abrir un pedido nuevo; si falla el guardado, todo queda como estaba.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMode("existing");
    setCustomerId("");
    setNewName("");
    setNewPhone("");
    setLines([]);
    setCustomName("");
    setCustomPrice(0);
    setDate("");
    setTime("");
    setNotes("");
    setDeposit(0);
    setMethod("transferencia");
    setOpKey(newOperationKey());
  }, [open]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines]);
  const suggestedDeposit = Math.ceil((total * settings.min_deposit_pct) / 100) * 100;
  const customer = customers.find((c) => c.id === customerId);
  const customerLabel = mode === "new" ? newName.trim() : customer?.name ?? "";

  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.sale_price, details: "" }];
    });
  };

  const addCustom = () => {
    if (!customName.trim() || customPrice <= 0) {
      toast("Escribe el nombre y el precio del producto personalizado.", "error");
      return;
    }
    setLines((ls) => [...ls, { productId: null, name: customName.trim(), quantity: 1, unitPrice: customPrice, details: "" }]);
    setCustomName("");
    setCustomPrice(0);
  };

  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (mode === "existing" && !customerId) return "Elige un cliente o crea uno nuevo.";
      if (mode === "new" && !newName.trim()) return "Escribe el nombre del cliente.";
    }
    if (s === 1 && lines.length === 0) return "Agrega al menos un producto.";
    if (s === 2) {
      if (!date) return "Elige la fecha de entrega.";
      if (daysUntil(date) < 0) return "La fecha de entrega ya pasó.";
    }
    if (s === 3 && (deposit < 0 || deposit > total)) return "El abono no puede ser mayor que el total.";
    return null;
  };

  const next = () => {
    const err = stepError(step);
    if (err) {
      toast(err, "error");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

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
    for (let s = 0; s < 4; s++) {
      const err = stepError(s);
      if (err) {
        setStep(s);
        toast(err, "error");
        return;
      }
    }
    setSaving(true);
    try {
      const r = await createOrder({
        customerId: mode === "existing" ? customerId : null,
        newCustomer: mode === "new" ? { name: newName.trim(), phone: newPhone.trim() } : null,
        date,
        time: time || undefined,
        items: lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, details: l.details.trim() || undefined })),
        deposit,
        method,
        notes: notes.trim() || undefined,
        key: opKey,
      });
      toast(`Pedido ${r.code ?? ""} creado 💕`.replace("  ", " "));
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo crear el pedido. Revisa tu conexión e inténtalo de nuevo; no se duplicará."), "error");
    } finally {
      setSaving(false);
    }
  };

  const days = date ? daysUntil(date) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Nuevo pedido"
      description={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}
      footer={
        <>
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ChevronLeft className="h-4 w-4" /> Atrás
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-[2]" onClick={next}>Siguiente</Button>
          ) : (
            <Button className="flex-[2]" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : <><Check className="h-4 w-4" /> Crear pedido</>}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-sarah" : "bg-peach-light")} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("existing")}
              className={cn("flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold",
                mode === "existing" ? "border-sarah bg-sarah/10 text-sarah-dark" : "border-peach bg-white/70 text-cocoa")}
            >
              <Users className="h-4 w-4" /> Cliente existente
            </button>
            <button
              onClick={() => setMode("new")}
              className={cn("flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold",
                mode === "new" ? "border-sarah bg-sarah/10 text-sarah-dark" : "border-peach bg-white/70 text-cocoa")}
            >
              <UserPlus className="h-4 w-4" /> Cliente nuevo
            </button>
          </div>
          {mode === "existing" ? (
            <Field label="¿Para quién es el pedido?" required>
              <SearchSelect
                value={customerId}
                onChange={setCustomerId}
                placeholder="Busca por nombre o teléfono…"
                searchPlaceholder="Buscar cliente…"
                options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined }))}
              />
            </Field>
          ) : (
            <>
              <Field label="Nombre" required>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del cliente" />
              </Field>
              <Field label="Teléfono" hint="Opcional, para avisar cuando esté listo.">
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="+56 9 …" />
              </Field>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Agregar del catálogo" hint="El precio se completa solo.">
            <SearchSelect
              value=""
              onChange={addProduct}
              placeholder="Busca un producto…"
              searchPlaceholder="Buscar producto…"
              options={products.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name, hint: formatMoney(p.sale_price) }))}
            />
          </Field>
          <div className="rounded-2xl border border-dashed border-peach-dark p-3">
            <p className="mb-2 text-xs font-semibold text-cocoa-light">¿Producto especial o personalizado?</p>
            <div className="flex gap-2">
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ej: torta temática" className="flex-[2]" />
              <div className="flex-1"><MoneyInput value={customPrice} onChange={setCustomPrice} /></div>
              <Button variant="outline" onClick={addCustom} aria-label="Agregar personalizado"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          {lines.length === 0 ? (
            <p className="rounded-xl bg-peach-light/40 px-3 py-6 text-center text-sm text-cocoa-soft">Aún no hay productos en el pedido.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="rounded-xl border border-peach/50 bg-white/70 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cocoa">{l.name}</p>
                      <p className="text-xs text-cocoa-soft">{formatMoney(l.unitPrice)} c/u</p>
                    </div>
                    <button onClick={() => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach-light" aria-label="Menos"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button onClick={() => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: x.quantity + 1 } : x)))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach-light" aria-label="Más"><Plus className="h-4 w-4" /></button>
                    <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="ml-1 text-danger" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <Input
                    className="mt-2"
                    value={l.details}
                    onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, details: e.target.value } : x)))}
                    placeholder="Detalles: sabor, mensaje, decoración…"
                  />
                </div>
              ))}
              <p className="text-right font-display text-lg font-extrabold text-cocoa">Total {formatMoney(total)}</p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de entrega" required>
              <Input type="date" min={localToday()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hora" hint="Opcional">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          {days !== null && days >= 0 && days <= settings.alert_days && (
            <p className="rounded-xl bg-[#FBF1DA] px-3 py-2 text-sm text-gold-dark">
              Entrega {days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`}: quedará marcado como urgente.
            </p>
          )}
          <Field label="Notas" hint="Dirección de despacho, alergias, etc.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-peach-light/50 px-4 py-3">
            <span className="text-sm text-cocoa">Total del pedido</span>
            <span className="font-display text-lg font-extrabold text-cocoa">{formatMoney(total)}</span>
          </div>
          <Field label="¿Cuánto abonó?" hint="Deja 0 si todavía no paga nada. El abono queda registrado como dinero recibido.">
            <MoneyInput value={deposit} onChange={setDeposit} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {suggestedDeposit > 0 && (
              <button onClick={() => setDeposit(suggestedDeposit)} className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">
                Abono sugerido {formatMoney(suggestedDeposit)}
              </button>
            )}
            <button onClick={() => setDeposit(Math.round(total / 2))} className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">50%</button>
            <button onClick={() => setDeposit(total)} className="rounded-full bg-peach-light px-3 py-1 text-xs font-semibold text-cocoa">Pagó todo</button>
          </div>
          {deposit > 0 && (
            <Field label="¿Cómo pagó?">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 text-sm text-cocoa">
          <Row label="Cliente" value={customerLabel + (mode === "new" ? " (nuevo)" : "")} />
          <Row label="Entrega" value={`${date ? formatDMY(date) : "—"}${time ? ` · ${time}` : ""}`} />
          <div className="rounded-xl border border-peach/60 bg-white/70 p-3">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>{l.quantity}× {l.name}{l.details ? <span className="text-cocoa-soft"> · {l.details}</span> : null}</span>
                <span className="font-semibold">{formatMoney(l.quantity * l.unitPrice)}</span>
              </div>
            ))}
          </div>
          <Row label="Total" value={formatMoney(total)} strong />
          <Row label="Abono" value={deposit > 0 ? `${formatMoney(deposit)} (${methods.find((m) => m.code === method)?.label ?? method})` : "Sin abono"} />
          <Row label="Saldo a cobrar en la entrega" value={formatMoney(total - deposit)} strong />
          {notes.trim() && <Row label="Notas" value={notes.trim()} />}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-cocoa-light">{label}</span>
      <span className={cn("text-right", strong && "font-display text-base font-extrabold")}>{value}</span>
    </div>
  );
}
