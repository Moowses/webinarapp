import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      source?: unknown;
      message?: unknown;
      details?: unknown;
      path?: unknown;
    };

    const message = clean(body.message, 240);
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    await logSystemEvent({
      level: "error",
      action: "client_runtime_error",
      summary: message,
      actorType: "client",
      targetType: clean(body.source, 80) || "client",
      targetId: clean(body.path, 240),
      details: clean(body.details, 1800),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to capture client error" }, { status: 500 });
  }
}
