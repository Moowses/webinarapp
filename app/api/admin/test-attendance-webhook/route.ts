import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import {
  buildAttendanceWebhookPayload,
  buildNoShowWebhookPayload,
  postWebhookPayload,
} from "@/lib/services/webhook";
import { logSystemEvent } from "@/lib/system-log";
import type { WebinarWebhook } from "@/types/webinar";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_attendance_webhook");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
      url?: unknown;
      confirmationBaseUrl?: unknown;
      userTimeZone?: unknown;
      mode?: unknown;
    };

    const url = clean(body.url);
    if (!url) {
      return NextResponse.json({ error: "Attendance webhook URL is required" }, { status: 400 });
    }

    const webhook: WebinarWebhook = {
      enabled: true,
      url,
      confirmationBaseUrl: clean(body.confirmationBaseUrl) || undefined,
    };

    const mode = clean(body.mode).toLowerCase();
    const payload =
      mode === "no-show"
        ? buildNoShowWebhookPayload({
            webhook,
            token: `noshow_test_${Date.now()}`,
            firstName: "Test",
            lastName: "Registrant",
            email: "noshow@example.com",
            phone: "5551234567",
            userTimeZone: clean(body.userTimeZone) || "UTC",
            isMobile: false,
            scheduledStartISO: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            noShowAtISO: new Date().toISOString(),
          })
        : buildAttendanceWebhookPayload({
            webhook,
            token: `attend_test_${Date.now()}`,
            firstName: "Test",
            lastName: "Attendee",
            email: "attendee@example.com",
            phone: "5551234567",
            userTimeZone: clean(body.userTimeZone) || "UTC",
            isMobile: false,
            scheduledStartISO: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            attendedAtISO: new Date().toISOString(),
            watchedMinutes: 15,
          });

    await postWebhookPayload(url, payload);
    await logSystemEvent({
      level: "info",
      action: "attendance_webhook_test_sent",
      summary: "Attendance webhook test sent.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "attendance_webhook_test",
      targetId: url,
      details: mode === "no-show" ? "no-show" : "attended",
    });
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attendance webhook test failed";
    await logSystemEvent({
      level: "error",
      action: "attendance_webhook_test_failed",
      summary: "Attendance webhook test failed.",
      details: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
