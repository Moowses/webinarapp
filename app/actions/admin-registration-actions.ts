"use server";

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";

const ACTIVE_PRESENCE_MS = 45_000;

export type AdminRegistrantRow = {
  registrationId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  webinarId: string;
  webinarSlug: string;
  webinarTitle: string;
  createdAt: string | null;
  attendedLive: boolean;
  attendedAtISO: string | null;
  watchedMinutesEstimate: number | null;
  isWatchingNow: boolean;
};

export type ActiveLiveSessionRow = {
  sessionId: string;
  webinarId: string;
  webinarSlug: string;
  webinarTitle: string;
  videoPublicPath: string;
  durationSec: number;
  timezoneGroupKey: string;
  scheduledStartISO: string;
  liveWindowEndISO: string;
  attendeeCount: number;
};

export type ActiveLiveViewerRow = {
  registrationId: string;
  sessionId: string;
  webinarId: string;
  webinarTitle: string;
  timezoneGroupKey: string;
  fullName: string;
  email: string;
  lastSeenAtISO: string;
  watchedMinutes: number;
};

export type AdminLiveOverview = {
  sessions: ActiveLiveSessionRow[];
  viewers: ActiveLiveViewerRow[];
};

type WebinarMeta = {
  title: string;
  slug: string;
  videoPublicPath: string;
  durationSec: number;
};

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function norm(value: string) {
  return value.trim().toLowerCase();
}

