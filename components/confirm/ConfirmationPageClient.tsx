"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  addDaysYMD,
  getZonedParts,
  isValidTimeZone,
  parseLocalTimeHHMM,
  zonedDateTimeToUtcDate,
} from "@/lib/utils/timezone";
import type { WebinarConfirmationPageConfig, WebinarSchedule } from "@/types/webinar";

type Props = {
  title: string;
  slug: string;
  videoPublicPath: string;
  schedule?: WebinarSchedule;
  durationSec: number;
  confirmationPage: WebinarConfirmationPageConfig;
  joinHref: string;
  previewMode?: boolean;
  firstName?: string;
  scheduledStartISO?: string;
  scheduledEndISO?: string;
};

const timezoneSubscribe = () => () => {};
const getServerTimezoneSnapshot = () => "UTC";
const getClientTimezoneSnapshot = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function fillTemplate(template: string, title: string) {
  return template.replace(/\{title\}/g, title);
}

function hasPassedToday(nowHour: number, nowMinute: number, targetHour: number, targetMinute: number) {
  if (nowHour > targetHour) return true;
  if (nowHour < targetHour) return false;
  return nowMinute >= targetMinute;
}

function computeNextStart(now: Date, schedule: WebinarSchedule, userTimeZone: string) {
  if (!isValidTimeZone(userTimeZone)) {
    throw new Error("Invalid user time zone");
  }

  const days = [...new Set(schedule.daysOfWeek)]
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const parsedTimes = [...new Set(schedule.times)]
    .map((time) => parseLocalTimeHHMM(String(time).trim()))
    .filter((time): time is { hour: number; minute: number } => time !== null);

  const nowParts = getZonedParts(now, userTimeZone);
  let nextStart: Date | null = null;

  for (const day of days) {
    for (const time of parsedTimes) {
      let daysAhead = (day - nowParts.weekday + 7) % 7;
      if (daysAhead === 0 && hasPassedToday(nowParts.hour, nowParts.minute, time.hour, time.minute)) {
        daysAhead = 7;
      }

      const targetDay = addDaysYMD(nowParts.year, nowParts.month, nowParts.day, daysAhead);
      const candidate = zonedDateTimeToUtcDate({
        timeZone: userTimeZone,
        year: targetDay.year,
        month: targetDay.month,
        day: targetDay.day,
        hour: time.hour,
        minute: time.minute,
        second: 0,
      });

      if (!nextStart || candidate.getTime() < nextStart.getTime()) {
        nextStart = candidate;
      }
    }
  }

  if (!nextStart) {
    throw new Error("Schedule unavailable");
  }

  return nextStart;
}

function formatCountdown(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toCalendarStamp(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseEmbedVideoUrl(url: string) {
  const clean = url.trim();
  if (!clean) return null;

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      if (id) {
        return { provider: "youtube" as const, embedUrl: `https://www.youtube.com/embed/${id}` };
      }
    }

    if (host.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return { provider: "youtube" as const, embedUrl: clean };
      }
      const id = parsed.searchParams.get("v");
      if (id) {
        return { provider: "youtube" as const, embedUrl: `https://www.youtube.com/embed/${id}` };
      }
    }

    if (host.includes("vimeo.com")) {
      if (parsed.pathname.startsWith("/video/")) {
        return { provider: "vimeo" as const, embedUrl: clean };
      }
      const id = parsed.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .find((part) => /^\d+$/.test(part));
      if (id) {
        return { provider: "vimeo" as const, embedUrl: `https://player.vimeo.com/video/${id}` };
      }
    }
  } catch {
    return null;
  }

  return null;
}

