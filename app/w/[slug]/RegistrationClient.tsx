"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerForWebinarAction } from "@/app/actions/registration-actions";
import {
  addDaysYMD,
  getZonedParts,
  isValidTimeZone,
  parseLocalTimeHHMM,
  zonedDateTimeToUtcDate,
} from "@/lib/utils/timezone";
import type { WebinarRegistrationPageConfig, WebinarSchedule } from "@/types/webinar";

type Props = {
  slug: string;
  title: string;
  schedule: WebinarSchedule;
  registrationPage: WebinarRegistrationPageConfig;
  embed: boolean;
  popup: boolean;
  preview: boolean;
};

type CountdownState = {
  heading: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const timezoneSubscribe = () => () => {};
const getServerTimezoneSnapshot = () => "UTC";
const getClientTimezoneSnapshot = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

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

function getScheduleEntries(schedule: WebinarSchedule) {
  const explicitEntries = Array.isArray(schedule.dayTimes)
    ? schedule.dayTimes
        .map((entry) => {
          const dayOfWeek = Number(entry.dayOfWeek);
          const time = String(entry.time ?? "").trim();
          const parsed = parseLocalTimeHHMM(time);
          if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !parsed) return null;
          return { dayOfWeek, parsed };
        })
        .filter((entry): entry is { dayOfWeek: number; parsed: { hour: number; minute: number } } => entry !== null)
    : [];
  if (explicitEntries.length > 0) return explicitEntries;

  const days = [...new Set(schedule.daysOfWeek)]
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  const parsedTimes = [...new Set(schedule.times)]
    .map((time) => parseLocalTimeHHMM(String(time).trim()))
    .filter((time): time is { hour: number; minute: number } => time !== null);

  if (days.length === 0 || parsedTimes.length === 0) return [];

  if (parsedTimes.length === 1) {
    return days.map((dayOfWeek) => ({ dayOfWeek, parsed: parsedTimes[0] }));
  }

  return days.map((dayOfWeek, index) => ({
    dayOfWeek,
    parsed: parsedTimes[Math.min(index, parsedTimes.length - 1)],
  }));
}

