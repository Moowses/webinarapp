import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";
import { buildLiveSessionId } from "@/lib/utils/live-session";
import { hashToken } from "@/lib/utils/tokens";

export const runtime = "nodejs";

const STALE_PRESENCE_MS = 45_000;

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
      if (typeof data.kickedAtISO === "string" && data.kickedAtISO) {
        throw new Error("access_revoked");
      }
      const currentWatchStartedAtISO =
        typeof data.liveWatchStartedAtISO === "string" ? data.liveWatchStartedAtISO : "";
      const liveLastSeenAtISO =
        typeof data.liveLastSeenAtISO === "string" ? data.liveLastSeenAtISO : "";
      const accumulatedSec =
        typeof data.liveWatchAccumulatedSec === "number" && Number.isFinite(data.liveWatchAccumulatedSec)
          ? Math.max(0, Math.floor(data.liveWatchAccumulatedSec))
          : 0;

      let nextAccumulatedSec = accumulatedSec;
      let nextWatchStartedAtISO = currentWatchStartedAtISO || nowISO;
      const watchStartedMs = Date.parse(currentWatchStartedAtISO);
      const lastSeenMs = Date.parse(liveLastSeenAtISO);

      if (
        currentWatchStartedAtISO &&
        Number.isFinite(watchStartedMs) &&
        Number.isFinite(lastSeenMs) &&
        now - lastSeenMs > STALE_PRESENCE_MS
      ) {
        nextAccumulatedSec += Math.max(0, Math.floor((lastSeenMs - watchStartedMs) / 1000));
        nextWatchStartedAtISO = nowISO;
      }

      const webinarId = String(data.webinarId ?? "").trim();
      const webinarSlug = String(data.webinarSlug ?? "").trim();
      const webinarTitle = String(data.webinarTitle ?? "").trim();
      const timezoneGroupKey = String(data.timezoneGroupKey ?? "").trim();
      const scheduledStartISO = String(data.scheduledStartISO ?? "").trim();
      const liveWindowEndISO = String(data.liveWindowEndISO ?? data.scheduledEndISO ?? "").trim();
      const liveWindowEndMs = Date.parse(liveWindowEndISO);
      const firstName = String(data.firstName ?? "").trim();
      const lastName = String(data.lastName ?? "").trim();
      const fullName = `${firstName} ${lastName}`.trim() || "(No name)";
      const extraSec =
        nextWatchStartedAtISO && Number.isFinite(Date.parse(nextWatchStartedAtISO))
          ? Math.max(0, Math.floor((now - Date.parse(nextWatchStartedAtISO)) / 1000))
          : 0;
      const watchedMinutes = Math.max(0, Math.floor((nextAccumulatedSec + extraSec) / 60));

      if (webinarId && timezoneGroupKey && scheduledStartISO) {
        const sessionId = buildLiveSessionId({
          webinarId,
          timezoneGroupKey,
          scheduledStartISO,
        });
        const sessionRef = adminDb.collection("liveSessions").doc(sessionId);
        const viewerRef = sessionRef.collection("viewers").doc(doc.id);

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
        tx.set(
          viewerRef,
          {
            webinarId,
            fullName,
            email: String(data.email ?? "").trim(),
            timezoneGroupKey,
            lastSeenAtISO: nowISO,
            lastSeenAtMs: now,
            watchedMinutes,
            kickedAtISO: typeof data.kickedAtISO === "string" ? data.kickedAtISO : "",
          },
          { merge: true }
        );
      }

      tx.update(ref, {
        attendedLive: true,
        attendedAtISO: typeof data.attendedAtISO === "string" ? data.attendedAtISO : nowISO,
        liveLastSeenAtISO: nowISO,
        liveWatchStartedAtISO: nextWatchStartedAtISO,
        liveWatchAccumulatedSec: nextAccumulatedSec,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "access_revoked") {
      return NextResponse.json({ error: "access revoked" }, { status: 403 });
    }
    return NextResponse.json({ error: "failed to update presence" }, { status: 500 });
  }
}
