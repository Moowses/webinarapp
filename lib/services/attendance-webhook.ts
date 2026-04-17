import "server-only";

import { adminDb } from "@/lib/services/firebase-admin";
import {
  postAttendanceWebhook,
  postNoShowWebhook,
} from "@/lib/services/webhook";
import type { WebinarWebhook } from "@/types/webinar";

const NO_SHOW_BATCH_SIZE = 100;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toWebhook(raw: unknown): WebinarWebhook {
  if (!raw || typeof raw !== "object") {
    return { enabled: false, url: "" };
  }
  const value = raw as Record<string, unknown>;
  return {
    enabled: Boolean(value.enabled),
    url: clean(value.url),
    confirmationBaseUrl: clean(value.confirmationBaseUrl) || undefined,
  };
}

function getWatchedMinutes(raw: FirebaseFirestore.DocumentData) {
  const accumulatedSec =
    typeof raw.liveWatchAccumulatedSec === "number" && Number.isFinite(raw.liveWatchAccumulatedSec)
      ? Math.max(0, Math.floor(raw.liveWatchAccumulatedSec))
      : 0;
  return Math.max(0, Math.floor(accumulatedSec / 60));
}

export async function sendAttendanceWebhookIfNeeded(registrationId: string) {
  const ref = adminDb.collection("registrations").doc(registrationId);
  const claimedAtISO = new Date().toISOString();

  const claimed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;

    const raw = snap.data() ?? {};
    if (!raw.attendedLive) return null;
    if (typeof raw.attendanceWebhookSentAtISO === "string" && raw.attendanceWebhookSentAtISO) {
      return null;
    }
    if (typeof raw.attendanceWebhookClaimedAtISO === "string" && raw.attendanceWebhookClaimedAtISO) {
      return null;
    }

    tx.update(ref, { attendanceWebhookClaimedAtISO: claimedAtISO });
      return {
        webinarId: clean(raw.webinarId),
        token: clean(raw.token),
      firstName: clean(raw.firstName),
      lastName: clean(raw.lastName),
      email: clean(raw.email).toLowerCase(),
      phone: clean(raw.phone),
        userTimeZone: clean(raw.userTimeZone) || "UTC",
        isMobile: Boolean(raw.isMobile),
        scheduledStartISO: clean(raw.scheduledStartISO),
        scheduledEndISO: clean(raw.scheduledEndISO),
        liveWindowEndISO: clean(raw.liveWindowEndISO),
        attendedAtISO: clean(raw.attendedAtISO) || claimedAtISO,
        watchedMinutes: getWatchedMinutes(raw),
      };
  });

  if (!claimed?.webinarId) return;

  try {
    const webinarSnap = await adminDb.collection("webinars").doc(claimed.webinarId).get();
    if (!webinarSnap.exists) {
      await ref.update({ attendanceWebhookClaimedAtISO: "" });
      return;
    }

    const webinar = webinarSnap.data() ?? {};
    const attendanceWebhook = toWebhook(webinar.attendanceWebhook);
    if (!attendanceWebhook.enabled || !attendanceWebhook.url) {
      await ref.update({ attendanceWebhookClaimedAtISO: "" });
      return;
    }

    await postAttendanceWebhook({
      webhook: attendanceWebhook,
      token: claimed.token,
      firstName: claimed.firstName,
      lastName: claimed.lastName,
      email: claimed.email,
      phone: claimed.phone,
      userTimeZone: claimed.userTimeZone,
      isMobile: claimed.isMobile,
      scheduledStartISO: claimed.scheduledStartISO,
      scheduledEndISO: claimed.scheduledEndISO,
      liveWindowEndISO: claimed.liveWindowEndISO,
      replayExpiryHours:
        typeof webinar.replayExpiryHours === "number" &&
        Number.isFinite(webinar.replayExpiryHours) &&
        webinar.replayExpiryHours > 0
          ? Math.floor(webinar.replayExpiryHours)
          : 72,
      attendedAtISO: claimed.attendedAtISO,
      watchedMinutes: claimed.watchedMinutes,
    });

    await ref.update({
      attendanceWebhookSentAtISO: new Date().toISOString(),
      attendanceWebhookClaimedAtISO: "",
    });
  } catch (error) {
    await ref.update({ attendanceWebhookClaimedAtISO: "" });
    throw error;
  }
}

