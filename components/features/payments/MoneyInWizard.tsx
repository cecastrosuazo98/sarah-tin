"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ChevronLeft, ShoppingBag, HandCoins, CalendarHeart, Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { SaleForm } from "@/components/features/sales/SaleForm";
import { useTable } from "@/lib/data/hooks";
import { usePaymentMethods } from "@/lib/data/config";
import { registerPayment, newOperationKey } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Customer, Order, PaymentMethod, Sale } from "@/lib/data/types";
import { customerDebt } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";
import { formatDMY } from "@/lib/domain/dates";

type Kind = "venta" | "deuda" | "pedido" | "reembolso";

const CHOICES: { kind: Kind; title: string; text: string; icon: typeof ShoppingBag }[] = [
  { kind: "venta", title: "Venta", text: "Vendí productos ahora (pagados o fiados).", icon: ShoppingBag },
  { kind: "deuda", title: "Cobro o abono de una deuda", text: "Me pagaron, completo o una parte, algo que me debían.", icon: HandCoins },
  { kind: "pedido", title: "Abono a un pedido", text: "Me pagaron por adelantado un pedido.", icon: CalendarHeart },
  { kind: "reembolso", title: "Reembolso", text: "Devolví dinero de una venta.", icon: Undo2 },
];

/** "Registrar venta o cobro": primero se elige qué pasó, luego un formulario corto. */
export function MoneyInWizard({ open, onClose, initialOrderId }: { open: boolean; onClose: () => void; initialOrderId?: string | null }) {
  const toast = useToast();
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const { data: orders } = useTable<Order>(TABLES.orders);
  const methods = usePaymentMethods();

  const [kind, setKind] = useState<Kind | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [opKey, setOpKey] = useState(newOperationKey);

  useEffect(() => {
    if (!open) return;
    setKind(initialOrderId ? "pedido" : null);
    setTargetId(initialOrderId ?? "");
    setAmount(0);
    setMethod("efectivo");
    setNote("");
    setOpKey(newOperationKey());
  }, [open, initialOrderId]);

  const debtors = useMemo(
    () => customers.map((c) => ({ c, debt: customerDebt(c.id, sales) })).filter((x) => x.debt > 0).sort((a, b) => b.debt - a.debt),
    [customers, sales]
  );
  const openOrders = useMemo(
    () => orders.filter((o) => !o.sale_id && o.status !== "cancelado" && o.total - o.deposit > 0).sort((a, b) => a.order_date.localeCompare(b.order_date)),
    [orders]
  );
  const refundable = useMemo(
    () => sales.filter((s) => !s.voided_at && s.paid_amount > 0).sort((a, b) => b.sale_date.localeCompare(a.sale_date)).slice(0, 100),
    [sales]
  );
  // Pedidos no entregados con abono (p. ej. cancelados): su abono también se puede devolver.
  const refundableOrders = useMemo(
    () => orders.filter((o) => !o.sale_id && o.deposit > 0).sort((a, b) => b.order_date.localeCompare(a.order_date)),
    [orders]
  );
  const nameOf = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "Sin cliente";

  const max =
    kind === "deuda" ? debtors.find((d) => d.c.id === targetId)?.debt ?? 0
    : kind === "pedido" ? (() => { const o = openOrders.find((x) => x.id === targetId); return o ? o.total - o.deposit : 0; })()
    : kind === "reembolso"
      ? targetId.startsWith("o:")
        ? refundableOrders.find((o) => `o:${o.id}` === targetId)?.deposit ?? 0
        : refundable.find((s) => s.id === targetId)?.paid_amount ?? 0
    : 0;

  useEffect(() => {
    if (kind && kind !== "reembolso" && targetId) setAmount(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

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
    if (saving || !kind || kind === "venta") return;
    if (!targetId) {
      toast(kind === "deuda" ? "Elige quién pagó." : kind === "pedido" ? "Elige el pedido." : "Elige la venta.", "error");
      return;
    }
    if (amount <= 0) {
      toast("Ingresa el monto.", "error");
      return;
    }
    if (amount > max) {
      toast(`El monto no puede ser mayor a ${formatMoney(max)}.`, "error");
      return;
    }
    if (kind === "reembolso" && !note.trim()) {
      toast("Escribe el motivo del reembolso.", "error");
      return;
    }
    setSaving(true);
    try {
      await registerPayment({
        kind: kind === "deuda" ? (amount >= max ? "cobro" : "abono") : kind === "pedido" ? "anticipo" : "reembolso",
        amount,
        method,
        note: note.trim() || undefined,
        customerId: kind === "deuda" ? targetId : null,
        orderId: kind === "pedido" ? targetId : kind === "reembolso" && targetId.startsWith("o:") ? targetId.slice(2) : null,
        saleId: kind === "reembolso" && !targetId.startsWith("o:") ? targetId : null,
        key: opKey,
      });
      toast(kind === "reembolso" ? "Reembolso registrado" : "Pago registrado 💕");
      onClose();
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo registrar. Revisa tu conexión e inténtalo de nuevo; no se duplicará."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (saleOpen) return <SaleForm open onClose={() => { setSaleOpen(false); onClose(); }} />;

  const title = kind ? CHOICES.find((c) => c.kind === kind)!.title : "¿Qué pasó?";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind ? title : "Registrar venta o cobro"}
      description={kind ? undefined : "Elige lo que corresponde. Una venta es lo que vendiste; un cobro es el dinero que recibiste."}
      footer={
        kind ? (
          <>
            <Button variant="outline" className="flex-1" onClick={() => (initialOrderId ? onClose() : setKind(null))} disabled={saving}>
              <ChevronLeft className="h-4 w-4" /> Atrás
            </Button>
            <Button className="flex-[2]" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
          </>
        ) : undefined
      }
    >
      {!kind && (
        <div className="grid gap-2">
          {CHOICES.map(({ kind: k, title: t, text, icon: Icon }) => (
            <button
              key={k}
              onClick={() => (k === "venta" ? setSaleOpen(true) : setKind(k))}
              className="flex items-center gap-3 rounded-2xl border border-peach bg-white/80 p-4 text-left shadow-card transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sarah/10 text-sarah-dark"><Icon className="h-5 w-5" /></span>
              <span>
                <span className="block font-semibold text-cocoa">{t}</span>
                <span className="block text-sm text-cocoa-light">{text}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {kind && (
        <div className="space-y-4">
          {kind === "deuda" && (
            <Field label="¿Quién pagó?" required>
              {debtors.length === 0 ? (
                <p className="rounded-xl bg-peach-light/40 px-3 py-3 text-sm text-cocoa-soft">Nadie tiene deudas pendientes.</p>
              ) : (
                <SearchSelect
                  value={targetId}
                  onChange={setTargetId}
                  placeholder="Busca al cliente…"
                  searchPlaceholder="Buscar…"
                  options={debtors.map(({ c, debt }) => ({ value: c.id, label: c.name, hint: `Debe ${formatMoney(debt)}` }))}
                />
              )}
            </Field>
          )}
          {kind === "pedido" && (
            <Field label="¿Qué pedido?" required>
              {openOrders.length === 0 ? (
                <p className="rounded-xl bg-peach-light/40 px-3 py-3 text-sm text-cocoa-soft">No hay pedidos con saldo pendiente.</p>
              ) : (
                <SearchSelect
                  value={targetId}
                  onChange={setTargetId}
                  placeholder="Busca por cliente o número…"
                  searchPlaceholder="Buscar…"
                  options={openOrders.map((o) => ({ value: o.id, label: `${o.code ?? ""} ${nameOf(o.customer_id)}`.trim(), hint: `${formatDMY(o.order_date)} · saldo ${formatMoney(o.total - o.deposit)}` }))}
                />
              )}
            </Field>
          )}
          {kind === "reembolso" && (
            <Field label="¿De qué venta o pedido?" required>
              <SearchSelect
                value={targetId}
                onChange={setTargetId}
                placeholder="Busca la venta o el pedido…"
                searchPlaceholder="Buscar por cliente…"
                options={[
                  ...refundable.map((s) => ({ value: s.id, label: `Venta · ${nameOf(s.customer_id)} · ${formatMoney(s.total)}`, hint: `${formatDMY(new Date(s.sale_date))} · cobrado ${formatMoney(s.paid_amount)}` })),
                  ...refundableOrders.map((o) => ({ value: `o:${o.id}`, label: `Pedido ${o.code ?? ""} · ${nameOf(o.customer_id)}`, hint: `${o.status === "cancelado" ? "cancelado" : formatDMY(o.order_date)} · abonado ${formatMoney(o.deposit)}` })),
                ]}
              />
            </Field>
          )}

          {targetId && (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-peach-light/50 px-4 py-3 text-sm">
                <span className="text-cocoa">{kind === "reembolso" ? "Máximo a devolver" : "Saldo pendiente"}</span>
                <span className="font-display text-lg font-extrabold text-cocoa">{formatMoney(max)}</span>
              </div>
              <Field
                label={kind === "reembolso" ? "Monto devuelto" : "Monto recibido"}
                hint={kind === "deuda" ? (amount >= max ? "Paga todo: se registra como cobro." : "Paga una parte: se registra como abono.") : undefined}
              >
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={kind === "reembolso" ? "Devuelto por" : "Pagó con"}>
                  <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                  </Select>
                </Field>
                <Field label={kind === "reembolso" ? "Motivo" : "Nota"} required={kind === "reembolso"}>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "reembolso" ? "Ej: producto dañado" : "Opcional"} />
                </Field>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
