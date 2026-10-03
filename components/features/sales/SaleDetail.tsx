"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PaymentForm } from "@/components/features/customers/PaymentForm";
import { deleteSale } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import type { Customer, Sale, SaleItem } from "@/lib/data/types";
import { saleDebt } from "@/lib/domain/finance";
import { formatMoney, formatDateLong } from "@/lib/format";
import { PayStatus } from "./PayStatus";

/** Lo que pasó en una venta, con lo único que se puede hacer: cobrarla o borrarla. */
export function SaleDetail({
  sale,
  items,
  customer,
  onClose,
}: {
  sale: Sale | null;
  items: SaleItem[];
  customer: Customer | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const debt = sale ? saleDebt(sale) : 0;

  return (
    <>
      <Modal
        open={!!sale && !payOpen && !confirmOpen}
        onClose={onClose}
        title={customer?.name ?? "Alguien de paso"}
        description={sale ? formatDateLong(sale.sale_date) : undefined}
      >
        {sale && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-peach-light/60 p-4">
              <div className="space-y-1">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between gap-2 text-cocoa">
                    <span className="min-w-0 truncate">
                      {it.name_snapshot}{" "}
                      <span className="text-cocoa-light">
                        {it.quantity} × {formatMoney(it.unit_price)}
                      </span>
                    </span>
                    <span className="font-semibold">{formatMoney(it.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-peach-dark/50 pt-2">
                <span className="font-semibold text-cocoa">Total</span>
                <span className="font-display text-2xl font-extrabold text-cocoa">{formatMoney(sale.total)}</span>
              </div>
              {sale.paid_amount > 0 && debt > 0 && (
                <p className="mt-1 text-right text-sm text-cocoa-light">Pagó {formatMoney(sale.paid_amount)}</p>
              )}
            </div>

            <div className="text-center">
              <PayStatus total={sale.total} paid={sale.paid_amount} size="lg" />
            </div>

            {debt > 0 && customer && (
              <Button size="lg" className="w-full text-lg" onClick={() => setPayOpen(true)}>
                💰 Registrar pago
              </Button>
            )}

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-danger transition hover:bg-[#FBEDED]"
            >
              <Trash2 className="h-4 w-4" /> Borrar esta venta
            </button>
          </div>
        )}
      </Modal>

      <PaymentForm
        open={payOpen}
        onClose={() => setPayOpen(false)}
        customer={customer}
        debt={debt}
        saleId={sale?.id}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (!sale) return;
          try {
            await deleteSale(sale.id);
            toast("Venta borrada");
            onClose();
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo borrar la venta."), "error");
            throw e;
          }
        }}
        title="Borrar venta"
        confirmLabel="Borrar"
        message="¿Borrar esta venta? Úsalo solo si la anotaste por error. No se puede deshacer."
      />
    </>
  );
}