export async function processDueNoShowWebhooks(limit = NO_SHOW_BATCH_SIZE) {
  const nowMs = Date.now();
  const registrationsSnap = await adminDb
    .collection("registrations")
    .where("status", "==", "Registered")
    .limit(limit)
    .get();

  if (registrationsSnap.empty) {
    return { scanned: 0, sent: 0 };
  }

  const webinarIds = [...new Set(
    registrationsSnap.docs
      .map((doc) => clean(doc.data().webinarId))
      .filter(Boolean)
  )];

  const webinarDocs =
    webinarIds.length > 0
      ? await adminDb.getAll(...webinarIds.map((webinarId) => adminDb.collection("webinars").doc(webinarId)))
      : [];

  const webinarMap = new Map(
    webinarDocs
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, doc.data() ?? {}] as const)
  );

  let sent = 0;

  for (const doc of registrationsSnap.docs) {
    const raw = doc.data() ?? {};
    if (raw.attendedLive) continue;
    if (typeof raw.noShowWebhookSentAtISO === "string" && raw.noShowWebhookSentAtISO) continue;
    if (typeof raw.noShowWebhookClaimedAtISO === "string" && raw.noShowWebhookClaimedAtISO) continue;

    const webinarId = clean(raw.webinarId);
    const scheduledStartISO = clean(raw.scheduledStartISO);
    if (!webinarId || !scheduledStartISO) continue;

    const webinar = webinarMap.get(webinarId);
    if (!webinar) continue;

    const lateGraceMinutes =
      typeof webinar.lateGraceMinutes === "number" && Number.isFinite(webinar.lateGraceMinutes)
        ? Math.max(1, Math.floor(webinar.lateGraceMinutes))
        : 15;
    const graceDeadlineMs = Date.parse(scheduledStartISO) + lateGraceMinutes * 60 * 1000;
    if (!Number.isFinite(graceDeadlineMs) || nowMs <= graceDeadlineMs) continue;

    const claimAtISO = new Date().toISOString();
    const claimed = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      if (!snap.exists) return null;
      const current = snap.data() ?? {};
      if (current.attendedLive) return null;
      if (String(current.status ?? "Registered") !== "Registered") return null;
      if (typeof current.noShowWebhookSentAtISO === "string" && current.noShowWebhookSentAtISO) return null;
      if (typeof current.noShowWebhookClaimedAtISO === "string" && current.noShowWebhookClaimedAtISO) return null;

      tx.update(doc.ref, { noShowWebhookClaimedAtISO: claimAtISO });
      return {
        token: clean(current.token),
        firstName: clean(current.firstName),
        lastName: clean(current.lastName),
        email: clean(current.email).toLowerCase(),
        phone: clean(current.phone),
        userTimeZone: clean(current.userTimeZone) || "UTC",
        isMobile: Boolean(current.isMobile),
        scheduledStartISO: clean(current.scheduledStartISO),
        scheduledEndISO: clean(current.scheduledEndISO),
        liveWindowEndISO: clean(current.liveWindowEndISO),
      };
    });

    if (!claimed) continue;

    try {
      const attendanceWebhook = toWebhook(webinar.attendanceWebhook);
      if (!attendanceWebhook.enabled || !attendanceWebhook.url) {
        await doc.ref.update({ noShowWebhookClaimedAtISO: "" });
        continue;
      }

      await postNoShowWebhook({
        webhook: attendanceWebhook,
        token: claimed.token,
        firstName: claimed.firstName,
        lastName: claimed.lastName,
        email: claimed.email,
        phone: claimed.phone,
        userTimeZone: claimed.userTimeZone,
        isMobile: claimed.isMobile,
        scheduledStartISO: claimed.scheduledStartISO,
        scheduledEndISO: claimed.scheduledEndISO,
        liveWindowEndISO: claimed.liveWindowEndISO,
        replayExpiryHours:
          typeof webinar.replayExpiryHours === "number" &&
          Number.isFinite(webinar.replayExpiryHours) &&
          webinar.replayExpiryHours > 0
            ? Math.floor(webinar.replayExpiryHours)
            : 72,
        noShowAtISO: claimAtISO,
      });

      await doc.ref.update({
        status: "No-show",
        noShowWebhookSentAtISO: new Date().toISOString(),
        noShowWebhookClaimedAtISO: "",
      });
      sent += 1;
    } catch (error) {
      await doc.ref.update({ noShowWebhookClaimedAtISO: "" });
      console.error("No-show webhook failed", { registrationId: doc.id, error });
    }
  }

  return { scanned: registrationsSnap.size, sent };
}
