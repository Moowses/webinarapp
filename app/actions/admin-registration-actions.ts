"use server";

import "server-only";
import { adminDb } from "@/lib/services/firebase-admin";
import {
  getAdminLiveOverview,
  toIsoOrNull,
  type ActiveLiveSessionRow,
  type ActiveLiveViewerRow,
  type AdminLiveOverview,
} from "@/lib/services/admin-live-overview";

export type {
  ActiveLiveSessionRow,
  ActiveLiveViewerRow,
  AdminLiveOverview,
} from "@/lib/services/admin-live-overview";

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

type WebinarMeta = {
  title: string;
  slug: string;
  videoPublicPath: string;
  durationSec: number;
};

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
  return getAdminLiveOverview();
}

export async function listActiveLiveSessionsForAdminAction(): Promise<ActiveLiveSessionRow[]> {
  const overview = await getAdminLiveOverviewAction();
  return overview.sessions;
}

export async function listActiveLiveViewersForAdminAction(): Promise<ActiveLiveViewerRow[]> {
  const overview = await getAdminLiveOverviewAction();
  return overview.viewers;
}
