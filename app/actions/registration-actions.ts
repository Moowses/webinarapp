"use server";

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";
import {
  addDaysYMD,
  getZonedParts,
  isValidTimeZone,
  parseLocalTimeHHMM,
  zonedDateTimeToUtcDate,
} from "@/lib/utils/timezone";
import { generateToken, hashToken } from "@/lib/utils/tokens";
import type { WebinarSchedule } from "@/types/webinar";
import type { WebinarWebhook } from "@/types/webinar";
import { postRegistrationWebhook } from "@/lib/services/webhook";

export type RegisterForWebinarInput = {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userTimeZone: string;
  isMobile: boolean;
};

type WebinarRecord = {
  slug: string;
  title: string;
  videoPublicPath: string;
  durationSec: number;
  schedule: WebinarSchedule;
  webhook: WebinarWebhook;
};

export type RegistrationRecord = {
  id: string;
  webinarId: string;
  webinarSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userTimeZone: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
  scheduledEndISO: string;
  liveWindowEndISO?: string;
  scheduleTimezoneBase?: string;
  scheduleDaysOfWeek?: number[];
  scheduleTimes?: string[];
  scheduleLiveWindowMinutes?: number;
  attendedLive?: boolean;
  attendedAtISO?: string;
  kickedAtISO?: string;
  status: string;
  tokenHash: string;
  isMobile: boolean;
  evaluatedAtISO: string;
};

function toRegistrationRecord(
  id: string,
  raw: FirebaseFirestore.DocumentData
): RegistrationRecord {
  return {
    id,
    webinarId: String(raw.webinarId ?? ""),
    webinarSlug: String(raw.webinarSlug ?? "demo"),
    firstName: String(raw.firstName ?? ""),
    lastName: String(raw.lastName ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    userTimeZone: String(raw.userTimeZone ?? "UTC"),
    timezoneGroupKey: String(raw.timezoneGroupKey ?? "UTC"),
    scheduledStartISO: String(raw.scheduledStartISO ?? ""),
    scheduledEndISO: String(raw.scheduledEndISO ?? ""),
    liveWindowEndISO:
      typeof raw.liveWindowEndISO === "string" ? raw.liveWindowEndISO : undefined,
    scheduleTimezoneBase:
      typeof raw.scheduleTimezoneBase === "string" ? raw.scheduleTimezoneBase : undefined,
    scheduleDaysOfWeek: Array.isArray(raw.scheduleDaysOfWeek)
      ? raw.scheduleDaysOfWeek
          .map((day: unknown) => Number(day))
          .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)
      : undefined,
    scheduleTimes: Array.isArray(raw.scheduleTimes)
      ? raw.scheduleTimes.map((time: unknown) => String(time).trim()).filter(Boolean)
      : undefined,
    scheduleLiveWindowMinutes:
      typeof raw.scheduleLiveWindowMinutes === "number" &&
      Number.isFinite(raw.scheduleLiveWindowMinutes) &&
      raw.scheduleLiveWindowMinutes > 0
        ? Math.floor(raw.scheduleLiveWindowMinutes)
        : undefined,
    attendedLive: Boolean(raw.attendedLive),
    attendedAtISO: typeof raw.attendedAtISO === "string" ? raw.attendedAtISO : undefined,
    kickedAtISO: typeof raw.kickedAtISO === "string" ? raw.kickedAtISO : undefined,
    status: String(raw.status ?? "Registered"),
    tokenHash: String(raw.tokenHash ?? ""),
    isMobile: Boolean(raw.isMobile),
    evaluatedAtISO: new Date().toISOString(),
  };
}

type ScheduledOccurrence = {
  scheduledStartISO: string;
  scheduledEndISO: string;
  liveWindowEndISO: string;
};

function hasPassedToday(
  nowHour: number,
  nowMinute: number,
  targetHour: number,
  targetMinute: number
) {
  if (nowHour > targetHour) return true;
  if (nowHour < targetHour) return false;
  return nowMinute >= targetMinute;
}

