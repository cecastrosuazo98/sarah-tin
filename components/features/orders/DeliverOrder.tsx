"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { PayOption, ResultBox, type PayMode } from "@/components/features/sales/pay-ui";
import { itemsText } from "@/components/features/sales/sale-text";
import { deliverOrder } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Order, OrderItem } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";

/**
 * "Lo entregué": solo pregunta si pagó lo que faltaba.
 * El pedido queda anotado como venta de hoy y, si falta plata, como deuda.
 */
export function DeliverOrder({
  order,
  items,
  customerName,
  onClose,
}: {
  order: Order | null;
  items: OrderItem[];
  customerName: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [payMode, setPayMode] = useState<PayMode | null>(null);
  const [partial, setPartial] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Se reinicia solo al abrir otro pedido (no cuando los datos se recargan tras guardar).
  const orderId = order?.id;
  useEffect(() => {
    if (orderId) {
      setPayMode(null);
      setPartial(0);
      setDone(false);
    }
  }, [orderId]);

  const total = order?.total ?? 0;
  const deposit = Math.min(order?.deposit ?? 0, total);
  const missing = Math.max(total - deposit, 0);
  const paidNow =
    payMode === "todo" ? missing : payMode === "parte" ? Math.min(partial, missing) : 0;
  const paid = deposit + paidNow;
  const needsCustomer = !customerName && payMode !== null && paid < total;

  const save = async () => {
    if (!order || payMode === null || needsCustomer) return;
    if (payMode === "parte" && partial <= 0) {
      toast("¿Cuánto pagó?", "error");
      return;
    }
    setSaving(true);
    try {
      await deliverOrder({ orderId: order.id, paidNow });
      setDone(true);
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo marcar como entregado."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={done ? "¡Listo!" : "Entregar pedido"}
      description={done ? undefined : order?.code}
      footer={
        done ? (
          <Button size="lg" className="w-full" onClick={onClose}>Listo</Button>
        ) : (
          <Button
            size="lg"
            className="w-full text-lg"
            onClick={save}
            disabled={saving || (missing > 0 && payMode === null) || needsCustomer}
          >
            {saving ? "Guardando…" : "Lo entregué"}
          </Button>
        )
      }
    >
      {order && done && (
        <div className="space-y-4 text-center">
          <p className="text-5xl" aria-hidden>✅</p>
          <p className="font-display text-2xl font-extrabold text-cocoa">Pedido entregado</p>
          <p className="text-cocoa-light">Quedó anotado como venta de hoy.</p>
          <ResultBox total={total} paid={paid} />
        </div>
      )}

      {order && !done && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-peach-light/60 p-4">
            <p className="text-sm text-cocoa-light">{customerName ?? "Sin nombre"}</p>
            <p className="mt-1 font-semibold text-cocoa">{itemsText(items) || "Pedido"}</p>
            <div className="mt-2 flex items-baseline justify-between border-t border-peach-dark/50 pt-2">
              <span className="font-semibold text-cocoa">Total</span>
              <span className="font-display text-2xl font-extrabold text-cocoa">{formatMoney(total)}</span>
            </div>
            {deposit > 0 && (
              <p className="mt-1 text-right text-sm text-cocoa-light">Ya pagó {formatMoney(deposit)} de adelanto</p>
            )}
          </div>

          {missing <= 0 ? (
            <ResultBox total={total} paid={total} />
          ) : (
            <>
              <h3 className="font-display text-xl font-extrabold text-cocoa">
                {deposit > 0 ? `¿Pagó lo que faltaba (${formatMoney(missing)})?` : "¿Pagó?"}
              </h3>
              <div className="grid gap-2">
                <PayOption active={payMode === "todo"} onClick={() => setPayMode("todo")} dot="🟢">
                  Sí, pagó todo
                </PayOption>
                <PayOption active={payMode === "parte"} onClick={() => setPayMode("parte")} dot="🟡">
                  Pagó una parte
                </PayOption>
                <PayOption active={payMode === "nada"} onClick={() => setPayMode("nada")} dot="🔴">
                  No pagó
                </PayOption>
              </div>
              {payMode === "parte" && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-cocoa">¿Cuánto pagó ahora?</p>
                  <MoneyInput value={partial} onChange={setPartial} className="h-14 text-2xl" autoFocus />
                </div>
              )}
              {payMode !== null && <ResultBox total={total} paid={paid} />}
              {needsCustomer && (
                <p className="rounded-2xl border border-warning/30 bg-[#FBF1DA] p-4 text-sm font-semibold text-cocoa">
                  Este pedido no tiene nombre, así que no se puede anotar como deuda. Si pagó todo, elige &quot;Sí, pagó todo&quot;.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