async function getWebinarMetaMap(webinarIds: string[]): Promise<Map<string, WebinarMeta>> {
  const uniqueIds = [...new Set(webinarIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const refs = uniqueIds.map((id) => adminDb.collection("webinars").doc(id));
  const docs = await adminDb.getAll(...refs);
  const webinarMeta = new Map<string, WebinarMeta>();

  docs.forEach((doc) => {
    if (!doc.exists) return;
    const data = doc.data() ?? {};
    webinarMeta.set(doc.id, {
      title: String(data.title ?? data.slug ?? doc.id),
      slug: String(data.slug ?? ""),
      videoPublicPath: String(data.videoPublicPath ?? ""),
      durationSec: Number(data.durationSec ?? 0),
    });
  });

  return webinarMeta;
}

export async function listRegistrantsForAdminAction(): Promise<AdminRegistrantRow[]> {
  const registrationsSnap = await adminDb
    .collection("registrations")
    .select(
      "firstName",
      "lastName",
      "email",
      "phone",
      "webinarId",
      "webinarSlug",
      "webinarTitle",
      "createdAt",
      "attendedLive",
      "attendedAtISO",
      "liveLastSeenAtISO",
      "liveWatchStartedAtISO",
      "liveWatchAccumulatedSec"
    )
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  const webinarMeta = await getWebinarMetaMap(
    registrationsSnap.docs.map((doc) => String(doc.data().webinarId ?? ""))
  );

  const rows = registrationsSnap.docs.map((doc) => {
    const data = doc.data();
    const firstName = String(data.firstName ?? "").trim();
    const lastName = String(data.lastName ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || "(No name)";
    const webinarId = String(data.webinarId ?? "");
    const webinarMetaRow = webinarMeta.get(webinarId);

    const attendedAtISO =
      typeof data.attendedAtISO === "string" ? data.attendedAtISO : null;
    const liveLastSeenAtISO =
      typeof data.liveLastSeenAtISO === "string" ? data.liveLastSeenAtISO : null;
    const liveWatchStartedAtISO =
      typeof data.liveWatchStartedAtISO === "string" ? data.liveWatchStartedAtISO : null;
    const accumulatedSec =
      typeof data.liveWatchAccumulatedSec === "number" && Number.isFinite(data.liveWatchAccumulatedSec)
        ? Math.max(0, Math.floor(data.liveWatchAccumulatedSec))
        : 0;
    const liveLastSeenMs = liveLastSeenAtISO ? Date.parse(liveLastSeenAtISO) : NaN;
    const liveWatchStartedMs = liveWatchStartedAtISO ? Date.parse(liveWatchStartedAtISO) : NaN;
    const isWatchingNow =
      Number.isFinite(liveLastSeenMs) && Date.now() - liveLastSeenMs <= ACTIVE_PRESENCE_MS;
    const liveExtraSec =
      isWatchingNow && Number.isFinite(liveWatchStartedMs)
        ? Math.max(0, Math.floor((Date.now() - liveWatchStartedMs) / 1000))
        : 0;
    const watchedMinutesEstimate =
      attendedAtISO || accumulatedSec > 0 || liveExtraSec > 0
        ? Math.max(0, Math.floor((accumulatedSec + liveExtraSec) / 60))
        : null;

    return {
      registrationId: doc.id,
      fullName,
      firstName,
      lastName,
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      webinarId,
      webinarSlug: String(data.webinarSlug ?? webinarMetaRow?.slug ?? ""),
      webinarTitle:
        String(data.webinarTitle ?? "").trim() ||
        webinarMetaRow?.title ||
        String(data.webinarSlug ?? "") ||
        "(Unknown webinar)",
      createdAt: toIsoOrNull(data.createdAt),
      attendedLive: Boolean(data.attendedLive),
      attendedAtISO,
      watchedMinutesEstimate,
      isWatchingNow,
    } satisfies AdminRegistrantRow;
  });

  rows.sort((a, b) => {
    const webinarCmp = norm(a.webinarTitle).localeCompare(norm(b.webinarTitle));
    if (webinarCmp !== 0) return webinarCmp;

    const attendedDiff =
      (b.watchedMinutesEstimate ?? -1) - (a.watchedMinutesEstimate ?? -1);
    if (attendedDiff !== 0) return attendedDiff;

    const createdA = a.createdAt ? Date.parse(a.createdAt) : 0;
    const createdB = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (createdA !== createdB) return createdB - createdA;

    return norm(a.fullName).localeCompare(norm(b.fullName));
  });

  return rows;
}

export async function getAdminLiveOverviewAction(): Promise<AdminLiveOverview> {
  const nowMs = Date.now();
  const cutoffMs = nowMs - ACTIVE_PRESENCE_MS;

  const sessionsSnap = await adminDb
    .collection("liveSessions")
    .where("lastSeenAtMs", ">=", cutoffMs)
    .get();

  const sessionDocs = sessionsSnap.docs.filter((doc) => {
    const data = doc.data();
    const liveWindowEndMs = Number(data.liveWindowEndMs ?? 0);
    return !Number.isFinite(liveWindowEndMs) || liveWindowEndMs >= nowMs;
  });

  if (sessionDocs.length === 0) {
    return { sessions: [], viewers: [] };
  }

  const webinarMeta = await getWebinarMetaMap(
    sessionDocs.map((doc) => String(doc.data().webinarId ?? ""))
  );

  const viewerSnapshots = await Promise.all(
    sessionDocs.map((doc) =>
      doc.ref.collection("viewers").where("lastSeenAtMs", ">=", cutoffMs).get()
    )
  );

  const viewers: ActiveLiveViewerRow[] = [];
  const sessions: ActiveLiveSessionRow[] = [];

  sessionDocs.forEach((doc, index) => {
    const data = doc.data();
    const sessionId = doc.id;
    const webinarId = String(data.webinarId ?? "").trim();
    const timezoneGroupKey = String(data.timezoneGroupKey ?? "").trim();
    const scheduledStartISO = String(data.scheduledStartISO ?? "").trim();
    const liveWindowEndISO = String(data.liveWindowEndISO ?? "").trim();
    const webinarMetaRow = webinarMeta.get(webinarId);
    const viewerDocs = viewerSnapshots[index].docs.filter((viewerDoc) => {
      const viewerData = viewerDoc.data();
      const lastSeenAtMs = Number(viewerData.lastSeenAtMs ?? 0);
      const kickedAtISO = String(viewerData.kickedAtISO ?? "").trim();
      return Number.isFinite(lastSeenAtMs) && lastSeenAtMs >= cutoffMs && !kickedAtISO;
    });

    if (viewerDocs.length === 0) {
      return;
    }

    sessions.push({
      sessionId,
      webinarId,
      webinarSlug: String(data.webinarSlug ?? webinarMetaRow?.slug ?? ""),
      webinarTitle: String(data.webinarTitle ?? webinarMetaRow?.title ?? "(Unknown webinar)"),
      videoPublicPath: String(data.videoPublicPath ?? webinarMetaRow?.videoPublicPath ?? ""),
      durationSec: Number(data.durationSec ?? webinarMetaRow?.durationSec ?? 0),
      timezoneGroupKey,
      scheduledStartISO,
      liveWindowEndISO,
      attendeeCount: viewerDocs.length,
    });

    viewerDocs.forEach((viewerDoc) => {
      const viewerData = viewerDoc.data();
      viewers.push({
        registrationId: viewerDoc.id,
        sessionId,
        webinarId,
        webinarTitle: String(data.webinarTitle ?? webinarMetaRow?.title ?? "(Unknown webinar)"),
        timezoneGroupKey,
        fullName: String(viewerData.fullName ?? "(No name)"),
        email: String(viewerData.email ?? ""),
        lastSeenAtISO: String(viewerData.lastSeenAtISO ?? ""),
        watchedMinutes: Number(viewerData.watchedMinutes ?? 0),
      });
    });
  });

  sessions.sort((a, b) => {
    const startDiff = Date.parse(a.scheduledStartISO) - Date.parse(b.scheduledStartISO);
    if (startDiff !== 0) return startDiff;
    const titleDiff = norm(a.webinarTitle).localeCompare(norm(b.webinarTitle));
    if (titleDiff !== 0) return titleDiff;
    return norm(a.timezoneGroupKey).localeCompare(norm(b.timezoneGroupKey));
  });

  viewers.sort((a, b) => {
    const sessionCmp = a.sessionId.localeCompare(b.sessionId);
    if (sessionCmp !== 0) return sessionCmp;
    return norm(a.fullName).localeCompare(norm(b.fullName));
  });

  return { sessions, viewers };
}

export async function listActiveLiveSessionsForAdminAction(): Promise<ActiveLiveSessionRow[]> {
  const overview = await getAdminLiveOverviewAction();
  return overview.sessions;
}

export async function listActiveLiveViewersForAdminAction(): Promise<ActiveLiveViewerRow[]> {
  const overview = await getAdminLiveOverviewAction();
  return overview.viewers;
}