function computeNextScheduledOccurrence(input: {
  now: Date;
  userTimeZone: string;
  daysOfWeek: number[];
  times: string[];
  durationSec: number;
  liveWindowMinutes: number;
}): ScheduledOccurrence {
  if (!isValidTimeZone(input.userTimeZone)) {
    throw new Error("Invalid userTimeZone");
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw new Error("Invalid webinar durationSec");
  }
  if (!Number.isFinite(input.liveWindowMinutes) || input.liveWindowMinutes <= 0) {
    throw new Error("Invalid webinar schedule.liveWindowMinutes");
  }

  const days = [...new Set(input.daysOfWeek)]
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (days.length === 0) {
    throw new Error("Invalid webinar schedule.daysOfWeek");
  }

  const parsedTimes = [...new Set(input.times)]
    .map((time) => ({ raw: String(time).trim(), parsed: parseLocalTimeHHMM(String(time).trim()) }))
    .filter((entry) => entry.parsed !== null) as Array<{
    raw: string;
    parsed: { hour: number; minute: number };
  }>;
  if (parsedTimes.length === 0) {
    throw new Error("Invalid webinar schedule.times");
  }

  const baseNow = getZonedParts(input.now, input.userTimeZone);
  let nextStart: Date | null = null;

  for (const day of days) {
    for (const entry of parsedTimes) {
      let daysAhead = (day - baseNow.weekday + 7) % 7;
      if (
        daysAhead === 0 &&
        hasPassedToday(baseNow.hour, baseNow.minute, entry.parsed.hour, entry.parsed.minute)
      ) {
        daysAhead = 7;
      }

      const targetDay = addDaysYMD(baseNow.year, baseNow.month, baseNow.day, daysAhead);
      const candidate = zonedDateTimeToUtcDate({
        timeZone: input.userTimeZone,
        year: targetDay.year,
        month: targetDay.month,
        day: targetDay.day,
        hour: entry.parsed.hour,
        minute: entry.parsed.minute,
        second: 0,
      });

      if (!nextStart || candidate.getTime() < nextStart.getTime()) {
        nextStart = candidate;
      }
    }
  }

  if (!nextStart) {
    throw new Error("Webinar schedule is not configured");
  }

  const scheduledEnd = new Date(nextStart.getTime() + input.durationSec * 1000);
  const liveWindowEnd = new Date(nextStart.getTime() + input.liveWindowMinutes * 60 * 1000);

  return {
    scheduledStartISO: nextStart.toISOString(),
    scheduledEndISO: scheduledEnd.toISOString(),
    liveWindowEndISO: liveWindowEnd.toISOString(),
  };
}

async function getWebinarBySlug(slug: string): Promise<{
  id: string;
  data: WebinarRecord;
} | null> {
  const snap = await adminDb
    .collection("webinars")
    .where("slug", "==", slug)
    .limit(2)
    .get();

  if (snap.empty) return null;
  if (snap.size > 1) {
    throw new Error(`Multiple webinars found for slug "${slug}"`);
  }

  const doc = snap.docs[0];
  const raw = doc.data();
  const scheduleRaw =
    raw.schedule && typeof raw.schedule === "object"
      ? (raw.schedule as Record<string, unknown>)
      : {};

  const daysOfWeek =
    Array.isArray(scheduleRaw.daysOfWeek) && scheduleRaw.daysOfWeek.length > 0
      ? scheduleRaw.daysOfWeek
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : raw.scheduleType === "daily"
      ? [0, 1, 2, 3, 4, 5, 6]
      : typeof raw.scheduleWeekday === "number"
      ? [Number(raw.scheduleWeekday)]
      : [3];

  const times =
    Array.isArray(scheduleRaw.times) && scheduleRaw.times.length > 0
      ? scheduleRaw.times.map((time) => String(time).trim()).filter(Boolean)
      : [String(raw.scheduleLocalTime ?? "20:00")];

  const liveWindowMinutes =
    Number.isFinite(scheduleRaw.liveWindowMinutes) && Number(scheduleRaw.liveWindowMinutes) > 0
      ? Math.floor(Number(scheduleRaw.liveWindowMinutes))
      : 120;

  return {
    id: doc.id,
    data: {
      slug: String(raw.slug ?? slug),
      title: String(raw.title ?? ""),
      videoPublicPath: String(raw.videoPublicPath ?? ""),
      durationSec: Number(raw.durationSec ?? 0),
      schedule: {
        timezoneBase: String(scheduleRaw.timezoneBase ?? "Asia/Manila"),
        daysOfWeek,
        times,
        liveWindowMinutes,
      },
      webhook:
        raw.webhook && typeof raw.webhook === "object"
          ? {
              enabled: Boolean((raw.webhook as Record<string, unknown>).enabled),
              url: String((raw.webhook as Record<string, unknown>).url ?? ""),
              confirmationBaseUrl:
                typeof (raw.webhook as Record<string, unknown>).confirmationBaseUrl === "string"
                  ? String((raw.webhook as Record<string, unknown>).confirmationBaseUrl)
                  : undefined,
            }
          : { enabled: false, url: "" },
    },
  };
}

