import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";
import { buildLiveSessionId } from "@/lib/utils/live-session";
import { hashToken } from "@/lib/utils/tokens";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: unknown };
    const token = cleanText(body.token, 256);

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const snap = await adminDb
      .collection("registrations")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "invalid access token" }, { status: 403 });
    }

    const ref = snap.docs[0].ref;
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw new Error("registration not found");
      }

      const data = doc.data() ?? {};
      const webinarId = String(data.webinarId ?? "").trim();
      const timezoneGroupKey = String(data.timezoneGroupKey ?? "").trim();
      const scheduledStartISO = String(data.scheduledStartISO ?? "").trim();
      const liveWindowEndISO = String(data.liveWindowEndISO ?? data.scheduledEndISO ?? "").trim();
      const liveWindowEndMs = Date.parse(liveWindowEndISO);
      const webinarSlug = String(data.webinarSlug ?? "").trim();
      const webinarTitle = String(data.webinarTitle ?? "").trim();

      if (webinarId && timezoneGroupKey && scheduledStartISO) {
        const sessionId = buildLiveSessionId({
          webinarId,
          timezoneGroupKey,
          scheduledStartISO,
        });
        const sessionRef = adminDb.collection("liveSessions").doc(sessionId);
        const viewerRef = sessionRef.collection("viewers").doc(doc.id);

        tx.delete(viewerRef);
        tx.set(
          sessionRef,
          {
            webinarId,
            webinarSlug,
            webinarTitle,
            timezoneGroupKey,
            scheduledStartISO,
            liveWindowEndISO,
            liveWindowEndMs: Number.isFinite(liveWindowEndMs) ? liveWindowEndMs : null,
            lastSeenAtISO: nowISO,
            lastSeenAtMs: now,
          },
          { merge: true }
        );
      }

      if (typeof data.kickedAtISO === "string" && data.kickedAtISO) {
        tx.update(ref, {
          liveLastSeenAtISO: nowISO,
          liveLeftAtISO: nowISO,
          liveWatchStartedAtISO: null,
        });
        return;
      }
      const currentWatchStartedAtISO =
        typeof data.liveWatchStartedAtISO === "string" ? data.liveWatchStartedAtISO : "";
      const accumulatedSec =
        typeof data.liveWatchAccumulatedSec === "number" && Number.isFinite(data.liveWatchAccumulatedSec)
          ? Math.max(0, Math.floor(data.liveWatchAccumulatedSec))
          : 0;

      let nextAccumulatedSec = accumulatedSec;
      const watchStartedMs = Date.parse(currentWatchStartedAtISO);
      if (currentWatchStartedAtISO && Number.isFinite(watchStartedMs)) {
        nextAccumulatedSec += Math.max(0, Math.floor((now - watchStartedMs) / 1000));
      }

      tx.update(ref, {
        liveLastSeenAtISO: nowISO,
        liveLeftAtISO: nowISO,
        liveWatchStartedAtISO: null,
        liveWatchAccumulatedSec: nextAccumulatedSec,
      });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed to finalize presence" }, { status: 500 });
  }
}
