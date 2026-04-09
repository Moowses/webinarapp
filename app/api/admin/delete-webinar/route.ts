import { NextResponse } from "next/server";
import { deleteWebinarAndAssetsAction } from "@/app/actions/webinar-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { webinarId?: string };
    const webinarId = String(body.webinarId ?? "").trim();
    if (!webinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }

    const result = await deleteWebinarAndAssetsAction(webinarId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
