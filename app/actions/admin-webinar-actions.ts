"use server";

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdminUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/services/firebase-admin";
import type { WebinarSchedule } from "@/types/webinar";

export type AdminWebinarInput = {
  id: string;
  slug: string;
  title: string;
  videoPublicPath: string;
  durationSec: number;
  scheduleType: "weekly" | "daily";
  scheduleLocalTime: string;
  scheduleWeekday?: number;
  timezoneBase?: string;
  liveWindowMinutes?: number;
};

export type AdminWebinarView = {
  id: string;
  slug: string;
  title: string;
  videoPublicPath: string;
  durationSec: number;
  schedule: WebinarSchedule;
  scheduleType: "weekly" | "daily";
  scheduleLocalTime: string;
  scheduleWeekday?: number;
};

const DEFAULT_TIMEZONE_BASE = "Asia/Manila";
const DEFAULT_LIVE_WINDOW_MINUTES = 120;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

function validateLocalTime(value: string) {
  if (!TIME_REGEX.test(value.trim())) {
    throw new Error("scheduleLocalTime must be HH:mm");
  }
}

function assertPublicVideoPath(path: string) {
  if (!path.startsWith("/")) {
    throw new Error("videoPublicPath must be a root-relative path under /public");
  }
  if (path.includes("..") || path.startsWith("//")) {
    throw new Error("videoPublicPath is invalid");
  }
  if (/^https?:\/\//i.test(path)) {
    throw new Error("videoPublicPath must not be an external URL");
  }
}

function parseWeekdayForStore(
  scheduleType: "weekly" | "daily",
  scheduleWeekday?: number
): number | null {
  if (scheduleType !== "weekly") return null;
  if (typeof scheduleWeekday !== "number") return null;
  if (!Number.isInteger(scheduleWeekday) || scheduleWeekday < 0 || scheduleWeekday > 6) {
    throw new Error("scheduleWeekday must be 0-6 for weekly schedules");
  }
  return scheduleWeekday;
}

function toSchedule(
  input: Pick<
    AdminWebinarInput,
    "scheduleType" | "scheduleLocalTime" | "scheduleWeekday" | "timezoneBase" | "liveWindowMinutes"
  >
): WebinarSchedule {
  validateLocalTime(input.scheduleLocalTime);
  const scheduleWeekday = parseWeekdayForStore(input.scheduleType, input.scheduleWeekday);
  const liveWindowMinutes = Number.isFinite(input.liveWindowMinutes) && (input.liveWindowMinutes ?? 0) > 0
    ? Math.floor(input.liveWindowMinutes as number)
    : DEFAULT_LIVE_WINDOW_MINUTES;

  return {
    timezoneBase: (input.timezoneBase ?? DEFAULT_TIMEZONE_BASE).trim() || DEFAULT_TIMEZONE_BASE,
    daysOfWeek: scheduleWeekday === null ? ALL_WEEK_DAYS : [scheduleWeekday],
    times: [input.scheduleLocalTime.trim()],
    liveWindowMinutes,
  };
}

function mapDocToAdminView(doc: FirebaseFirestore.QueryDocumentSnapshot): AdminWebinarView {
  const raw = doc.data();
  const scheduleRaw =
    raw.schedule && typeof raw.schedule === "object"
      ? (raw.schedule as Record<string, unknown>)
      : {};

  const days =
    Array.isArray(scheduleRaw.daysOfWeek) && scheduleRaw.daysOfWeek.length > 0
      ? scheduleRaw.daysOfWeek
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : raw.scheduleType === "daily"
      ? ALL_WEEK_DAYS
      : typeof raw.scheduleWeekday === "number"
      ? [Number(raw.scheduleWeekday)]
      : [3];

  const times =
    Array.isArray(scheduleRaw.times) && scheduleRaw.times.length > 0
      ? scheduleRaw.times.map((time) => String(time).trim()).filter(Boolean)
      : [String(raw.scheduleLocalTime ?? "18:00")];

  const liveWindowMinutes =
    Number.isFinite(scheduleRaw.liveWindowMinutes) && Number(scheduleRaw.liveWindowMinutes) > 0
      ? Math.floor(Number(scheduleRaw.liveWindowMinutes))
      : DEFAULT_LIVE_WINDOW_MINUTES;

  const schedule: WebinarSchedule = {
    timezoneBase: String(scheduleRaw.timezoneBase ?? DEFAULT_TIMEZONE_BASE),
    daysOfWeek: days.length ? days : [3],
    times: times.length ? times : ["18:00"],
    liveWindowMinutes,
  };

  const scheduleType = schedule.daysOfWeek.length === 7 ? "daily" : "weekly";

  return {
    id: doc.id,
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    videoPublicPath: String(raw.videoPublicPath ?? ""),
    durationSec: Number(raw.durationSec ?? 0),
    schedule,
    scheduleType,
    scheduleLocalTime: schedule.times[0] ?? "18:00",
    scheduleWeekday: scheduleType === "weekly" ? schedule.daysOfWeek[0] : undefined,
  };
}

async function assertUniqueSlug(slug: string, idToIgnore: string) {
  const snap = await adminDb.collection("webinars").where("slug", "==", slug).limit(2).get();
  const conflict = snap.docs.find((doc) => doc.id !== idToIgnore);
  if (conflict) {
    throw new Error(`slug "${slug}" is already in use`);
  }
}

export async function listWebinarsForAdminAction(): Promise<AdminWebinarView[]> {
  await requireAdminUser("view_admin", "/admin");
  const snap = await adminDb.collection("webinars").orderBy("createdAt", "desc").get();
  return snap.docs.map(mapDocToAdminView);
}

export async function upsertWebinarAction(input: AdminWebinarInput) {
  await requireAdminUser("webinar_create", "/admin");
  const id = input.id.trim();
  if (!id) throw new Error("id is required");
  if (!input.slug.trim()) throw new Error("slug is required");
  if (!input.title.trim()) throw new Error("title is required");
  if (!input.videoPublicPath.trim()) throw new Error("videoPublicPath is required");
  assertPublicVideoPath(input.videoPublicPath.trim());
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw new Error("durationSec must be > 0");
  }

  await assertUniqueSlug(input.slug.trim(), id);
  const schedule = toSchedule(input);

  const ref = adminDb.collection("webinars").doc(id);
  const existing = await ref.get();

  const payload: Record<string, unknown> = {
    slug: input.slug.trim(),
    title: input.title.trim(),
    videoPublicPath: input.videoPublicPath.trim(),
    durationSec: Math.floor(input.durationSec),
    schedule,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
  return { id };
}

export async function deleteWebinarAction(id: string) {
  await requireAdminUser("webinar_edit_basic", "/admin");
  const cleanId = id.trim();
  if (!cleanId) throw new Error("id is required");
  await adminDb.collection("webinars").doc(cleanId).delete();
  return { id: cleanId };
}
