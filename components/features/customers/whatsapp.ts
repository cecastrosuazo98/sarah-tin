/** Recordatorio de cobro por WhatsApp. */
import { BRAND } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export function reminderMessage(customerName: string, debt: number): string {
  const first = customerName.split(" ")[0];
  return `Hola ${first}, te escribimos de ${BRAND.name} para recordarte que nos quedaste debiendo ${formatMoney(debt)}.\n\n¡Muchas gracias por preferirnos!`;
}

/** Link de WhatsApp. Un celular chileno sin código de país (9 dígitos) se completa con 56. */
export function whatsappLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = `56${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
