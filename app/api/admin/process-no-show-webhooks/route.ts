import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { processDueNoShowWebhooks } from "@/lib/services/attendance-webhook";

export const runtime = "nodejs";

export async function POST() {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_attendance_webhook");
    if (!auth.ok) return auth.response;

    const result = await processDueNoShowWebhooks();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process no-show webhooks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
