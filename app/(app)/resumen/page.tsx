"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DaySummaryCard } from "@/components/features/summary/DaySummaryCard";
import { addDays, isSameDay, toDate, localToday } from "@/lib/domain/dates";
import { formatDateLong } from "@/lib/format";

export default function ResumenPage() {
  const [day, setDay] = useState<Date | null>(null);
  useEffect(() => setDay(new Date()), []);
  if (!day) return null;
  const isToday = isSameDay(day, new Date());

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Resumen del día" subtitle="Solo con lo registrado: nada estimado." />
      <div className="flex items-center gap-2">
        <button onClick={() => setDay(addDays(day, -1))} className="rounded-xl border border-peach bg-white/80 p-2" aria-label="Día anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <label className="flex-1">
          <span className="sr-only">Fecha</span>
          <input
            type="date"
            value={localToday(day)}
            max={localToday()}
            onChange={(e) => e.target.value && setDay(toDate(e.target.value))}
            className="h-11 w-full rounded-xl border border-peach bg-white/80 px-3 text-center font-semibold capitalize text-cocoa"
          />
        </label>
        <button onClick={() => !isToday && setDay(addDays(day, 1))} disabled={isToday} className="rounded-xl border border-peach bg-white/80 p-2 disabled:opacity-40" aria-label="Día siguiente">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <p className="text-center text-sm text-cocoa-light first-letter:uppercase">{isToday ? "Hoy, " : ""}{formatDateLong(day)}</p>
      <DaySummaryCard day={day} />
    </div>
  );
}
