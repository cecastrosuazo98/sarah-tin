"use client";

import { useMemo, useState } from "react";
import { Plus, Package, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ProductForm } from "@/components/features/products/ProductForm";
import { useProductsEconomics, type ProductWithEconomics } from "@/lib/data/derived";
import { useSettings } from "@/lib/data/settings";
import { remove } from "@/lib/data/client";
import { useAutoOpen } from "@/lib/hooks/useAutoOpen";
import { TABLES } from "@/lib/data/types";
import type { Product } from "@/lib/data/types";
import { formatMoney, formatPercent } from "@/lib/format";

export default function ProductosPage() {
  const toast = useToast();
  const { products, loading } = useProductsEconomics();
  const { settings } = useSettings();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [filter, setFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  useAutoOpen(() => setFormOpen(true));

  const categories = useMemo(
    () => ["Todas", ...settings.product_categories],
    [settings.product_categories]
  );
  const shown = products.filter(
    (p) =>
      (filter === "Todas" || p.category === filter) &&
      matchesSearch(query, p.name, p.category, p.description)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        subtitle="Tu catálogo con precio, costo y margen."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {products.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto…" />
      )}

      {products.length > 0 && (
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
          description="Agrega tu primer producto para comenzar a vender y ver tus márgenes."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Agregar producto</Button>}
        />
      ) : shown.length === 0 ? (
        <EmptyState emoji="🔍" title="Sin resultados" description="No hay productos que coincidan con tu búsqueda." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              targetMargin={settings.target_margin}
              onEdit={() => { setEditing(p); setFormOpen(true); }}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove(TABLES.products, deleting.id);
            toast("Producto eliminado");
          } catch (e) {
            toast(e instanceof Error ? e.message : "No se pudo eliminar.", "error");
            throw e;
          }
        }}
        title="Eliminar producto"
        message={`¿Eliminar "${deleting?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}

function ProductCard({
  product,
  targetMargin,
  onEdit,
  onDelete,
}: {
  product: ProductWithEconomics;
  targetMargin: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { econ } = product;
  return (
    <div className="flex flex-col rounded-2xl border border-peach/60 bg-white/80 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-cocoa">{product.name}</p>
          {product.category && <p className="text-xs text-cocoa-soft">{product.category}</p>}
        </div>
        <Badge tone={econ.belowTarget ? "danger" : "success"}>
          {econ.belowTarget && <AlertTriangle className="h-3 w-3" />}
          {formatPercent(econ.margin, 0)}
        </Badge>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-cocoa-light">Precio</p>
          <p className="font-display text-xl font-extrabold text-cocoa">{formatMoney(product.sale_price)}</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-cocoa-light">Costo {formatMoney(econ.cost)}</p>
          <p className="font-semibold text-success">Gana {formatMoney(econ.profit)}</p>
        </div>
      </div>

      {econ.cost <= 0 ? (
        <p className="mt-2 rounded-lg bg-[#FBF1DA] px-2 py-1 text-[0.7rem] font-medium text-gold-dark">
          Sin costo: asóciale una receta o agrega el costo de sus ingredientes.
        </p>
      ) : econ.belowTarget ? (
        <p className="mt-2 rounded-lg bg-[#FBEDED] px-2 py-1 text-[0.7rem] font-medium text-danger">
          Bajo el margen objetivo ({formatPercent(targetMargin, 0)})
        </p>
      ) : null}

      <div className="mt-auto flex gap-2 border-t border-peach/50 pt-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Eliminar">
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    </div>
  );
}
