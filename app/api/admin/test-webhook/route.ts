import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import {
  buildRegistrationWebhookPayload,
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
    const auth = await requireAdminRequestPermission("webinar_edit_webhook");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
      url?: unknown;
      confirmationBaseUrl?: unknown;
      userTimeZone?: unknown;
    };

    const url = clean(body.url);
    if (!url) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    const webhook: WebinarWebhook = {
      enabled: true,
      url,
      confirmationBaseUrl: clean(body.confirmationBaseUrl) || undefined,
    };

    const payload = buildRegistrationWebhookPayload({
      webhook,
      token: `test_${Date.now()}`,
      firstName: "Test",
      lastName: "Registrant",
      email: "test@example.com",
      phone: "5551234567",
      userTimeZone: clean(body.userTimeZone) || "UTC",
      isMobile: false,
      scheduledStartISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    await postWebhookPayload(url, payload);
    await logSystemEvent({
      level: "info",
      action: "registration_webhook_test_sent",
      summary: "Registration webhook test sent.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "webhook_test",
      targetId: url,
    });
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook test failed";
    await logSystemEvent({
      level: "error",
      action: "registration_webhook_test_failed",
      summary: "Registration webhook test failed.",
      details: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