function computeNextScheduledStart(now: Date, schedule: WebinarSchedule, userTimeZone: string): Date {
  if (!isValidTimeZone(userTimeZone)) {
    throw new Error("Invalid user time zone");
  }

  const entries = getScheduleEntries(schedule);
  if (!entries.length) {
    throw new Error("Webinar schedule is not configured");
  }

  const nowParts = getZonedParts(now, userTimeZone);
  let nextStart: Date | null = null;

  for (const entry of entries) {
    let daysAhead = (entry.dayOfWeek - nowParts.weekday + 7) % 7;
    if (
      daysAhead === 0 &&
      hasPassedToday(nowParts.hour, nowParts.minute, entry.parsed.hour, entry.parsed.minute)
    ) {
      daysAhead = 7;
    }

    const targetDay = addDaysYMD(nowParts.year, nowParts.month, nowParts.day, daysAhead);
    const candidate = zonedDateTimeToUtcDate({
      timeZone: userTimeZone,
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

  if (!nextStart) {
    throw new Error("Webinar schedule is not configured");
  }

  return nextStart;
}

function formatHeading(date: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone,
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
    .format(date)
    .replace(" ", "")
    .toLowerCase();

  return `${day}, at ${time}`;
}

function computeCountdownState(
  now: Date,
  schedule: WebinarSchedule,
  userTimeZone: string
): CountdownState {
  const nextStart = computeNextScheduledStart(now, schedule, userTimeZone);
  const diff = Math.max(0, nextStart.getTime() - now.getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    heading: formatHeading(nextStart, userTimeZone),
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function fillTemplate(template: string, title: string) {
  return template.replace(/\{title\}/g, title);
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default function RegistrationClient({
  slug,
  title,
  schedule,
  registrationPage,
  embed,
  popup,
  preview,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const userTimeZone = useSyncExternalStore(
    timezoneSubscribe,
    getClientTimezoneSnapshot,
    getServerTimezoneSnapshot
  );
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const parentModalFallbackTimer = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    computeCountdownState(new Date(), schedule, getClientTimezoneSnapshot())
  );

  useEffect(() => {
    const update = () => {
      try {
        setCountdown(computeCountdownState(new Date(), schedule, userTimeZone));
      } catch {
        setCountdown({
          heading: "Schedule unavailable",
          days: "00",
          hours: "00",
          minutes: "00",
          seconds: "00",
        });
      }
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [schedule, userTimeZone]);

  useEffect(() => {
    if (!isModalOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsModalOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "OPEN_WEBINAR_MODAL_ACK") return;

      if (parentModalFallbackTimer.current !== null) {
        window.clearTimeout(parentModalFallbackTimer.current);
        parentModalFallbackTimer.current = null;
      }
      setIsModalOpen(false);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const content = useMemo(
    () => ({
      eyebrow: fillTemplate(registrationPage.eyebrow, title),
      heading: fillTemplate(registrationPage.heading, title),
      description: fillTemplate(registrationPage.description, title),
      modalHeading: fillTemplate(registrationPage.modalHeading, title),
      submitLabel: fillTemplate(registrationPage.submitLabel, title),
      ctaLabel: fillTemplate(registrationPage.ctaLabel, title),
      ctaSubLabel: fillTemplate(registrationPage.ctaSubLabel, title),
      phonePitchTitle: fillTemplate(registrationPage.phonePitchTitle, title),
      phonePitchBody: fillTemplate(registrationPage.phonePitchBody, title),
      disclaimerText: fillTemplate(registrationPage.disclaimerText, title),
    }),
    [registrationPage, title]
  );

  function openRegistrationModal() {
    const params = new URLSearchParams({ embed: "1", popup: "1" });
    if (preview) params.set("preview", "1");
    const popupUrl = `${window.location.origin}/w/${slug}?${params.toString()}`;
    if (embed && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "OPEN_WEBINAR_MODAL",
          url: popupUrl,
        },
        "*"
      );
      if (parentModalFallbackTimer.current !== null) {
        window.clearTimeout(parentModalFallbackTimer.current);
      }
      parentModalFallbackTimer.current = window.setTimeout(() => {
        setIsModalOpen(true);
        parentModalFallbackTimer.current = null;
      }, 300);
      return;
    }

    setIsModalOpen(true);
  }

  function closeRegistrationModal() {
    if (popup && window.parent !== window) {
      window.parent.postMessage({ type: "CLOSE_WEBINAR_MODAL" }, "*");
      return;
    }

    setIsModalOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhoneWarning(null);

    if (preview) {
      setError("Preview mode is active. Registration submissions are disabled.");
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      setPhoneWarning("Please enter a valid phone number.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await registerForWebinarAction({
          slug,
          firstName,
          lastName,
          email,
          phone: normalizedPhone,
          userTimeZone,
          isMobile,
        });
        if (popup && window.parent !== window) {
          window.top?.location.assign(`${window.location.origin}/confirm/${result.token}`);
          return;
        }
        router.push(`/confirm/${result.token}`);
      } catch {
        setError("Registration failed. Please try again.");
      }
    });
  }

  return (
    <>
      {!popup ? (
        <section
          className="overflow-hidden rounded-[20px] border border-[#e6ded2] bg-white shadow-[0_18px_48px_rgba(56,32,15,0.12)]"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          <div className={`bg-white text-center ${embed ? "px-4 py-6 sm:px-6 sm:py-7" : "px-5 py-10 sm:px-10 sm:py-12"}`}>
          {preview ? (
            <div className="mx-auto mb-4 inline-flex rounded-full bg-[#E8F5FF] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F6FA3]">
              Preview Mode
            </div>
          ) : null}
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: registrationPage.headingColor }}
          >
            {content.eyebrow}
          </p>
          <h1
            className="mt-3 text-[28px] font-bold leading-tight"
            style={{ color: registrationPage.headingColor }}
          >
            {countdown.heading}
          </h1>
          <p className="mt-4 text-base font-semibold text-slate-900">{content.heading}</p>
            {content.description ? (
              <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-6 text-slate-600">
                {content.description}
              </p>
            ) : null}

            <div className={`mx-auto max-w-3xl px-2 ${embed ? "mt-4 py-1" : "mt-5 py-3"}`}>
            <div className="grid grid-cols-4 gap-3 sm:gap-5">
              {[
                { label: "Days", value: countdown.days },
                { label: "Hours", value: countdown.hours },
                { label: "Minutes", value: countdown.minutes },
                { label: "Seconds", value: countdown.seconds },
              ].map((item) => (
                <div key={item.label} className="px-1 text-center">
                  <div className="text-[32px] font-bold leading-none text-slate-900">
                    {item.value}
                  </div>
                  <div className="mt-2 text-[12px] font-normal uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

            {registrationPage.arrowImageUrl ? (
              <div className={`${embed ? "mt-4" : "mt-7"} flex justify-center`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={registrationPage.arrowImageUrl}
                alt="Call to action arrow"
                className="h-auto max-w-[110px]"
              />
            </div>
          ) : null}

            <button
              type="button"
              onClick={openRegistrationModal}
              className={`inline-flex min-w-[220px] flex-col items-center rounded-[5px] px-[30px] py-[10px] text-center text-white transition-transform duration-200 hover:-translate-y-0.5 ${embed ? "mt-3" : "mt-4"}`}
              style={{ backgroundColor: registrationPage.accentColor }}
            >
              <span className="text-[15px] font-bold">{content.ctaLabel}</span>
              <span className="mt-1 text-[10px] font-normal text-white/90">
                {content.ctaSubLabel}
              </span>
            </button>
          </div>
        </section>
      ) : null}

      {popup || isModalOpen ? (
        <div
          className={popup ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"}
          onClick={popup ? undefined : closeRegistrationModal}
        >
          <div
            className={`relative w-full max-w-[600px] overflow-auto rounded-[10px] bg-white p-[30px] ${
              popup ? "" : "max-h-[90vh] shadow-2xl"
            }`}
            style={{ fontFamily: "Arial, sans-serif" }}
            onClick={popup ? undefined : (event) => event.stopPropagation()}
          >
            {!popup ? (
              <button
                type="button"
                onClick={closeRegistrationModal}
                className="absolute right-[15px] top-[10px] border-none bg-transparent text-[24px] text-slate-700"
                aria-label="Close registration form"
              >
                x
              </button>
            ) : null}

            <h2 className="mb-5 pr-8 text-center text-[24px] font-bold leading-tight text-slate-900">
              {content.modalHeading}
            </h2>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your First Name"
                  className="rounded-[5px] border border-[#ccc] px-[10px] py-[10px] text-[16px] outline-none"
                />
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your Last Name"
                  className="rounded-[5px] border border-[#ccc] px-[10px] py-[10px] text-[16px] outline-none"
                />
              </div>

              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Your Email Address"
                className="w-full rounded-[5px] border border-[#ccc] px-[10px] py-[10px] text-[16px] outline-none"
              />

              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your Mobile Number..."
                className={`w-full rounded-[5px] border px-[10px] py-[10px] text-[16px] outline-none ${
                  phoneWarning ? "border-red-500" : "border-[#ccc]"
                }`}
              />

              {phoneWarning ? (
                <p className="mt-[-10px] mb-[5px] text-[14px] text-red-600">{phoneWarning}</p>
              ) : null}

              <div className="text-center">
                <p className="my-[10px] text-[16px] font-bold text-slate-900">{content.phonePitchTitle}</p>
                {registrationPage.bonusImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={registrationPage.bonusImageUrl}
                      alt="Registration bonus"
                      className="w-full rounded-[8px] object-cover shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                    />
                  </>
                ) : null}
                <p className="mt-[10px] text-[14px] leading-6 text-slate-600">{content.phonePitchBody}</p>
              </div>

	              {preview ? (
	                <div className="rounded-[8px] border border-[#D6EAF8] bg-[#E8F5FF] px-4 py-3 text-[14px] text-[#2F6FA3]">
	                  Preview mode is active. This form will not create a registrant or trigger webhooks.
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isPending || preview}
                className="w-full rounded-[5px] px-[24px] py-[12px] text-[18px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: registrationPage.accentColor }}
              >
                {preview ? "Preview mode only" : isPending ? "Processing..." : content.submitLabel}
              </button>

              <p className="text-center text-[12px] text-slate-500">{content.disclaimerText}</p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
