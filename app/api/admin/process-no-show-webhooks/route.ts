import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { processDueNoShowWebhooks } from "@/lib/services/attendance-webhook";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

export async function POST() {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_attendance_webhook");
    if (!auth.ok) return auth.response;

    const result = await processDueNoShowWebhooks();
    await logSystemEvent({
      level: "info",
      action: "no_show_webhooks_processed",
      summary: "Due no-show webhooks processed.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "attendance_webhook_batch",
      details: `scanned=${result.scanned}, sent=${result.sent}`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process no-show webhooks";
    await logSystemEvent({
      level: "error",
      action: "no_show_webhooks_process_failed",
      summary: "Processing no-show webhooks failed.",
      details: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
