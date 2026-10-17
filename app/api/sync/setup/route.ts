/** POST /api/sync/setup {resetAnalysis?} — "Preparar matriz" (solo administración). */
import { NextResponse } from "next/server";
import { sessionRole, syncContext } from "@/lib/sync/server";
import { addSheetRequests, missingTabs, setupRequests } from "@/lib/sync/setup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = syncContext();
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: 503 });
  const who = await sessionRole(ctx.sql);
  if (who?.role !== "admin") return NextResponse.json({ ok: false, error: "Solo la administración puede preparar la matriz" }, { status: 403 });
  const { resetAnalysis } = (await req.json().catch(() => ({}))) as { resetAnalysis?: boolean };
  try {
    const missing = missingTabs(await ctx.sheets.meta());
    await ctx.sheets.batchUpdate(addSheetRequests(missing));
    const meta = await ctx.sheets.meta();
    await ctx.sheets.batchUpdate(setupRequests(meta, { createdTabs: missing, resetAnalysis: !!resetAnalysis }));
    return NextResponse.json({ ok: true, created: missing });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
