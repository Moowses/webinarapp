import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 40;

function cleanText(value: unknown, maxLength: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      webinarId?: unknown;
      sessionId?: unknown;
      timezoneGroupKey?: unknown;
      senderName?: unknown;
      text?: unknown;
    };

    const webinarId = cleanText(body.webinarId, 120);
    const sessionId = cleanText(body.sessionId, 80);
    const timezoneGroupKey = cleanText(body.timezoneGroupKey, 120);
    const senderName = cleanText(body.senderName, MAX_NAME_LENGTH);
    const text = cleanText(body.text, MAX_MESSAGE_LENGTH);

    if (!webinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!timezoneGroupKey) {
      return NextResponse.json({ error: "timezoneGroupKey is required" }, { status: 400 });
    }
    if (!senderName) {
      return NextResponse.json({ error: "senderName is required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "message text is required" }, { status: 400 });
    }

    const sessionRef = adminDb.collection("sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    const session = sessionDoc.data() ?? {};
    if (
      String(session.webinarId ?? "").trim() !== webinarId ||
      String(session.timezoneGroupKey ?? "").trim() !== timezoneGroupKey
    ) {
      return NextResponse.json({ error: "session validation failed" }, { status: 403 });
    }

    await sessionRef.collection("messages").add({
      type: "user",
      text,
      senderName,
      webinarId,
      timezoneGroupKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed to send message" }, { status: 500 });
  }
}
