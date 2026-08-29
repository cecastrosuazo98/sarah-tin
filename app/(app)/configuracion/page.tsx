"use client";

import { useEffect, useState } from "react";
import {
  Store, Coins, Target, Tags, CreditCard, Database,
  CheckCircle2, CircleAlert, X, Plus, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { InstallCard } from "@/components/pwa/InstallCard";
import { useSettings, saveSettings, type Settings } from "@/lib/data/settings";
import { usingSupabase } from "@/lib/data/client";
import { PAYMENT_METHODS } from "@/lib/constants";
import { CURRENCY, formatPercent } from "@/lib/format";

export default function ConfiguracionPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [resetOpen, setResetOpen] = useState(false);
  const configured = usingSupabase();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const persist = async (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    try {
      await saveSettings({ ...settings, ...draft }, patch);
    } catch {
      toast("No se pudo guardar el cambio.", "error");
    }
  };

  const resetData = () => {
    if (typeof window === "undefined") return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("sarahtin_v1_"))
      .forEach((k) => window.localStorage.removeItem(k));
    toast("Datos reiniciados. Recargando…");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Ajusta tu negocio a tu gusto." />

      <InstallCard />

      <Card className="animate-fade-up">
        <CardHeader className="flex-row items-center gap-2">
          <Database className="h-5 w-5 text-gold" />
          <CardTitle>Estado de la app</CardTitle>
        </CardHeader>
        <CardContent>
          {configured ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" /> Conectada a Supabase. Tus datos se guardan en la nube.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-tin-dark">
              <CircleAlert className="h-5 w-5" /> Modo local: los datos se guardan en este dispositivo.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader className="flex-row items-center gap-2">
            <Store className="h-5 w-5 text-sarah-dark" />
            <CardTitle>Negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Nombre">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => persist({ name: draft.name })} />
            </Field>
            <Field label="Rubro / lema">
              <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} onBlur={() => persist({ tagline: draft.tagline })} />
            </Field>
          </CardContent>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader className="flex-row items-center gap-2">
            <Coins className="h-5 w-5 text-gold" />
            <CardTitle>Moneda y márgenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-cocoa-light">Moneda</span>
              <span className="font-semibold text-cocoa">{CURRENCY.code} ({CURRENCY.symbol})</span>
            </div>
            <Field label={`Margen objetivo: ${formatPercent(draft.target_margin, 0)}`}>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-success" />
                <input
                  type="range" min={0} max={90} step={5}
                  value={Math.round(draft.target_margin * 100)}
                  onChange={(e) => setDraft({ ...draft, target_margin: Number(e.target.value) / 100 })}
                  onMouseUp={() => persist({ target_margin: draft.target_margin })}
                  onTouchEnd={() => persist({ target_margin: draft.target_margin })}
                  className="flex-1 accent-sarah"
                />
              </div>
            </Field>
            <Field label="Redondeo del precio sugerido">
              <Select
                value={String(draft.rounding)}
                onChange={(e) => persist({ rounding: Number(e.target.value) })}
              >
                <option value="1">Sin redondeo</option>
                <option value="50">A los $50</option>
                <option value="100">A los $100</option>
                <option value="500">A los $500</option>
                <option value="1000">A los $1.000</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <CategoryEditor
          title="Categorías de producto"
          icon={<Tags className="h-5 w-5 text-tin-dark" />}
          items={draft.product_categories}
          tone="bg-peach-light text-cocoa"
          onChange={(product_categories) => persist({ product_categories })}
        />
        <CategoryEditor
          title="Categorías de gasto"
          icon={<Tags className="h-5 w-5 text-gold-dark" />}
          items={draft.expense_categories}
          tone="bg-[#FBF1DA] text-gold-dark"
          onChange={(expense_categories) => persist({ expense_categories })}
        />
      </div>

      <Card className="animate-fade-up">
        <CardHeader className="flex-row items-center gap-2">
          <CreditCard className="h-5 w-5 text-sarah-dark" />
          <CardTitle>Métodos de pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <span key={m.value} className="rounded-full bg-tin-50 px-3 py-1 text-xs font-semibold text-tin-dark">{m.label}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {!configured && (
        <Card className="animate-fade-up border-danger/20">
          <CardHeader className="flex-row items-center gap-2">
            <Trash2 className="h-5 w-5 text-danger" />
            <CardTitle>Datos de ejemplo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-cocoa-light">
              Borra todos los datos de este dispositivo para empezar de cero con tu propia información.
            </p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>Borrar y empezar de cero</Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetData}
        title="Borrar todos los datos"
        message="Se eliminarán ingredientes, productos, ventas, clientes y todo lo registrado en este dispositivo. Esta acción no se puede deshacer."
        confirmLabel="Sí, borrar todo"
      />
    </div>
  );
}

function CategoryEditor({
  title, icon, items, tone, onChange,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: string;
  onChange: (items: string[]) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Card className="animate-fade-up">
      <CardHeader className="flex-row items-center gap-2">
        {icon}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {items.map((c) => (
            <span key={c} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
              {c}
              <button onClick={() => onChange(items.filter((x) => x !== c))} aria-label={`Quitar ${c}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nueva categoría"
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                onChange([...items, value.trim()]);
                setValue("");
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (value.trim() && !items.includes(value.trim())) {
                onChange([...items, value.trim()]);
                setValue("");
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
