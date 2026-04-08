import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";

const ACTIVE_PRESENCE_MS = 45_000;

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

function norm(value: string) {
  return value.trim().toLowerCase();
}

export function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
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

export async function getAdminLiveOverview(): Promise<AdminLiveOverview> {
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
