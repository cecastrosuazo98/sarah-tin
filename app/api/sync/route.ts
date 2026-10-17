/**
 * POST /api/sync  → sincroniza ahora (miembro con sesión, o el cron con su secreto).
 * GET  /api/sync  → estado: última corrida, conflictos abiertos (miembros).
 */
import { NextResponse } from "next/server";
import { isCron, missingSyncEnv, sessionRole, syncContext } from "@/lib/sync/server";
import { runSync } from "@/lib/sync/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = syncContext();
  if ("error" in ctx) return NextResponse.json({ ok: false, configured: false, error: ctx.error }, { status: 503 });
  const cron = isCron(req);
  const who = cron ? null : await sessionRole(ctx.sql);
  if (!cron && !who) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { trigger?: string };
  const trigger = cron ? "programada" : body.trigger === "registro" ? "registro" : "manual";
  try {
    const r = await runSync(ctx.sheets, ctx.db, trigger);
    return NextResponse.json({ ok: r.status !== "error", ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() {
  const missing = missingSyncEnv();
  if (missing.length) return NextResponse.json({ configured: false, missing });
  const ctx = syncContext();
  if ("error" in ctx) return NextResponse.json({ configured: false });
  const who = await sessionRole(ctx.sql);
  if (!who) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const runs = await ctx.db.lastRuns(10);
  const conflicts = who.role === "admin" ? await ctx.db.openConflicts() : [];
  const [{ n }] = await ctx.sql.query<{ n: number }>(
    `select count(*)::int n from public.sync_conflicts where business_id = $1 and status = 'abierto'`, [ctx.db.businessId]);
  return NextResponse.json({
    configured: true,
    role: who.role,
    runs,
    conflicts,
    openConflicts: n,
    sheetUrl: who.role === "admin" ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit` : null,
  });
}
