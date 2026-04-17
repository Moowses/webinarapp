import { NextResponse } from "next/server";
import { deleteWebinarAndAssetsAction } from "@/app/actions/webinar-actions";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_basic");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as { webinarId?: string };
    const webinarId = String(body.webinarId ?? "").trim();
    if (!webinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }

    const result = await deleteWebinarAndAssetsAction(webinarId);
    await logSystemEvent({
      level: "warn",
      action: "delete_webinar_api_called",
      summary: "Delete webinar API completed.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "webinar",
      targetId: webinarId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete failed";
    await logSystemEvent({
      level: "error",
      action: "delete_webinar_api_failed",
      summary: "Delete webinar API failed.",
      details: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
