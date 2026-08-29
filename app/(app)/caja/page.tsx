"use client";

import { useMemo, useState } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { openCashRegister, closeCashRegister, addCashMovement } from "@/lib/data/repo";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { CashRegister, CashMovement } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";

export default function CajaPage() {
  const toast = useToast();
  const { data: registers } = useTable<CashRegister>(TABLES.cash_registers);
  const { data: movements } = useTable<CashMovement>(TABLES.cash_movements);

  const open = registers.find((r) => r.is_open) ?? null;
  const regMovs = useMemo(
    () =>
      open
        ? movements
            .filter((m) => m.register_id === open.id)
            .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        : [],
    [open, movements]
  );
  const ingresos = regMovs.filter((m) => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos = regMovs.filter((m) => m.type === "egreso").reduce((s, m) => s + m.amount, 0);
  const balance = open ? open.opening_balance + ingresos - egresos : 0;

  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [movModal, setMovModal] = useState<null | "ingreso" | "egreso">(null);
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [movAmount, setMovAmount] = useState(0);
  const [movDesc, setMovDesc] = useState("");

  const doOpen = async () => {
    try {
      await openCashRegister(openingAmount);
      toast("Caja abierta 💕");
      setOpenModal(false);
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo abrir."), "error");
    }
  };
  const doClose = async () => {
    if (!open) return;
    await closeCashRegister(open.id, closingAmount);
    toast("Caja cerrada");
    setCloseModal(false);
  };
  const doMov = async () => {
    if (!movModal || movAmount <= 0) {
      toast("Ingresa un monto.", "error");
      return;
    }
    try {
      await addCashMovement({ type: movModal, amount: movAmount, method: "efectivo", description: movDesc });
      toast("Movimiento registrado 💕");
      setMovModal(null);
      setMovAmount(0);
      setMovDesc("");
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo registrar el movimiento."), "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caja"
        subtitle="Controla el dinero que entra y sale."
        action={
          open ? (
            <Button variant="outline" onClick={() => { setClosingAmount(balance); setCloseModal(true); }}>
              <Lock className="h-4 w-4" /> Cerrar caja
            </Button>
          ) : null
        }
      />

      {!open ? (
        <EmptyState
          icon={Wallet}
          emoji="💰"
          title="La caja está cerrada"
          description="Abre la caja con tu saldo inicial para empezar a registrar movimientos del día."
          action={<Button onClick={() => { setOpeningAmount(0); setOpenModal(true); }}><Unlock className="h-4 w-4" /> Abrir caja</Button>}
        />
      ) : (
        <>
          <div className="rounded-3xl border border-peach/60 bg-gradient-to-br from-white to-peach-light/40 p-5 shadow-card">
            <p className="text-sm text-cocoa-light">Saldo actual en caja</p>
            <p className="font-display text-4xl font-extrabold text-cocoa">{formatMoney(balance)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-white/70 p-2">
                <p className="text-xs text-cocoa-light">Inicial</p>
                <p className="font-bold text-cocoa">{formatMoney(open.opening_balance)}</p>
              </div>
              <div className="rounded-xl bg-[#EAF4EB]/70 p-2">
                <p className="text-xs text-cocoa-light">Ingresos</p>
                <p className="font-bold text-success">+{formatMoney(ingresos)}</p>
              </div>
              <div className="rounded-xl bg-[#FBEDED]/70 p-2">
                <p className="text-xs text-cocoa-light">Egresos</p>
                <p className="font-bold text-danger">−{formatMoney(egresos)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={() => setMovModal("ingreso")}>
              <ArrowDownCircle className="h-5 w-5" /> Ingreso
            </Button>
            <Button variant="gold" size="lg" onClick={() => setMovModal("egreso")}>
              <ArrowUpCircle className="h-5 w-5" /> Egreso
            </Button>
          </div>

          <div>
            <h2 className="mb-2 font-display text-lg font-bold text-cocoa">Movimientos</h2>
            {regMovs.length === 0 ? (
              <p className="rounded-xl bg-peach-light/40 px-3 py-4 text-center text-sm text-cocoa-soft">
                Aún no hay movimientos en esta caja.
              </p>
            ) : (
              <div className="space-y-2">
                {regMovs.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-3 shadow-card">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.type === "ingreso" ? "bg-[#EAF4EB] text-success" : "bg-[#FBEDED] text-danger"}`}>
                      {m.type === "ingreso" ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cocoa">{m.description || m.category || (m.type === "ingreso" ? "Ingreso" : "Egreso")}</p>
                      <p className="text-xs text-cocoa-soft">
                        {m.category ?? ""} · {new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <p className={`font-bold ${m.type === "ingreso" ? "text-success" : "text-danger"}`}>
                      {m.type === "ingreso" ? "+" : "−"}{formatMoney(m.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Abrir caja */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Abrir caja"
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={doOpen}>Abrir</Button>
          </>
        }
      >
        <Field label="Saldo inicial" hint="¿Con cuánto efectivo empiezas?">
          <MoneyInput value={openingAmount} onChange={setOpeningAmount} />
        </Field>
      </Modal>

      {/* Cerrar caja */}
      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        title="Cerrar caja"
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setCloseModal(false)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" onClick={doClose}>Cerrar caja</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-peach-light/50 px-4 py-3">
            <span className="text-sm text-cocoa">Saldo esperado</span>
            <span className="font-bold text-cocoa">{formatMoney(balance)}</span>
          </div>
          <Field label="Saldo contado" hint="Cuánto hay realmente en caja.">
            <MoneyInput value={closingAmount} onChange={setClosingAmount} />
          </Field>
          {closingAmount !== balance && (
            <p className="text-sm text-warning">
              Diferencia: {formatMoney(closingAmount - balance)}
            </p>
          )}
        </div>
      </Modal>

      {/* Movimiento */}
      <Modal
        open={!!movModal}
        onClose={() => setMovModal(null)}
        title={movModal === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setMovModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={doMov}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Monto">
            <MoneyInput value={movAmount} onChange={setMovAmount} />
          </Field>
          <Field label="Descripción">
            <Input value={movDesc} onChange={(e) => setMovDesc(e.target.value)} placeholder="Ej: Venta, compra, retiro…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