export async function registerForWebinarAction(input: RegisterForWebinarInput) {
  const webinar = await getWebinarBySlug(input.slug);
  if (!webinar) {
    throw new Error("Webinar not found");
  }

  if (!isValidTimeZone(input.userTimeZone)) {
    throw new Error("Invalid user time zone");
  }

  const timezoneGroupKey = input.userTimeZone;
  const { scheduledStartISO, scheduledEndISO, liveWindowEndISO } = computeNextScheduledOccurrence(
    {
      now: new Date(),
      userTimeZone: input.userTimeZone,
      daysOfWeek: webinar.data.schedule.daysOfWeek,
      times: webinar.data.schedule.times,
      durationSec: webinar.data.durationSec,
      liveWindowMinutes: webinar.data.schedule.liveWindowMinutes,
    }
  );

  const token = generateToken();
  const tokenHash = hashToken(token);

  await adminDb.collection("registrations").add({
    webinarId: webinar.id,
    webinarSlug: webinar.data.slug,
    webinarTitle: webinar.data.title,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    userTimeZone: input.userTimeZone,
    timezoneGroupKey,
    scheduledStartISO,
    scheduledEndISO,
    liveWindowEndISO,
    scheduleTimezoneBase: input.userTimeZone,
    scheduleDaysOfWeek: webinar.data.schedule.daysOfWeek,
    scheduleTimes: webinar.data.schedule.times,
    scheduleLiveWindowMinutes: webinar.data.schedule.liveWindowMinutes,
    status: "Registered",
    tokenHash,
    isMobile: input.isMobile,
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    await postRegistrationWebhook({
      webhook: webinar.data.webhook,
      token,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      userTimeZone: input.userTimeZone,
      isMobile: input.isMobile,
      scheduledStartISO,
    });
  } catch (error) {
    console.error("Registration webhook failed", {
      webinarSlug: webinar.data.slug,
      webhookEnabled: webinar.data.webhook.enabled,
      webhookUrl: webinar.data.webhook.url,
      error,
    });
  }

  return { token, webinarSlug: webinar.data.slug };
}

export async function getRegistrationByTokenAction(
  token: string
): Promise<RegistrationRecord | null> {
  const tokenHash = hashToken(token);
  const snap = await adminDb
    .collection("registrations")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return toRegistrationRecord(doc.id, doc.data());
}

export async function markRegistrationAttendedAction(registrationId: string) {
  const cleanRegistrationId = registrationId.trim();
  if (!cleanRegistrationId) throw new Error("registrationId is required");

  const ref = adminDb.collection("registrations").doc(cleanRegistrationId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const raw = snap.data() ?? {};
    if (raw.attendedLive) return;

    tx.update(ref, {
      attendedLive: true,
      attendedAtISO: new Date().toISOString(),
    });
  });
}
