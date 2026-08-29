"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { create, update } from "@/lib/data/client";
import { TABLES } from "@/lib/data/types";
import type { Customer } from "@/lib/data/types";

export function CustomerForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Customer | null;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setAddress(editing?.address ?? "");
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  const save = async () => {
    if (!name.trim()) {
      toast("Escribe el nombre del cliente.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };
      if (editing) {
        await update(TABLES.customers, editing.id, payload);
        toast("Cliente actualizado 💕");
      } else {
        await create(TABLES.customers, payload);
        toast("Cliente agregado 💕");
      }
      onClose();
    } catch {
      toast("No pudimos guardar el cliente.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar cliente" : "Nuevo cliente"}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Pérez" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" hint="Para recordatorios de WhatsApp">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="56912345678" inputMode="tel" />
          </Field>
          <Field label="Correo">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" type="email" />
          </Field>
        </div>
        <Field label="Dirección">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="opcional" />
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gustos, preferencias…" />
        </Field>
      </div>
    </Modal>
  );
}
