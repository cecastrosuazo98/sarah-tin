"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Search, Trash2, UserPlus, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { useTable } from "@/lib/data/hooks";
import { createSale } from "@/lib/data/repo";
import { create } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
import { TABLES } from "@/lib/data/types";
import type { Product, Customer, Sale, SaleItem, PaymentStatus } from "@/lib/data/types";
import { matchesSearch } from "@/lib/search";
import { formatMoney, formatDateLong } from "@/lib/format";
import { toYmd } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { productEmoji, itemsText } from "./sale-text";

type CartLine = { productId: string | null; name: string; quantity: number; unitPrice: number };
type Step = 1 | 2 | 3 | 4 | 5;
type PayMode = "todo" | "parte" | "nada";

/**
 * Registrar una venta en 4 preguntas simples:
 * 1) ¿Quién compró?  2) ¿Qué compró?  3) ¿Cuántos?  4) ¿Pagó?
 * La fecha es hoy, el precio sale del producto y la deuda se calcula sola.
 */
export function SaleForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (saleDate: Date) => void;
}) {
  const toast = useToast();
  const { data: products } = useTable<Product>(TABLES.products);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);

  const [step, setStep] = useState<Step>(1);
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [line, setLine] = useState<CartLine | null>(null);
  const [payMode, setPayMode] = useState<PayMode | null>(null);
  const [partial, setPartial] = useState(0);
  const [otherDay, setOtherDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ who: string; lines: CartLine[]; total: number; paid: number } | null>(null);

  const reset = () => {
    setStep(1);
    setQuery("");
    setCustomer(null);
    setCart([]);
    setLine(null);
    setPayMode(null);
    setPartial(0);
    setOtherDay(null);
    setSaved(null);
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const goTo = (s: Step) => {
    setQuery("");
    setStep(s);
  };

  // ---- Paso 1: clientes, los que compraron hace poco primero ----
  const sortedCustomers = useMemo(() => {
    const lastBuy = new Map<string, number>();
    for (const s of sales) {
      if (!s.customer_id) continue;
      const t = +new Date(s.sale_date);
      if (t > (lastBuy.get(s.customer_id) ?? 0)) lastBuy.set(s.customer_id, t);
    }
    return [...customers].sort(
      (a, b) => (lastBuy.get(b.id) ?? 0) - (lastBuy.get(a.id) ?? 0) || a.name.localeCompare(b.name)
    );
  }, [customers, sales]);

  const pickCustomer = (c: { id: string; name: string } | null) => {
    setCustomer(c);
    goTo(cart.length > 0 ? 4 : 2);
  };

  const createCustomer = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const c = await create<Customer>(TABLES.customers, { name });
      pickCustomer({ id: c.id, name: c.name });
    } catch (e) {
      toast(getErrorMessage(e, "No pudimos agregar a esa persona."), "error");
    }
  };

  // ---- Paso 2: productos, los más vendidos primero ----
  const sortedProducts = useMemo(() => {
    const sold = new Map<string, number>();
    for (const it of saleItems) {
      if (it.product_id) sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + it.quantity);
    }
    return products
      .filter((p) => p.is_active)
      .sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [products, saleItems]);

  const pickProduct = (p: Product) => {
    const existing = cart.find((l) => l.productId === p.id);
    if (existing) {
      // Si ya estaba en la venta, se edita esa misma línea.
      setCart((c) => c.filter((l) => l !== existing));
      setLine(existing);
    } else {
      setLine({ productId: p.id, name: p.name, quantity: 1, unitPrice: p.sale_price });
    }
    goTo(3);
  };

  // ---- Paso 3: cantidad ----
  const commitLine = (): boolean => {
    if (!line) return cart.length > 0;
    if (line.quantity <= 0) {
      toast("¿Cuántos compró?", "error");
      return false;
    }
    if (line.unitPrice <= 0) {
      toast("¿A qué precio lo vendiste?", "error");
      return false;
    }
    setCart((c) => [...c, line]);
    setLine(null);
    return true;
  };

  // ---- Paso 4: pago ----
  const total = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const paid =
    payMode === "todo" ? total : payMode === "parte" ? Math.min(partial, total) : 0;
  const debt = Math.max(total - paid, 0);
  const needsCustomer = payMode !== null && debt > 0 && !customer;

  const back = () => {
    if (step === 2) goTo(1);
    else if (step === 3) {
      setLine(null);
      goTo(2);
    } else if (step === 4) {
      // Vuelve a la cantidad del último producto.
      const last = cart[cart.length - 1];
      setCart((c) => c.slice(0, -1));
      setLine(last ?? null);
      goTo(last ? 3 : 2);
    }
  };

  const save = async () => {
    if (cart.length === 0 || payMode === null) return;
    if (payMode === "parte" && partial <= 0) {
      toast("¿Cuánto pagó?", "error");
      return;
    }
    if (needsCustomer) return;

    const status: PaymentStatus = debt <= 0 ? "pagado" : paid > 0 ? "abono" : "pendiente";
    let date = new Date();
    if (otherDay && otherDay !== toYmd(date)) {
      const [y, m, d] = otherDay.split("-").map(Number);
      date = new Date(y, m - 1, d, 12, 0, 0);
    }

    setSaving(true);
    try {
      await createSale({
        customerId: customer?.id ?? null,
        items: cart,
        method: status === "pagado" ? "efectivo" : "fiado",
        status,
        paidAmount: paid,
        date: date.toISOString(),
      });
      setSaved({ who: customer?.name ?? "Alguien de paso", lines: cart, total, paid });
      setStep(5);
      onSaved?.(date);
    } catch (e) {
      toast(getErrorMessage(e, "No se pudo guardar la venta."), "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Pie de cada paso ----
  let footer: React.ReactNode = undefined;
  if (step === 3 && line) {
    footer = (
      <>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 px-3"
          onClick={() => commitLine() && goTo(2)}
        >
          <Plus className="h-5 w-5" /> Otro producto
        </Button>
        <Button size="lg" className="flex-1" onClick={() => commitLine() && goTo(4)}>
          Siguiente
        </Button>
      </>
    );
  } else if (step === 4) {
    footer = needsCustomer ? (
      // Si queda debiendo hace falta un nombre: el botón principal lleva a elegirlo.
      <Button size="lg" className="w-full text-lg" onClick={() => goTo(1)}>
        ¿Quién compró?
      </Button>
    ) : (
      <Button
        size="lg"
        className="w-full text-lg"
        onClick={save}
        disabled={saving || payMode === null}
      >
        {saving ? "Guardando…" : "Guardar venta"}
      </Button>
    );
  } else if (step === 5) {
    footer = (
      <>
        <Button variant="outline" size="lg" className="flex-1 px-3" onClick={reset}>
          Otra venta
        </Button>
        <Button size="lg" className="flex-1" onClick={onClose}>
          Listo
        </Button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 5 ? "¡Listo!" : "Registrar venta"}
      description={step <= 4 ? `Paso ${step} de 4` : undefined}
      footer={footer}
    >
      {step > 1 && step < 5 && (
        <button
          type="button"
          onClick={back}
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-cocoa-light hover:text-cocoa"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      )}

      {/* ---------------- 1. ¿Quién compró? ---------------- */}
      {step === 1 && (
        <div className="space-y-3">
          <Question>¿Quién compró?</Question>
          <SearchInput value={query} onChange={setQuery} placeholder="Escribe el nombre…" />
          <div className="space-y-2">
            {query.trim() &&
              !customers.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase()) && (
                <BigOption onClick={createCustomer} className="border-dashed">
                  <UserPlus className="h-5 w-5 text-sarah-dark" />
                  <span>
                    Agregar a <b>{query.trim()}</b>
                  </span>
                </BigOption>
              )}
            {!query.trim() && (
              <BigOption onClick={() => pickCustomer(null)}>
                <span className="text-xl" aria-hidden>🙋</span>
                <span>Alguien de paso <span className="text-cocoa-soft">(sin nombre)</span></span>
              </BigOption>
            )}
            {sortedCustomers
              .filter((c) => matchesSearch(query, c.name, c.phone))
              .slice(0, 30)
              .map((c) => (
                <BigOption key={c.id} onClick={() => pickCustomer({ id: c.id, name: c.name })}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sarah-50 font-bold text-sarah-dark">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{c.name}</span>
                </BigOption>
              ))}
          </div>
        </div>
      )}

      {/* ---------------- 2. ¿Qué compró? ---------------- */}
      {step === 2 && (
        <div className="space-y-3">
          <Question>¿Qué compró{customer ? ` ${customer.name.split(" ")[0]}` : ""}?</Question>
          {sortedProducts.length === 0 ? (
            <div className="rounded-2xl bg-peach-light/50 p-5 text-center text-cocoa">
              <p className="font-semibold">Todavía no tienes productos.</p>
              <p className="mt-1 text-sm text-cocoa-light">Agrega lo que vendes (con su precio) y vuelve aquí.</p>
              <Link href="/productos?nuevo=1" onClick={onClose} className="mt-3 inline-block rounded-2xl bg-sarah px-5 py-2.5 text-sm font-semibold text-white">
                Agregar producto
              </Link>
            </div>
          ) : (
            <>
              {sortedProducts.length > 8 && (
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar producto…" />
              )}
              <div className="grid grid-cols-2 gap-2">
                {sortedProducts
                  .filter((p) => matchesSearch(query, p.name, p.category))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-peach/60 bg-white/80 p-3 text-center shadow-card transition active:scale-95 hover:border-sarah"
                    >
                      <span className="text-3xl" aria-hidden>{productEmoji(p.name, p.category)}</span>
                      <span className="line-clamp-2 text-sm font-semibold leading-tight text-cocoa">{p.name}</span>
                      <span className="text-sm font-bold text-sarah-dark">
                        {p.sale_price > 0 ? formatMoney(p.sale_price) : "Sin precio"}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {cart.length > 0 && (
            <button type="button" onClick={() => goTo(4)} className="w-full rounded-2xl py-2 text-sm font-semibold text-sarah-dark">
              No, eso era todo → ir al pago
            </button>
          )}
        </div>
      )}

      {/* ---------------- 3. ¿Cuántos? ---------------- */}
      {step === 3 && line && (
        <div className="space-y-5">
          <Question>¿Cuántos {line.name}?</Question>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setLine({ ...line, quantity: Math.max(1, line.quantity - 1) })}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-peach-light text-cocoa transition active:scale-90"
              aria-label="Uno menos"
            >
              <Minus className="h-7 w-7" />
            </button>
            <input
              inputMode="numeric"
              value={line.quantity || ""}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setLine({ ...line, quantity: Number.isFinite(n) ? n : 0 });
              }}
              className="h-16 w-24 rounded-2xl border border-peach-dark bg-white text-center font-display text-4xl font-extrabold text-cocoa focus:border-sarah focus:outline-none"
              aria-label="Cantidad"
            />
            <button
              type="button"
              onClick={() => setLine({ ...line, quantity: line.quantity + 1 })}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sarah text-white transition active:scale-90"
              aria-label="Uno más"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>

          {products.find((p) => p.id === line.productId)?.sale_price ? null : (
            <div>
              <p className="mb-1 text-sm font-semibold text-cocoa">¿A qué precio lo vendiste? (cada uno)</p>
              <MoneyInput value={line.unitPrice} onChange={(n) => setLine({ ...line, unitPrice: n })} />
            </div>
          )}

          <div className="rounded-2xl bg-peach-light/60 px-4 py-4 text-center">
            <p className="text-lg text-cocoa-light">
              {line.quantity || 0} × {formatMoney(line.unitPrice)}
            </p>
            <p className="font-display text-3xl font-extrabold text-cocoa">
              {formatMoney((line.quantity || 0) * line.unitPrice)}
            </p>
          </div>

          {cart.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-cocoa-light">También lleva:</p>
              <CartList cart={cart} onRemove={(i) => setCart((c) => c.filter((_, j) => j !== i))} />
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. ¿Pagó? ---------------- */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-peach-light/60 p-4">
            <p className="text-sm text-cocoa-light">{customer?.name ?? "Alguien de paso"} compró:</p>
            <CartList
              cart={cart}
              onRemove={(i) => {
                const next = cart.filter((_, j) => j !== i);
                setCart(next);
                if (next.length === 0) goTo(2);
              }}
            />
            <div className="mt-2 flex items-baseline justify-between border-t border-peach-dark/50 pt-2">
              <span className="font-semibold text-cocoa">Total</span>
              <span className="font-display text-3xl font-extrabold text-cocoa">{formatMoney(total)}</span>
            </div>
          </div>

          <Question>¿Pagó?</Question>
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
              <p className="mb-1 text-sm font-semibold text-cocoa">¿Cuánto pagó?</p>
              <MoneyInput value={partial} onChange={setPartial} className="h-14 text-2xl" />
            </div>
          )}

          {payMode !== null && (
            <ResultBox total={total} paid={paid} />
          )}

          {needsCustomer && (
            <p className="rounded-2xl border border-warning/30 bg-[#FBF1DA] p-4 text-sm font-semibold text-cocoa">
              Para anotar que te deben, necesito saber quién es.
            </p>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-cocoa-light">
            <CalendarDays className="h-4 w-4" />
            {otherDay === null ? (
              <>
                <span>Hoy</span>
                <span>·</span>
                <button type="button" className="font-semibold text-sarah-dark underline-offset-2 hover:underline" onClick={() => setOtherDay(toYmd(new Date()))}>
                  ¿Fue otro día?
                </button>
              </>
            ) : (
              <input
                type="date"
                value={otherDay}
                max={toYmd(new Date())}
                onChange={(e) => setOtherDay(e.target.value || toYmd(new Date()))}
                className="h-10 rounded-xl border border-peach-dark bg-white px-3 text-cocoa"
                aria-label="Fecha de la venta"
              />
            )}
          </div>
        </div>
      )}

      {/* ---------------- 5. Confirmación ---------------- */}
      {step === 5 && saved && (
        <div className="space-y-4 text-center">
          <p className="text-5xl" aria-hidden>✅</p>
          <p className="font-display text-2xl font-extrabold text-cocoa">Venta registrada</p>
          <div className="rounded-2xl bg-peach-light/60 p-4 text-left">
            <p className="text-sm text-cocoa-light">{saved.who} compró:</p>
            <p className="mt-1 text-lg font-semibold text-cocoa">{itemsText(saved.lines)}</p>
            <div className="mt-2 flex items-baseline justify-between border-t border-peach-dark/50 pt-2">
              <span className="font-semibold text-cocoa">Total</span>
              <span className="font-display text-2xl font-extrabold text-cocoa">{formatMoney(saved.total)}</span>
            </div>
          </div>
          <ResultBox total={saved.total} paid={saved.paid} />
          {otherDay && otherDay !== toYmd(new Date()) && (
            <p className="text-sm text-cocoa-light">
              Quedó anotada el {formatDateLong(new Date(`${otherDay}T12:00:00`))}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------- Piezas pequeñas ----------------

function Question({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-2xl font-extrabold text-cocoa">{children}</h3>;
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cocoa-soft" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 pl-10 text-base"
        autoComplete="off"
      />
    </div>
  );
}

function BigOption({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 px-4 py-2 text-left font-semibold text-cocoa shadow-card transition active:scale-[0.99] hover:border-sarah",
        className
      )}
    >
      {children}
    </button>
  );
}

function PayOption({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-base font-bold transition active:scale-[0.99]",
        active ? "border-sarah bg-sarah-50 text-cocoa" : "border-peach/60 bg-white/80 text-cocoa"
      )}
    >
      <span aria-hidden>{dot}</span>
      {children}
    </button>
  );
}

/** El resultado del pago, grande y claro. */
function ResultBox({ total, paid }: { total: number; paid: number }) {
  const debt = Math.max(total - paid, 0);
  if (debt <= 0) {
    return (
      <div className="rounded-2xl bg-[#EAF4EB] px-4 py-4 text-center font-display text-2xl font-extrabold text-success">
        🟢 PAGADO
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-4 text-center",
        paid > 0 ? "bg-[#FBF1DA] text-warning" : "bg-[#FBEDED] text-danger"
      )}
    >
      {paid > 0 && <p className="text-sm font-semibold text-cocoa">Pagó {formatMoney(paid)}. Le quedan debiendo:</p>}
      <p className="font-display text-2xl font-extrabold">
        {paid > 0 ? "🟡" : "🔴"} DEBE {formatMoney(debt)}
      </p>
    </div>
  );
}

function CartList({ cart, onRemove }: { cart: CartLine[]; onRemove: (i: number) => void }) {
  return (
    <div className="mt-1 space-y-1">
      {cart.map((l, i) => (
        <div key={`${l.productId}-${i}`} className="flex items-center gap-2 text-cocoa">
          <span className="min-w-0 flex-1 truncate">
            {l.name} {l.quantity !== 1 && <span className="text-cocoa-light">x{l.quantity}</span>}
          </span>
          <span className="font-semibold">{formatMoney(l.quantity * l.unitPrice)}</span>
          <button type="button" onClick={() => onRemove(i)} className="p-1 text-cocoa-soft hover:text-danger" aria-label={`Quitar ${l.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