export default function ConfirmationPageClient({
  title,
  slug,
  videoPublicPath,
  schedule,
  durationSec,
  confirmationPage,
  joinHref,
  previewMode = false,
  firstName,
  scheduledStartISO,
  scheduledEndISO,
}: Props) {
  const userTimeZone = useSyncExternalStore(
    timezoneSubscribe,
    getClientTimezoneSnapshot,
    getServerTimezoneSnapshot
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resolvedSchedule = useMemo(() => {
    if (scheduledStartISO && scheduledEndISO) {
      return {
        startISO: scheduledStartISO,
        endISO: scheduledEndISO,
      };
    }

    if (!schedule) {
      return null;
    }

    const start = computeNextStart(new Date(nowMs), schedule, userTimeZone);
    return {
      startISO: start.toISOString(),
      endISO: new Date(start.getTime() + durationSec * 1000).toISOString(),
    };
  }, [durationSec, nowMs, schedule, scheduledEndISO, scheduledStartISO, userTimeZone]);

  const startMs = resolvedSchedule ? Date.parse(resolvedSchedule.startISO) : NaN;
  const endMs = resolvedSchedule ? Date.parse(resolvedSchedule.endISO) : NaN;
  const remainingSec = Number.isFinite(startMs) ? Math.max(0, Math.ceil((startMs - nowMs) / 1000)) : 0;
  const isLive = Number.isFinite(startMs) && Number.isFinite(endMs) && nowMs >= startMs && nowMs <= endMs;

  useEffect(() => {
    if (previewMode || !isLive) return;
    window.location.assign(joinHref);
  }, [isLive, joinHref, previewMode]);

  const headline = fillTemplate(confirmationPage.headline, title);
  const scheduleHeading = fillTemplate(confirmationPage.scheduleHeading, title);
  const introText = fillTemplate(confirmationPage.introText, title);
  const mediaUrl =
    confirmationPage.mediaType === "image"
      ? confirmationPage.mediaUrl
      : confirmationPage.mediaUrl || videoPublicPath;
  const embedVideo = confirmationPage.mediaType === "video" ? parseEmbedVideoUrl(mediaUrl) : null;
  const scheduledLabel = resolvedSchedule
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: userTimeZone,
      }).format(new Date(resolvedSchedule.startISO))
    : "Loading...";

  const calendarLinks = resolvedSchedule
    ? {
        google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
          title
        )}&dates=${toCalendarStamp(resolvedSchedule.startISO)}/${toCalendarStamp(
          resolvedSchedule.endISO
        )}`,
        outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(
          title
        )}&startdt=${encodeURIComponent(resolvedSchedule.startISO)}&enddt=${encodeURIComponent(
          resolvedSchedule.endISO
        )}`,
        yahoo: `https://calendar.yahoo.com/?v=60&title=${encodeURIComponent(
          title
        )}&st=${toCalendarStamp(resolvedSchedule.startISO)}&et=${toCalendarStamp(resolvedSchedule.endISO)}`,
        ics: `/api/calendar/${encodeURIComponent(slug)}?start=${encodeURIComponent(
          resolvedSchedule.startISO
        )}&end=${encodeURIComponent(resolvedSchedule.endISO)}&title=${encodeURIComponent(title)}`,
      }
    : null;

  const mediaFirst = confirmationPage.mediaPosition !== "right";

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#1F2A37]">
      <div className="mx-auto w-full max-w-[1080px]">
        {previewMode ? (
          <div className="mb-4 inline-flex rounded-full bg-[#E8F5FF] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F6FA3]">
            Confirmation Preview Mode
          </div>
        ) : null}

        <h1
          className="mx-auto max-w-5xl text-center text-[34px] font-extrabold leading-tight"
          style={{ color: confirmationPage.headlineColor }}
        >
          {headline}
        </h1>

        <div
          className="mt-6 rounded-[2px] px-6 py-3 text-center text-[28px] font-extrabold leading-none text-white"
          style={{ backgroundColor: confirmationPage.bannerColor }}
        >
          {confirmationPage.stepBannerText}
        </div>

        <div className={`mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] ${mediaFirst ? "" : "lg:[&>*:first-child]:order-2"}`}>
          <div className="overflow-hidden bg-white">
            {confirmationPage.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt={title}
                className="h-full w-full rounded-[2px] object-cover"
              />
            ) : embedVideo ? (
              <div className="aspect-video w-full overflow-hidden rounded-[2px] bg-black">
                <iframe
                  src={embedVideo.embedUrl}
                  title={`${title} video`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <video
                src={mediaUrl}
                className="h-full w-full rounded-[2px] bg-black object-cover"
                controls
                playsInline
                muted
              />
            )}
          </div>

          <div className="flex flex-col justify-between bg-white px-4 py-2 lg:px-3">
            <div>
              <p className="text-[24px] font-bold leading-tight text-black">{introText}</p>
              <div className="mt-10 text-center">
                <h2 className="text-[28px] font-extrabold leading-tight text-black">{scheduleHeading}</h2>
                <p className="mt-3 text-[22px] font-bold text-black">
                  {confirmationPage.scheduledTimeLabel}{" "}
                  <span>{scheduledLabel}</span>
                </p>
                <p className="mt-4 text-[18px] text-[#9AA0A6]">
                  {confirmationPage.countdownLabel} {isLive ? "Live now" : formatCountdown(remainingSec)}
                </p>
                <div className="mt-6">
                  {previewMode ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-[5px] px-8 py-3 text-[18px] font-bold text-white opacity-80"
                      style={{ backgroundColor: confirmationPage.primaryButtonColor }}
                    >
                      Preview Only
                    </button>
                  ) : (
                    <Link
                      href={joinHref}
                      className="inline-flex rounded-[5px] px-8 py-3 text-[18px] font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
                      style={{ backgroundColor: confirmationPage.primaryButtonColor }}
                    >
                      {confirmationPage.joinButtonLabel}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-[18px] text-[#5F6368]">{confirmationPage.addToCalendarLabel}</p>
          {calendarLinks ? (
            <div className="mt-5 flex flex-wrap justify-center gap-4">
              <CalendarPill href={calendarLinks.google} label="Google" color="#4285F4" />
              <CalendarPill href={calendarLinks.outlook} label="Outlook" color="#0F6CBD" />
              <CalendarPill href={calendarLinks.ics} label="iCal .ICS" color="#FF5A4A" />
              <CalendarPill href={calendarLinks.yahoo} label="Yahoo" color="#6F22B6" />
            </div>
          ) : null}
        </div>

        {confirmationPage.messengerUrl ? (
          <div className="mt-10 flex justify-center">
            <a
              href={confirmationPage.messengerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-[290px] justify-center rounded-[4px] bg-[#1EA7E8] px-8 py-4 text-[18px] font-semibold text-white"
            >
              {confirmationPage.messengerButtonLabel}
            </a>
          </div>
        ) : null}

        {!previewMode && firstName ? (
          <p className="mt-8 text-center text-sm text-[#6B7280]">
            Confirmation saved for <span className="font-semibold text-[#1F2A37]">{firstName}</span>.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function CalendarPill({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        +
      </span>
      <span className="text-[12px] text-[#6B7280]">{label}</span>
    </a>
  );
}
