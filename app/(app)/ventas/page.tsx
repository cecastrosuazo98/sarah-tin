"use client";

import { useMemo, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { SaleRow } from "@/components/features/sales/SaleRow";
import { SaleDetail } from "@/components/features/sales/SaleDetail";
import { useSaleFlow } from "@/components/features/sales/SaleFlow";
import { productEmoji } from "@/components/features/sales/sale-text";
import { useTable } from "@/lib/data/hooks";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { TABLES } from "@/lib/data/types";
import type { Sale, SaleItem, Customer, Product } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";
import { startOfMonth, inRange } from "@/lib/domain/dates";

/** Todas las ventas, para buscar alguna de otro día. */
export default function VentasPage() {
  const { data: sales, loading } = useTable<Sale>(TABLES.sales);
  const { data: saleItems } = useTable<SaleItem>(TABLES.sale_items);
  const { data: customers } = useTable<Customer>(TABLES.customers);
  const { data: products } = useTable<Product>(TABLES.products);
  const { openSale } = useSaleFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useAutoOpen(openSale);

  const sorted = useMemo(
    () => [...sales].sort((a, b) => +new Date(b.sale_date) - +new Date(a.sale_date)),
    [sales]
  );

  const itemsOf = (saleId: string) => saleItems.filter((it) => it.sale_id === saleId);
  const customerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.name ?? "Alguien de paso";

  const filtered = sorted.filter((s) =>
    matchesSearch(
      query,
      customerName(s.customer_id),
      itemsOf(s.id).map((it) => it.name_snapshot).join(" ")
    )
  );

  const now = new Date();
  const monthTotal = sales
    .filter((s) => inRange(s.sale_date, startOfMonth(now), now))
    .reduce((s, x) => s + x.total, 0);

  const selected = sales.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Todas las ventas" subtitle={`Este mes vendiste ${formatMoney(monthTotal)}.`} />

      {sorted.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre o producto…" />
      )}

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          emoji="🛒"
          title="Todavía no hay ventas"
          description="Cuando registres una venta aparecerá aquí."
          action={<Button onClick={openSale}><Plus className="h-4 w-4" /> Registrar venta</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay ventas con ese nombre o producto." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const items = itemsOf(s.id);
            const product = products.find((p) => p.id === items[0]?.product_id);
            return (
              <SaleRow
                key={s.id}
                sale={s}
                items={items}
                customerName={customerName(s.customer_id)}
                emoji={productEmoji(product?.name ?? items[0]?.name_snapshot, product?.category)}
                subtitle={new Date(s.sale_date).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                onClick={() => setSelectedId(s.id)}
              />
            );
          })}
        </div>
      )}

      <SaleDetail
        sale={selected}
        items={selected ? itemsOf(selected.id) : []}
        customer={customers.find((c) => c.id === selected?.customer_id) ?? null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
