/**
 * Función programada de Netlify: sincroniza la matriz cada 10 minutos.
 * Llama a /api/sync con el secreto SYNC_CRON_SECRET (variable de entorno).
 */
export default async () => {
  const base = process.env.URL;
  const secret = process.env.SYNC_CRON_SECRET;
  if (!base || !secret) {
    console.log("sync-cron: falta URL o SYNC_CRON_SECRET; no se sincroniza");
    return;
  }
  const res = await fetch(`${base}/api/sync`, { method: "POST", headers: { "x-sync-secret": secret } });
  console.log("sync-cron:", res.status, (await res.text()).slice(0, 500));
};

export const config = { schedule: "*/10 * * * *" };
