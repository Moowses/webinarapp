import { NextResponse } from "next/server";
import {
  buildRegistrationWebhookPayload,
  postWebhookPayload,
} from "@/lib/services/webhook";
import type { WebinarWebhook } from "@/types/webinar";

export const runtime = "nodejs";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook test failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
