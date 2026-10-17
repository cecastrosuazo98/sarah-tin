/** POST /api/sync/resolve {conflictId, winner: "sheets" | "app"} — solo administración. */
import { NextResponse } from "next/server";
import { sessionRole, syncContext } from "@/lib/sync/server";
import { resolveConflict } from "@/lib/sync/run";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = syncContext();
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: 503 });
  const who = await sessionRole(ctx.sql);
  if (who?.role !== "admin") return NextResponse.json({ ok: false, error: "Solo la administración resuelve conflictos" }, { status: 403 });
  const { conflictId, winner } = (await req.json().catch(() => ({}))) as { conflictId?: string; winner?: string };
  if (!conflictId || (winner !== "sheets" && winner !== "app")) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  try {
    await resolveConflict(ctx.sheets, ctx.db, conflictId, winner, who.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
