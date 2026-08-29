"use client";

import { useEffect, useState } from "react";
import { Download, Share, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <Card className="animate-fade-up">
      <CardHeader className="flex-row items-center gap-2">
        <Download className="h-5 w-5 text-tin-dark" />
        <CardTitle>Instalar en tu teléfono</CardTitle>
      </CardHeader>
      <CardContent>
        {installed ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Check className="h-5 w-5" /> ¡Ya está instalada en este dispositivo!
          </p>
        ) : deferred ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-cocoa-light">
              Instala Sarah & Tin como una app para abrirla desde tu pantalla de inicio.
            </p>
            <Button onClick={install}>
              <Download className="h-4 w-4" /> Instalar app
            </Button>
          </div>
        ) : isIOS ? (
          <p className="text-sm text-cocoa-light">
            En iPhone: toca el botón <Share className="mx-1 inline h-4 w-4 align-text-bottom" />
            <span className="font-semibold">Compartir</span> y luego{" "}
            <span className="font-semibold">&ldquo;Agregar a inicio&rdquo;</span>.
          </p>
        ) : (
          <p className="text-sm text-cocoa-light">
            Abre esta página en tu teléfono (Chrome/Safari) y usa la opción del navegador
            <span className="font-semibold"> &ldquo;Instalar app&rdquo;</span> o{" "}
            <span className="font-semibold">&ldquo;Agregar a pantalla de inicio&rdquo;</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
