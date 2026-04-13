import { NextResponse } from "next/server";
import { processDueNoShowWebhooks } from "@/lib/services/attendance-webhook";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await processDueNoShowWebhooks();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process no-show webhooks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
