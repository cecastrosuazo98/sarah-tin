"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, Trophy, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { useTable } from "@/lib/data/hooks";
import { useProductsEconomics } from "@/lib/data/derived";
import { TABLES } from "@/lib/data/types";
import type { Sale, SaleItem, Expense } from "@/lib/data/types";
import { resolveRange, inRange, type RangeKey } from "@/lib/domain/dates";
import { formatMoney, formatPercent } from "@/lib/format";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "mes_anterior", label: "Mes anterior" },
  { key: "todo", label: "Todo" },
];

export default function ReportesPage() {
  const { data: sales } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: expenses } = useTable<Expense>(TABLES.expenses);
  const { products } = useProductsEconomics();
  const [range, setRange] = useState<RangeKey>("mes");

  const { from, to, label } = resolveRange(range);

  const data = useMemo(() => {
    const rangeSales = sales.filter((s) => inRange(s.sale_date, from, to));
    const saleIds = new Set(rangeSales.map((s) => s.id));
    const rangeItems = saleItems.filter((it) => saleIds.has(it.sale_id));
    const rangeExpenses = expenses.filter((e) => inRange(e.expense_date, from, to));

    const revenue = rangeSales.reduce((s, x) => s + x.total, 0);
    const expenseTotal = rangeExpenses.reduce((s, e) => s + e.amount, 0);

    const costOf = new Map(products.map((p) => [p.id, p.econ.cost]));
    const byProduct = new Map<string, { name: string; units: number; revenue: number; cost: number }>();
    for (const it of rangeItems) {
      const key = it.product_id ?? it.name_snapshot;
      const cur = byProduct.get(key) ?? { name: it.name_snapshot, units: 0, revenue: 0, cost: 0 };
      cur.units += it.quantity;
      cur.revenue += it.line_total;
      cur.cost += (costOf.get(it.product_id ?? "") ?? 0) * it.quantity;
      byProduct.set(key, cur);
    }
    const profitability = Array.from(byProduct.values())
      .map((p) => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? (p.revenue - p.cost) / p.revenue : 0 }))
      .sort((a, b) => b.profit - a.profit);

    return {
      revenue,
      expenseTotal,
      result: revenue - expenseTotal,
      count: rangeSales.length,
      profitability,
    };
  }, [sales, saleItems, expenses, products, from, to]);

  const hasData = data.count > 0 || data.expenseTotal > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" subtitle="Tu resultado, ventas y rentabilidad." />

      <div className="flex gap-2 overflow-x-auto pb-1 soft-scroll">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              range === r.key ? "bg-sarah text-white" : "bg-white/70 text-cocoa-light hover:bg-peach-light"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          emoji="📊"
          title={`Sin datos para ${label.toLowerCase()}`}
          description="Registra ventas y gastos para ver tus reportes aquí."
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Ventas" value={formatMoney(data.revenue)} icon={ShoppingCart} tone="sarah" hint={`${data.count} ventas`} />
            <StatCard label="Gastos" value={formatMoney(data.expenseTotal)} icon={TrendingDown} tone="gold" />
            <StatCard
              label="Resultado"
              value={formatMoney(data.result)}
              icon={data.result >= 0 ? TrendingUp : TrendingDown}
              tone={data.result >= 0 ? "success" : "danger"}
              hint="Ventas − gastos"
            />
            <StatCard label="Ticket promedio" value={formatMoney(data.count ? Math.round(data.revenue / data.count) : 0)} icon={Wallet} tone="tin" />
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Rentabilidad por producto</CardTitle>
              <Trophy className="h-5 w-5 text-gold" />
            </CardHeader>
            <CardContent>
              {data.profitability.length === 0 ? (
                <p className="text-sm text-cocoa-soft">No hay productos vendidos en este período.</p>
              ) : (
                <div className="space-y-2">
                  {data.profitability.map((p, i) => (
                    <div key={p.name} className="rounded-xl border border-peach/50 bg-white/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-peach-light text-xs font-bold text-gold-dark">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </span>
                          <p className="truncate font-semibold text-cocoa">{p.name}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.margin >= 0.5 ? "bg-[#EAF4EB] text-success" : "bg-[#FBF1DA] text-gold-dark"}`}>
                          {formatPercent(p.margin, 0)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <p className="text-cocoa-light">Ventas</p>
                          <p className="font-semibold text-cocoa">{formatMoney(p.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-cocoa-light">Costos</p>
                          <p className="font-semibold text-cocoa">{formatMoney(p.cost)}</p>
                        </div>
                        <div>
                          <p className="text-cocoa-light">Ganancia</p>
                          <p className="font-semibold text-success">{formatMoney(p.profit)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
