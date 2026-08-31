"use client";

import { useMemo, useState } from "react";
import { Banknote, MessageCircle, Pencil, Phone, MapPin, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { PaymentForm } from "./PaymentForm";
import { useTable } from "@/lib/data/hooks";
import { TABLES } from "@/lib/data/types";
import type { Customer, Sale, SaleItem, Payment } from "@/lib/data/types";
import { customerDebt } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/format";
import { BRAND } from "@/lib/constants";

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
  const myPayments = useMemo(
    () =>
      customer
        ? [...payments]
            .filter((p) => p.customer_id === customer.id)
            .sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at))
        : [],
    [customer, payments]
  );

  const defaultMessage = customer
    ? `Hola ${customer.name.split(" ")[0]}, te escribimos de ${BRAND.name} para recordarte que tienes un saldo pendiente de ${formatMoney(debt)}.\n\n¡Muchas gracias por preferirnos!`
    : "";
  const [message, setMessage] = useState(defaultMessage);

  const openReminder = () => {
    setMessage(defaultMessage);
    setReminderOpen(true);
  };

  const sendWhatsApp = () => {
    if (!customer?.phone) return;
    const phone = customer.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    setReminderOpen(false);
  };

  return (
    <>
      <Modal
        open={!!customer && !payOpen && !reminderOpen}
        onClose={onClose}
        title={customer?.name ?? ""}
        description={customer?.phone ?? undefined}
      >
        {customer && (
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                debt > 0 ? "bg-[#FBEDED]" : "bg-[#EAF4EB]"
              }`}
            >
              <span className="text-sm font-medium text-cocoa">
                {debt > 0 ? "🔴 Deuda actual" : "✅ Sin deudas"}
              </span>
              <span className={`font-display text-xl font-extrabold ${debt > 0 ? "text-danger" : "text-success"}`}>
                {formatMoney(debt)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setPayOpen(true)} disabled={debt <= 0}>
                <Banknote className="h-4 w-4" /> Pago
              </Button>
              <Button size="sm" variant="secondary" onClick={openReminder} disabled={!customer.phone || debt <= 0}>
                <MessageCircle className="h-4 w-4" /> Recordar
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(customer)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </div>

            {(customer.phone || customer.address) && (
              <div className="space-y-1 text-sm text-cocoa-light">
                {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone}</p>}
                {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {customer.address}</p>}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-cocoa">Historial de compras</p>
              {mySales.length === 0 ? (
                <p className="text-sm text-cocoa-soft">Sin compras registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {mySales.map((s) => {
                    const items = saleItems.filter((it) => it.sale_id === s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-peach/50 bg-white/60 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate text-cocoa">{items.map((it) => `${it.quantity}× ${it.name_snapshot}`).join(", ") || "Venta"}</p>
                          <p className="text-xs text-cocoa-soft">{new Date(s.sale_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-cocoa">{formatMoney(s.total)}</p>
                          {s.status !== "pagado" && <Badge tone="danger">Debe {formatMoney(s.total - s.paid_amount)}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {myPayments.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-cocoa">Pagos recibidos</p>
                <div className="space-y-1.5">
                  {myPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#EAF4EB]/60 px-3 py-2 text-sm">
                      <span className="text-cocoa-light">{new Date(p.paid_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                      <span className="font-semibold text-success">+{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-peach/50 pt-3">
              <button
                type="button"
                onClick={() => onDelete(customer)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-danger transition hover:bg-[#FBEDED]"
              >
                <Trash2 className="h-4 w-4" /> Eliminar cliente
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
        description="Revisa y edita el mensaje antes de enviarlo."
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
