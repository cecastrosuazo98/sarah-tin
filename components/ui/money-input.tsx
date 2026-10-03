"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/format";

const baseInput =
  "h-11 w-full rounded-xl border border-peach-dark bg-white/80 font-semibold text-cocoa placeholder:font-normal placeholder:text-cocoa-soft focus:border-sarah focus:outline-none focus:ring-2 focus:ring-sarah/30";

/** Formatea un entero con separador de miles: 25000 -> "25.000". */
function formatInt(n: number): string {
  if (!n) return "";
  return Math.round(n).toLocaleString(CURRENCY.locale);
}

/** Formatea un número (permite decimales): 8.5 -> "8,5". */
function formatNum(n: number): string {
  if (!n) return "";
  return n.toLocaleString(CURRENCY.locale, { maximumFractionDigits: 2 });
}

/**
 * Input de dinero (CLP, entero) con separador de miles y símbolo $.
 * Muestra vacío cuando el valor es 0, así al escribir no queda un 0 a la izquierda.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  id,
  autoFocus,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-cocoa-soft">
        {CURRENCY.symbol}
      </span>
      <input
        id={id}
        autoFocus={autoFocus}
        inputMode="numeric"
        value={formatInt(value)}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        className={cn(baseInput, "pl-8 pr-3", className)}
      />
    </div>
  );
}

/**
 * Input numérico (cantidades) con separador de miles y decimales con coma.
 * - Muestra vacío cuando el valor es 0 (nada de "0" fijo → sin ceros a la izquierda).
 * - Formatea la parte entera mientras se escribe: 2000 -> "2.000".
 * - Permite decimales: "8,5".
 * - Muestra la unidad (suffix) a la derecha, ej: "2.000 g".
 */
export function NumberInput({
  value,
  onChange,
  className,
  id,
  suffix,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  id?: string;
  suffix?: string;
  /** Aceptados por compatibilidad; el formato los hace innecesarios. */
  step?: number;
  min?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState<string>(() => formatNum(value));
  const focused = useRef(false);

  // Sincroniza el texto cuando el valor cambia desde afuera (ej: reset del form).
  useEffect(() => {
    if (!focused.current) setText(formatNum(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d,]/g, "");
    const ci = cleaned.indexOf(",");
    const hasComma = ci !== -1;
    let intRaw = (hasComma ? cleaned.slice(0, ci) : cleaned).replace(/^0+(?=\d)/, "");
    const decRaw = hasComma ? cleaned.slice(ci + 1).replace(/,/g, "").slice(0, 2) : "";

    if (intRaw === "" && !hasComma) {
      setText("");
      onChange(0);
      return;
    }
    const intNum = intRaw === "" ? 0 : parseInt(intRaw, 10);
    const intDisplay = intNum.toLocaleString(CURRENCY.locale);
    setText(hasComma ? `${intDisplay},${decRaw}` : intDisplay);
    const num = parseFloat(`${intNum}.${decRaw || "0"}`);
    onChange(Number.isFinite(num) ? num : 0);
  };

  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? "0"}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setText(formatNum(value));
        }}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(baseInput, "px-3", suffix && "pr-10", className)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-soft">
          {suffix}
        </span>
      )}
    </div>
  );
}
