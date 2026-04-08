import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";
import { buildLiveSessionId } from "@/lib/utils/live-session";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { registrationId?: unknown };
    const registrationId = cleanText(body.registrationId, 120);

    if (!registrationId) {
      return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
    }

    const ref = adminDb.collection("registrations").doc(registrationId);
    const nowISO = new Date().toISOString();

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error("registration not found");
      }

      const data = snap.data() ?? {};
      const webinarId = String(data.webinarId ?? "").trim();
      const timezoneGroupKey = String(data.timezoneGroupKey ?? "").trim();
      const scheduledStartISO = String(data.scheduledStartISO ?? "").trim();

      tx.update(ref, {
        kickedAtISO: nowISO,
        liveLastSeenAtISO: null,
        liveLeftAtISO: nowISO,
        liveWatchStartedAtISO: null,
      });

      if (webinarId && timezoneGroupKey && scheduledStartISO) {
        const sessionId = buildLiveSessionId({
          webinarId,
          timezoneGroupKey,
          scheduledStartISO,
        });
        tx.delete(adminDb.collection("liveSessions").doc(sessionId).collection("viewers").doc(registrationId));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to kick viewer" },
      { status: 500 }
    );
  }
}
