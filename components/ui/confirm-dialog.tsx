"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Eliminar",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // El handler que lanza el error muestra su propio toast; no cerramos.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-cocoa-light">{message}</p>
    </Modal>
  );
}
