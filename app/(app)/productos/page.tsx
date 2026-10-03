"use client";

import { useMemo, useState } from "react";
import { Plus, Package, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ProductForm } from "@/components/features/products/ProductForm";
import { productEmoji } from "@/components/features/sales/sale-text";
import { useProductsEconomics, type ProductWithEconomics } from "@/lib/data/derived";
import { remove } from "@/lib/data/client";
import { getErrorMessage } from "@/lib/data/error";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { TABLES } from "@/lib/data/types";
import type { Product } from "@/lib/data/types";
import { formatMoney } from "@/lib/format";

/** Lo que vende Camila y a qué precio. Costos y recetas quedan en "Más detalles". */
export default function ProductosPage() {
  const toast = useToast();
  const { products, loading } = useProductsEconomics();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [filter, setFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  useAutoOpen(() => setFormOpen(true));

  // Las categorías solo aparecen cuando hay muchos productos y más de una categoría.
  const categories = useMemo(() => {
    const used = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
    return products.length > 8 && used.length > 1 ? ["Todas", ...used.sort()] : [];
  }, [products]);

  const shown = products
    .filter(
      (p) =>
        (filter === "Todas" || p.category === filter) &&
        matchesSearch(query, p.name, p.category, p.description)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        subtitle="Lo que vendes y a qué precio."
        action={
          <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {products.length > 8 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto…" />
      )}

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 soft-scroll">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filter === c ? "bg-sarah text-white" : "bg-white/70 text-cocoa-light hover:bg-peach-light"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {!loading && products.length === 0 ? (
        <EmptyState
          icon={Package}
          emoji="🍰"
          title="Todavía no tienes productos"
          description="Agrega lo que vendes con su precio. Así registrar una venta es tocar y listo."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar producto</Button>}
        />
      ) : shown.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay productos con ese nombre." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} onClick={() => { setEditing(p); setFormOpen(true); }} />
          ))}
        </div>
      )}

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onDelete={(p) => { setFormOpen(false); setDeleting(p); }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove(TABLES.products, deleting.id);
            toast("Producto eliminado");
          } catch (e) {
            toast(getErrorMessage(e, "No se pudo eliminar."), "error");
            throw e;
          }
        }}
        title="Eliminar producto"
        message={`¿Eliminar "${deleting?.name}"? Las ventas que ya registraste no se borran.`}
      />
    </div>
  );
}

function ProductCard({ product, onClick }: { product: ProductWithEconomics; onClick: () => void }) {
  const { econ } = product;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-peach/60 bg-white/80 p-3.5 text-left shadow-card transition hover:shadow-lift"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-peach-light text-2xl" aria-hidden>
        {productEmoji(product.name, product.category)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-cocoa">{product.name}</p>
        {econ.cost > 0 && product.sale_price > 0 && (
          <p className={`text-xs ${econ.profit > 0 ? "text-success" : "text-danger"}`}>
            {econ.profit > 0 ? `Ganas ${formatMoney(econ.profit)} c/u` : "Lo vendes bajo su costo"}
          </p>
        )}
      </div>
      <p className="font-display text-xl font-extrabold text-cocoa">
        {product.sale_price > 0 ? formatMoney(product.sale_price) : "Sin precio"}
      </p>
      <ChevronRight className="h-4 w-4 shrink-0 text-cocoa-soft" />
    </button>
  );
}
