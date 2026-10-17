"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Field, Input } from "./field";

/**
 * Anular un registro financiero: no se borra, queda marcado con su motivo
 * para que el historial sea trazable.
 */
export function VoidDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  message: string;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const confirm = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch {
      // El handler muestra el error; el formulario queda abierto con el motivo escrito.
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
            Volver
          </Button>
          <Button variant="danger" className="flex-1" onClick={confirm} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Anular"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-cocoa-light">{message}</p>
        <Field label="Motivo" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se registró dos veces" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
