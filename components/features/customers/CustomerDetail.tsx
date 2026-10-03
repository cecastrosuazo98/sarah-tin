"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Pencil, Phone, MapPin, Trash2, ChevronDown } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { PaymentForm } from "./PaymentForm";
import { PayStatus } from "@/components/features/sales/PayStatus";
import { itemsText } from "@/components/features/sales/sale-text";
import { useTable } from "@/lib/data/hooks";
import { TABLES } from "@/lib/data/types";
import type { Customer, Sale, SaleItem, Payment } from "@/lib/data/types";
import { customerDebt, saleDebt } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";
import { reminderMessage, whatsappLink } from "./whatsapp";

const dayMonth = (d: string) =>
  new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

export function CustomerDetail({
  customer,
  onClose,
  onEdit,
  onDelete,
}: {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}) {
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: payments } = useTable<Payment>(TABLES.payments);
  const [payOpen, setPayOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const debt = customer ? customerDebt(customer.id, sales) : 0;

  const mySales = useMemo(
    () =>
      customer
        ? [...sales]
            .filter((s) => s.customer_id === customer.id)
            .sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date))
        : [],
    [customer, sales]
  );
  const owing = mySales.filter((s) => saleDebt(s) > 0);

  // Un pago repartido entre varias ventas se muestra como uno solo.
  const myPayments = useMemo(() => {
    if (!customer) return [];
    const byTime = new Map<string, number>();
    for (const p of payments) {
      if (p.customer_id !== customer.id) continue;
      byTime.set(p.paid_at, (byTime.get(p.paid_at) ?? 0) + p.amount);
    }
    return Array.from(byTime.entries())
      .map(([paid_at, amount]) => ({ paid_at, amount }))
      .sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at));
  }, [customer, payments]);

  const itemsOf = (saleId: string) => saleItems.filter((it) => it.sale_id === saleId);

  const defaultMessage = customer ? reminderMessage(customer.name, debt) : "";
  const [message, setMessage] = useState(defaultMessage);

  const openReminder = () => {
    setMessage(defaultMessage);
    setReminderOpen(true);
  };

  const sendWhatsApp = () => {
    if (!customer?.phone) return;
    window.open(whatsappLink(customer.phone, message), "_blank");
    setReminderOpen(false);
  };

  return (
    <>
      <Modal
        open={!!customer && !payOpen && !reminderOpen}
        onClose={onClose}
        title={customer?.name ?? ""}
      >
        {customer && (
          <div className="space-y-5">
            {debt > 0 ? (
              <div className="rounded-2xl bg-[#FBEDED] px-4 py-4 text-center">
                <p className="text-sm font-semibold text-cocoa">Me debe</p>
                <p className="font-display text-4xl font-extrabold text-danger">{formatMoney(debt)}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#EAF4EB] px-4 py-4 text-center font-display text-xl font-extrabold text-success">
                🟢 No te debe nada
              </div>
            )}

            {debt > 0 && (
              <Button size="lg" className="w-full text-lg" onClick={() => setPayOpen(true)}>
                💰 Registrar pago
              </Button>
            )}

            {owing.length > 0 && (
              <div>
                <p className="mb-2 font-display text-lg font-bold text-cocoa">¿Por qué?</p>
                <div className="space-y-2">
                  {owing.map((s) => (
                    <div key={s.id} className="rounded-xl border border-peach/50 bg-white/70 px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-soft">{dayMonth(s.sale_date)}</p>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-cocoa">
                          {itemsText(itemsOf(s.id)) || "Venta"} — <span className="font-semibold">{formatMoney(s.total)}</span>
                        </p>
                        <PayStatus total={s.total} paid={s.paid_amount} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {debt > 0 && customer.phone && (
              <Button variant="outline" className="w-full" onClick={openReminder}>
                <MessageCircle className="h-4 w-4" /> Recordarle por WhatsApp
              </Button>
            )}

            {(customer.phone || customer.address) && (
              <div className="space-y-1 text-sm text-cocoa-light">
                {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone}</p>}
                {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {customer.address}</p>}
              </div>
            )}

            {(mySales.length > 0 || myPayments.length > 0) && (
              <div className="border-t border-peach/50 pt-3">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex w-full items-center justify-between py-1 text-sm font-semibold text-cocoa-light"
                >
                  Ver todo lo que ha comprado y pagado
                  <ChevronDown className={`h-4 w-4 transition ${historyOpen ? "rotate-180" : ""}`} />
                </button>
                {historyOpen && (
                  <div className="mt-2 space-y-3">
                    {mySales.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-soft">Compras</p>
                        {mySales.map((s) => (
                          <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate text-cocoa">{itemsText(itemsOf(s.id)) || "Venta"}</p>
                              <p className="text-xs text-cocoa-soft">{dayMonth(s.sale_date)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="font-semibold text-cocoa">{formatMoney(s.total)}</span>
                              <PayStatus total={s.total} paid={s.paid_amount} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {myPayments.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-soft">Pagos</p>
                        {myPayments.map((p) => (
                          <div key={p.paid_at} className="flex items-center justify-between rounded-xl bg-[#EAF4EB]/60 px-3 py-2 text-sm">
                            <span className="text-cocoa-light">{dayMonth(p.paid_at)}</span>
                            <span className="font-semibold text-success">Pagó {formatMoney(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 border-t border-peach/50 pt-3">
              <button
                type="button"
                onClick={() => onEdit(customer)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-cocoa-light transition hover:bg-peach-light"
              >
                <Pencil className="h-4 w-4" /> Editar datos
              </button>
              <button
                type="button"
                onClick={() => onDelete(customer)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-danger transition hover:bg-[#FBEDED]"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PaymentForm open={payOpen} onClose={() => setPayOpen(false)} customer={customer} debt={debt} />

      <Modal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Recordatorio por WhatsApp"
        description="Puedes cambiar el mensaje antes de enviarlo."
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setReminderOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={sendWhatsApp}>
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
            </Button>
          </>
        }
      >
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className="min-h-[160px]" />
      </Modal>
    </>
  );
}
