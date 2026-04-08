"use server";

import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";
import type {
  WebinarBotConfig,
  WebinarConfirmationPageConfig,
  WebinarRegistrationPageConfig,
  WebinarRedirectConfig,
  WebinarSchedule,
  WebinarWebhook,
} from "@/types/webinar";

type WebinarInput = {
  title?: unknown;
  slug?: unknown;
  videoPublicPath?: unknown;
  durationSec?: unknown;
  lateGraceMinutes?: unknown;
  schedule?: unknown;
  webhook?: unknown;
  redirect?: unknown;
  bot?: unknown;
  webhookEnabled?: unknown;
  webhookUrl?: unknown;
  redirectEnabled?: unknown;
  redirectUrl?: unknown;
  botEnabled?: unknown;
  botName?: unknown;
  botLink?: unknown;
  botApiKey?: unknown;
  botConversationId?: unknown;
  botActivationDelaySec?: unknown;
  registrationPage?: unknown;
  confirmationPage?: unknown;
  registrationPageEyebrow?: unknown;
  registrationPageHeading?: unknown;
  registrationPageDescription?: unknown;
  registrationPageCtaLabel?: unknown;
  registrationPageCtaSubLabel?: unknown;
  registrationPageModalHeading?: unknown;
  registrationPageSubmitLabel?: unknown;
  registrationPageDisclaimerText?: unknown;
  registrationPagePhonePitchTitle?: unknown;
  registrationPagePhonePitchBody?: unknown;
  registrationPageArrowImageUrl?: unknown;
  registrationPageBonusImageUrl?: unknown;
  registrationPageAccentColor?: unknown;
  registrationPageHeadingColor?: unknown;
  confirmationPageHeadline?: unknown;
  confirmationPageStepBannerText?: unknown;
  confirmationPageIntroText?: unknown;
  confirmationPageScheduleHeading?: unknown;
  confirmationPageScheduledTimeLabel?: unknown;
  confirmationPageCountdownLabel?: unknown;
  confirmationPageJoinButtonLabel?: unknown;
  confirmationPageAddToCalendarLabel?: unknown;
  confirmationPageMessengerButtonLabel?: unknown;
  confirmationPageMessengerUrl?: unknown;
  confirmationPageMediaSource?: unknown;
  confirmationPageMediaType?: unknown;
  confirmationPageMediaUrl?: unknown;
  confirmationPageMediaPosition?: unknown;
  confirmationPageHeadlineColor?: unknown;
  confirmationPageBannerColor?: unknown;
  confirmationPagePrimaryButtonColor?: unknown;
  timezoneBase?: unknown;
  daysOfWeek?: unknown;
  times?: unknown;
  liveWindowMinutes?: unknown;
  scheduleType?: unknown;
  scheduleLocalTime?: unknown;
  scheduleWeekday?: unknown;
};

export type WebinarView = {
  webinarId: string;
  id: string;
  slug: string;
  title: string;
  videoPublicPath: string;
  durationSec: number;
  lateGraceMinutes: number;
  schedule: WebinarSchedule;
  scheduleType: "weekly" | "daily";
  scheduleLocalTime: string;
  scheduleWeekday?: number;
  webhook: WebinarWebhook;
  redirect: WebinarRedirectConfig;
  bot?: WebinarBotConfig;
  registrationPage: WebinarRegistrationPageConfig;
  confirmationPage: WebinarConfirmationPageConfig;
};

export type WebinarListItem = {
  webinarId: string;
  title: string;
  slug: string;
  updatedAt: string | null;
};

export type WebinarRecord = {
  webinarId: string;
  slug: string;
  title: string;
  videoPublicPath: string;
  durationSec: number;
  lateGraceMinutes: number;
  schedule: WebinarSchedule;
  scheduleType: "weekly" | "daily";
  scheduleLocalTime: string;
  scheduleWeekday?: number;
  webhook: WebinarWebhook;
  redirect: WebinarRedirectConfig;
  bot: WebinarBotConfig;
  registrationPage: WebinarRegistrationPageConfig;
  confirmationPage: WebinarConfirmationPageConfig;
  createdAt: string | null;
  updatedAt: string | null;
};

const DEFAULT_TIMEZONE_BASE = "Asia/Manila";
const DEFAULT_LIVE_WINDOW_MINUTES = 120;
const DEFAULT_LATE_GRACE_MINUTES = 15;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_REGISTRATION_PAGE: WebinarRegistrationPageConfig = {
  eyebrow: "Live Workshop Access",
  heading: "Secure your seat for {title}",
  description: "",
  ctaLabel: "Click to Sign Up",
  ctaSubLabel: "Step #1: click here",
  modalHeading: "Secure Your Seat For {title}",
  submitLabel: "Reserve My Seat",
  disclaimerText: "* we will not spam, rent, or sell your information... *",
  phonePitchTitle: "Free Prizes Just For Registering With Your Cell #!!!",
  phonePitchBody:
    "We ask for your mobile number so we can send reminders and contact giveaway winners.",
  arrowImageUrl:
    "https://onlinebroadcastpro.com/wp-content/uploads/2025/07/arrows-green.webp",
  bonusImageUrl:
    "https://onlinebroadcastpro.com/wp-content/uploads/2025/07/Screen-Shot-2022-04-10-at-1.30.11-PM.webp",
  accentColor: "#ff0000",
  headingColor: "#2d0d5c",
};

const DEFAULT_CONFIRMATION_PAGE: WebinarConfirmationPageConfig = {
  headline: "You will Buy Your Dream Cottage For Free & Rent It Some Of The Time, To Cover Expenses!",
  stepBannerText: "STEP #2: Watch This Quick Video",
  introText: "Your event will begin in (This page will automatically be redirected):",
  scheduleHeading: "Confirmation: Your Webinar Schedule",
  scheduledTimeLabel: "Scheduled Time:",
  countdownLabel: "Webinar starts in:",
  joinButtonLabel: "Join Webinar",
  addToCalendarLabel: "Add to Calendar",
  messengerButtonLabel: "Connect to Messenger",
  messengerUrl: "",
  mediaSource: "self-hosted",
  mediaType: "video",
  mediaUrl: "",
  mediaPosition: "left",
  headlineColor: "#000000",
  bannerColor: "#ff1a12",
  primaryButtonColor: "#8f8f8f",
};

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function toCleanString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function toOptionalPositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor(value);
  }

  const raw = toCleanString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toCleanString(item)).filter(Boolean);
  }

  const raw = toCleanString(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toWeekdayArray(value: unknown): number[] {
  const numbers =
    Array.isArray(value) || typeof value === "string"
      ? toStringArray(value).map((entry) => Number(entry))
      : typeof value === "number"
      ? [value]
      : [];

  const unique = [...new Set(numbers)];
  const valid = unique.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return valid.sort((a, b) => a - b);
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

function fromLegacyScheduleFields(input: WebinarInput): Partial<WebinarSchedule> {
  const scheduleType = toCleanString(input.scheduleType);
  const scheduleLocalTime = toCleanString(input.scheduleLocalTime);
  const scheduleWeekdayRaw = Number(toCleanString(input.scheduleWeekday));

  const next: Partial<WebinarSchedule> = {};
  if (scheduleLocalTime) next.times = [scheduleLocalTime];
  if (scheduleType === "daily") {
    next.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  } else if (Number.isInteger(scheduleWeekdayRaw) && scheduleWeekdayRaw >= 0 && scheduleWeekdayRaw <= 6) {
    next.daysOfWeek = [scheduleWeekdayRaw];
  }
  return next;
}

function parseInput(formDataOrTypedInput: FormData | WebinarInput): WebinarInput {
  if (formDataOrTypedInput instanceof FormData) {
    const days = formDataOrTypedInput.getAll("schedule.daysOfWeek");
    const times = formDataOrTypedInput.getAll("schedule.times");
    const webhookEnabledValues = formDataOrTypedInput.getAll("webhook.enabled");
    const redirectEnabledValues = formDataOrTypedInput.getAll("redirect.enabled");
    const botEnabledValues = formDataOrTypedInput.getAll("bot.enabled");

    return {
      title: formDataOrTypedInput.get("title"),
      slug: formDataOrTypedInput.get("slug"),
      videoPublicPath: formDataOrTypedInput.get("videoPublicPath"),
      durationSec: formDataOrTypedInput.get("durationSec"),
      lateGraceMinutes: formDataOrTypedInput.get("lateGraceMinutes"),
      webhook: {
        enabled:
          (webhookEnabledValues.length
            ? webhookEnabledValues[webhookEnabledValues.length - 1]
            : formDataOrTypedInput.get("webhookEnabled")) ?? undefined,
        url: formDataOrTypedInput.get("webhook.url") ?? formDataOrTypedInput.get("webhookUrl"),
      },
      redirect: {
        enabled:
          (redirectEnabledValues.length
            ? redirectEnabledValues[redirectEnabledValues.length - 1]
            : formDataOrTypedInput.get("redirectEnabled")) ?? undefined,
        url: formDataOrTypedInput.get("redirect.url") ?? formDataOrTypedInput.get("redirectUrl"),
      },
      bot: {
        enabled:
          (botEnabledValues.length
            ? botEnabledValues[botEnabledValues.length - 1]
            : formDataOrTypedInput.get("botEnabled")) ?? undefined,
        name: formDataOrTypedInput.get("bot.name") ?? formDataOrTypedInput.get("botName"),
        link: formDataOrTypedInput.get("bot.link") ?? formDataOrTypedInput.get("botLink"),
        apiKey: formDataOrTypedInput.get("bot.apiKey") ?? formDataOrTypedInput.get("botApiKey"),
        conversationId:
          formDataOrTypedInput.get("bot.conversationId") ??
          formDataOrTypedInput.get("botConversationId"),
        activationDelaySec:
          formDataOrTypedInput.get("bot.activationDelaySec") ??
          formDataOrTypedInput.get("botActivationDelaySec"),
      },
      schedule: {
        timezoneBase:
          formDataOrTypedInput.get("schedule.timezoneBase") ??
          formDataOrTypedInput.get("timezoneBase"),
        daysOfWeek: days.length
          ? days
          : formDataOrTypedInput.get("daysOfWeek") ?? formDataOrTypedInput.get("schedule.daysOfWeek"),
        times: times.length
          ? times
          : formDataOrTypedInput.get("times") ?? formDataOrTypedInput.get("schedule.times"),
        liveWindowMinutes:
          formDataOrTypedInput.get("schedule.liveWindowMinutes") ??
          formDataOrTypedInput.get("liveWindowMinutes"),
      },
      registrationPage: {
        eyebrow:
          formDataOrTypedInput.get("registrationPage.eyebrow") ??
          formDataOrTypedInput.get("registrationPageEyebrow"),
        heading:
          formDataOrTypedInput.get("registrationPage.heading") ??
          formDataOrTypedInput.get("registrationPageHeading"),
        description:
          formDataOrTypedInput.get("registrationPage.description") ??
          formDataOrTypedInput.get("registrationPageDescription"),
        ctaLabel:
          formDataOrTypedInput.get("registrationPage.ctaLabel") ??
          formDataOrTypedInput.get("registrationPageCtaLabel"),
        ctaSubLabel:
          formDataOrTypedInput.get("registrationPage.ctaSubLabel") ??
          formDataOrTypedInput.get("registrationPageCtaSubLabel"),
        modalHeading:
          formDataOrTypedInput.get("registrationPage.modalHeading") ??
          formDataOrTypedInput.get("registrationPageModalHeading"),
        submitLabel:
          formDataOrTypedInput.get("registrationPage.submitLabel") ??
          formDataOrTypedInput.get("registrationPageSubmitLabel"),
        disclaimerText:
          formDataOrTypedInput.get("registrationPage.disclaimerText") ??
          formDataOrTypedInput.get("registrationPageDisclaimerText"),
        phonePitchTitle:
          formDataOrTypedInput.get("registrationPage.phonePitchTitle") ??
          formDataOrTypedInput.get("registrationPagePhonePitchTitle"),
        phonePitchBody:
          formDataOrTypedInput.get("registrationPage.phonePitchBody") ??
          formDataOrTypedInput.get("registrationPagePhonePitchBody"),
        arrowImageUrl:
          formDataOrTypedInput.get("registrationPage.arrowImageUrl") ??
          formDataOrTypedInput.get("registrationPageArrowImageUrl"),
        bonusImageUrl:
          formDataOrTypedInput.get("registrationPage.bonusImageUrl") ??
          formDataOrTypedInput.get("registrationPageBonusImageUrl"),
        accentColor:
          formDataOrTypedInput.get("registrationPage.accentColor") ??
          formDataOrTypedInput.get("registrationPageAccentColor"),
        headingColor:
          formDataOrTypedInput.get("registrationPage.headingColor") ??
          formDataOrTypedInput.get("registrationPageHeadingColor"),
      },
      confirmationPage: {
        headline:
          formDataOrTypedInput.get("confirmationPage.headline") ??
          formDataOrTypedInput.get("confirmationPageHeadline"),
        stepBannerText:
          formDataOrTypedInput.get("confirmationPage.stepBannerText") ??
          formDataOrTypedInput.get("confirmationPageStepBannerText"),
        introText:
          formDataOrTypedInput.get("confirmationPage.introText") ??
          formDataOrTypedInput.get("confirmationPageIntroText"),
        scheduleHeading:
          formDataOrTypedInput.get("confirmationPage.scheduleHeading") ??
          formDataOrTypedInput.get("confirmationPageScheduleHeading"),
        scheduledTimeLabel:
          formDataOrTypedInput.get("confirmationPage.scheduledTimeLabel") ??
          formDataOrTypedInput.get("confirmationPageScheduledTimeLabel"),
        countdownLabel:
          formDataOrTypedInput.get("confirmationPage.countdownLabel") ??
          formDataOrTypedInput.get("confirmationPageCountdownLabel"),
        joinButtonLabel:
          formDataOrTypedInput.get("confirmationPage.joinButtonLabel") ??
          formDataOrTypedInput.get("confirmationPageJoinButtonLabel"),
        addToCalendarLabel:
          formDataOrTypedInput.get("confirmationPage.addToCalendarLabel") ??
          formDataOrTypedInput.get("confirmationPageAddToCalendarLabel"),
        messengerButtonLabel:
          formDataOrTypedInput.get("confirmationPage.messengerButtonLabel") ??
          formDataOrTypedInput.get("confirmationPageMessengerButtonLabel"),
        messengerUrl:
          formDataOrTypedInput.get("confirmationPage.messengerUrl") ??
          formDataOrTypedInput.get("confirmationPageMessengerUrl"),
        mediaSource:
          formDataOrTypedInput.get("confirmationPage.mediaSource") ??
          formDataOrTypedInput.get("confirmationPageMediaSource"),
        mediaType:
          formDataOrTypedInput.get("confirmationPage.mediaType") ??
          formDataOrTypedInput.get("confirmationPageMediaType"),
        mediaUrl:
          formDataOrTypedInput.get("confirmationPage.mediaUrl") ??
          formDataOrTypedInput.get("confirmationPageMediaUrl"),
        mediaPosition:
          formDataOrTypedInput.get("confirmationPage.mediaPosition") ??
          formDataOrTypedInput.get("confirmationPageMediaPosition"),
        headlineColor:
          formDataOrTypedInput.get("confirmationPage.headlineColor") ??
          formDataOrTypedInput.get("confirmationPageHeadlineColor"),
        bannerColor:
          formDataOrTypedInput.get("confirmationPage.bannerColor") ??
          formDataOrTypedInput.get("confirmationPageBannerColor"),
        primaryButtonColor:
          formDataOrTypedInput.get("confirmationPage.primaryButtonColor") ??
          formDataOrTypedInput.get("confirmationPagePrimaryButtonColor"),
      },
      scheduleType: formDataOrTypedInput.get("scheduleType"),
      scheduleLocalTime: formDataOrTypedInput.get("scheduleLocalTime"),
      scheduleWeekday: formDataOrTypedInput.get("scheduleWeekday"),
    };
  }

  return formDataOrTypedInput;
}

function toWebhookEnabled(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  const clean = toCleanString(value).toLowerCase();
  if (!clean) return fallback;
  return clean === "true" || clean === "1" || clean === "on" || clean === "yes";
}

function normalizeWebhook(input: WebinarInput, existing?: WebinarWebhook): WebinarWebhook {
  const webhookInput =
    input.webhook && typeof input.webhook === "object"
      ? (input.webhook as Record<string, unknown>)
      : {};

  const enabled = toWebhookEnabled(
    webhookInput.enabled ?? input.webhookEnabled,
    existing?.enabled ?? false
  );
  const url = toCleanString(webhookInput.url ?? input.webhookUrl ?? existing?.url ?? "");
  const confirmationBaseUrl = toCleanString(
    webhookInput.confirmationBaseUrl ?? existing?.confirmationBaseUrl ?? ""
  );

  if (enabled) {
    if (!url) throw new Error("webhook.url is required when webhook is enabled");
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("webhook.url must start with http:// or https://");
    }
  }

  if (confirmationBaseUrl) {
    return { enabled, url, confirmationBaseUrl };
  }
  return { enabled, url };
}

function normalizeRedirect(
  input: WebinarInput,
  existing?: WebinarRedirectConfig
): WebinarRedirectConfig {
  const redirectInput =
    input.redirect && typeof input.redirect === "object"
      ? (input.redirect as Record<string, unknown>)
      : {};

  const enabled = toWebhookEnabled(
    redirectInput.enabled ?? input.redirectEnabled,
    existing?.enabled ?? false
  );
  const url = toCleanString(redirectInput.url ?? input.redirectUrl ?? existing?.url ?? "");

  if (enabled) {
    if (!url) throw new Error("redirect.url is required when redirect after webinar is enabled");
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("redirect.url must start with http:// or https://");
    }
  }

  return { enabled, url };
}

function normalizeBot(input: WebinarInput, existing?: WebinarBotConfig): WebinarBotConfig {
  const botInput =
    input.bot && typeof input.bot === "object" ? (input.bot as Record<string, unknown>) : {};

  const enabled = toWebhookEnabled(botInput.enabled ?? input.botEnabled, existing?.enabled ?? false);
  const name = toCleanString(botInput.name ?? input.botName ?? existing?.name ?? "");
  const link = toCleanString(botInput.link ?? input.botLink ?? existing?.link ?? "");
  const apiKey = toCleanString(botInput.apiKey ?? input.botApiKey ?? existing?.apiKey ?? "");
  const conversationId = toCleanString(
    botInput.conversationId ?? input.botConversationId ?? existing?.conversationId ?? ""
  );
  const activationDelaySec =
    toOptionalPositiveInt(
      botInput.activationDelaySec ??
        input.botActivationDelaySec ??
        existing?.activationDelaySec ??
        60
    ) ?? 60;

  if (enabled) {
    if (!name) throw new Error("bot.name is required when AI chat bot is enabled");
    if (!apiKey) throw new Error("bot.apiKey is required when AI chat bot is enabled");
    if (!conversationId) {
      throw new Error("bot.conversationId is required when AI chat bot is enabled");
    }
  }

  const normalized: WebinarBotConfig = {
    enabled,
    name,
    apiKey,
    conversationId,
    activationDelaySec,
  };
  if (link) {
    normalized.link = link;
  }
  return normalized;
}

function normalizeRegistrationPage(
  input: WebinarInput,
  existing?: WebinarRegistrationPageConfig
): WebinarRegistrationPageConfig {
  const registrationPageInput =
    input.registrationPage && typeof input.registrationPage === "object"
      ? (input.registrationPage as Record<string, unknown>)
      : {};
  const base = existing ?? DEFAULT_REGISTRATION_PAGE;

  return {
    eyebrow: toCleanString(
      registrationPageInput.eyebrow ?? input.registrationPageEyebrow ?? base.eyebrow
    ),
    heading: toCleanString(
      registrationPageInput.heading ?? input.registrationPageHeading ?? base.heading
    ),
    description: toCleanString(
      registrationPageInput.description ??
        input.registrationPageDescription ??
        base.description
    ),
    ctaLabel: toCleanString(
      registrationPageInput.ctaLabel ?? input.registrationPageCtaLabel ?? base.ctaLabel
    ),
    ctaSubLabel: toCleanString(
      registrationPageInput.ctaSubLabel ??
        input.registrationPageCtaSubLabel ??
        base.ctaSubLabel
    ),
    modalHeading: toCleanString(
      registrationPageInput.modalHeading ??
        input.registrationPageModalHeading ??
        base.modalHeading
    ),
    submitLabel: toCleanString(
      registrationPageInput.submitLabel ??
        input.registrationPageSubmitLabel ??
        base.submitLabel
    ),
    disclaimerText: toCleanString(
      registrationPageInput.disclaimerText ??
        input.registrationPageDisclaimerText ??
        base.disclaimerText
    ),
    phonePitchTitle: toCleanString(
      registrationPageInput.phonePitchTitle ??
        input.registrationPagePhonePitchTitle ??
        base.phonePitchTitle
    ),
    phonePitchBody: toCleanString(
      registrationPageInput.phonePitchBody ??
        input.registrationPagePhonePitchBody ??
        base.phonePitchBody
    ),
    arrowImageUrl: toCleanString(
      registrationPageInput.arrowImageUrl ??
        input.registrationPageArrowImageUrl ??
        base.arrowImageUrl
    ),
    bonusImageUrl: toCleanString(
      registrationPageInput.bonusImageUrl ??
        input.registrationPageBonusImageUrl ??
        base.bonusImageUrl
    ),
    accentColor: toCleanString(
      registrationPageInput.accentColor ??
        input.registrationPageAccentColor ??
        base.accentColor
    ),
    headingColor: toCleanString(
      registrationPageInput.headingColor ??
        input.registrationPageHeadingColor ??
        base.headingColor
    ),
  };
}

function normalizeConfirmationPage(
  input: WebinarInput,
  existing?: WebinarConfirmationPageConfig
): WebinarConfirmationPageConfig {
  const confirmationPageInput =
    input.confirmationPage && typeof input.confirmationPage === "object"
      ? (input.confirmationPage as Record<string, unknown>)
      : {};
  const base = existing ?? DEFAULT_CONFIRMATION_PAGE;
  const mediaType = toCleanString(
    confirmationPageInput.mediaType ?? input.confirmationPageMediaType ?? base.mediaType
  );
  const mediaSource = toCleanString(
    confirmationPageInput.mediaSource ?? input.confirmationPageMediaSource ?? base.mediaSource
  );
  const mediaPosition = toCleanString(
    confirmationPageInput.mediaPosition ?? input.confirmationPageMediaPosition ?? base.mediaPosition
  );
  const resolvedMediaSource = mediaSource === "external" ? "external" : "self-hosted";
  const resolvedMediaType =
    resolvedMediaSource === "external" ? "video" : mediaType === "image" ? "image" : "video";
  const mediaUrl = toCleanString(
    confirmationPageInput.mediaUrl ?? input.confirmationPageMediaUrl ?? base.mediaUrl
  );

  if (resolvedMediaSource === "external" && mediaUrl && !isSupportedExternalVideoUrl(mediaUrl)) {
    throw new Error("External confirmation media only supports YouTube or Vimeo video links");
  }

  return {
    headline: toCleanString(
      confirmationPageInput.headline ?? input.confirmationPageHeadline ?? base.headline
    ),
    stepBannerText: toCleanString(
      confirmationPageInput.stepBannerText ??
        input.confirmationPageStepBannerText ??
        base.stepBannerText
    ),
    introText: toCleanString(
      confirmationPageInput.introText ?? input.confirmationPageIntroText ?? base.introText
    ),
    scheduleHeading: toCleanString(
      confirmationPageInput.scheduleHeading ??
        input.confirmationPageScheduleHeading ??
        base.scheduleHeading
    ),
    scheduledTimeLabel: toCleanString(
      confirmationPageInput.scheduledTimeLabel ??
        input.confirmationPageScheduledTimeLabel ??
        base.scheduledTimeLabel
    ),
    countdownLabel: toCleanString(
      confirmationPageInput.countdownLabel ??
        input.confirmationPageCountdownLabel ??
        base.countdownLabel
    ),
    joinButtonLabel: toCleanString(
      confirmationPageInput.joinButtonLabel ??
        input.confirmationPageJoinButtonLabel ??
        base.joinButtonLabel
    ),
    addToCalendarLabel: toCleanString(
      confirmationPageInput.addToCalendarLabel ??
        input.confirmationPageAddToCalendarLabel ??
        base.addToCalendarLabel
    ),
    messengerButtonLabel: toCleanString(
      confirmationPageInput.messengerButtonLabel ??
        input.confirmationPageMessengerButtonLabel ??
        base.messengerButtonLabel
    ),
    messengerUrl: toCleanString(
      confirmationPageInput.messengerUrl ??
        input.confirmationPageMessengerUrl ??
        base.messengerUrl
    ),
    mediaSource: resolvedMediaSource,
    mediaType: resolvedMediaType,
    mediaUrl,
    mediaPosition: mediaPosition === "right" ? "right" : "left",
    headlineColor: toCleanString(
      confirmationPageInput.headlineColor ??
        input.confirmationPageHeadlineColor ??
        base.headlineColor
    ),
    bannerColor: toCleanString(
      confirmationPageInput.bannerColor ??
        input.confirmationPageBannerColor ??
        base.bannerColor
    ),
    primaryButtonColor: toCleanString(
      confirmationPageInput.primaryButtonColor ??
        input.confirmationPagePrimaryButtonColor ??
        base.primaryButtonColor
    ),
  };
}

function isSupportedExternalVideoUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "youtu.be" || host.includes("youtube.com") || host.includes("vimeo.com");
  } catch {
    return false;
  }
}

function normalizeSchedule(input: WebinarInput, existing?: WebinarSchedule): WebinarSchedule {
  const scheduleInput =
    input.schedule && typeof input.schedule === "object"
      ? (input.schedule as Record<string, unknown>)
      : {};
  const legacy = fromLegacyScheduleFields(input);

  const timezoneBase = toCleanString(
    scheduleInput.timezoneBase ?? input.timezoneBase ?? existing?.timezoneBase ?? DEFAULT_TIMEZONE_BASE
  );
  const daysOfWeek = toWeekdayArray(
    scheduleInput.daysOfWeek ?? input.daysOfWeek ?? legacy.daysOfWeek ?? existing?.daysOfWeek ?? []
  );
  const times = toStringArray(
    scheduleInput.times ?? input.times ?? legacy.times ?? existing?.times ?? []
  );
  const liveWindowMinutes =
    toOptionalPositiveInt(
      scheduleInput.liveWindowMinutes ??
        input.liveWindowMinutes ??
        existing?.liveWindowMinutes ??
        DEFAULT_LIVE_WINDOW_MINUTES
    ) ?? DEFAULT_LIVE_WINDOW_MINUTES;

  if (!timezoneBase) throw new Error("schedule.timezoneBase is required");
  if (daysOfWeek.length === 0) throw new Error("schedule.daysOfWeek must contain at least one day");
  if (times.length === 0) throw new Error("schedule.times must contain at least one time");
  for (const time of times) {
    if (!TIME_REGEX.test(time)) {
      throw new Error(`Invalid schedule time "${time}", expected HH:mm`);
    }
  }

  return {
    timezoneBase,
    daysOfWeek,
    times: [...new Set(times)],
    liveWindowMinutes,
  };
}

function asLegacySchedule(schedule: WebinarSchedule): {
  scheduleType: "weekly" | "daily";
  scheduleLocalTime: string;
  scheduleWeekday?: number;
} {
  const daily = schedule.daysOfWeek.length === 7;
  return {
    scheduleType: daily ? "daily" : "weekly",
    scheduleLocalTime: schedule.times[0] ?? "20:00",
    scheduleWeekday: daily ? undefined : schedule.daysOfWeek[0],
  };
}

function assertRequiredForCreate(input: WebinarInput) {
  if (!toCleanString(input.title)) throw new Error("title is required");
  if (!toCleanString(input.slug)) throw new Error("slug is required");
  const videoPublicPath = toCleanString(input.videoPublicPath);
  if (videoPublicPath) {
    assertPublicVideoPath(videoPublicPath);
  }
  if (toOptionalPositiveInt(input.durationSec) === null) {
    throw new Error("durationSec must be a positive number");
  }
}

function normalizeLateGraceMinutes(input: WebinarInput, existing?: number): number {
  return (
    toOptionalPositiveInt(input.lateGraceMinutes ?? existing ?? DEFAULT_LATE_GRACE_MINUTES) ??
    DEFAULT_LATE_GRACE_MINUTES
  );
}

async function assertUniqueSlug(slug: string, webinarIdToIgnore?: string) {
  const snap = await adminDb.collection("webinars").where("slug", "==", slug).limit(2).get();
  const conflictingDoc = snap.docs.find((doc) => doc.id !== webinarIdToIgnore);
  if (conflictingDoc) {
    throw new Error(`slug "${slug}" is already in use`);
  }
}

function parseStoredSchedule(raw: FirebaseFirestore.DocumentData): WebinarSchedule {
  const fromObject = raw.schedule && typeof raw.schedule === "object"
    ? (raw.schedule as Record<string, unknown>)
    : {};

  const fallbackDays =
    raw.scheduleType === "daily"
      ? [0, 1, 2, 3, 4, 5, 6]
      : typeof raw.scheduleWeekday === "number"
      ? [Number(raw.scheduleWeekday)]
      : [3];
  const fallbackTimes = [String(raw.scheduleLocalTime ?? "20:00")];

  return normalizeSchedule(
    {
      schedule: {
        timezoneBase: fromObject.timezoneBase ?? DEFAULT_TIMEZONE_BASE,
        daysOfWeek: fromObject.daysOfWeek ?? fallbackDays,
        times: fromObject.times ?? fallbackTimes,
        liveWindowMinutes: fromObject.liveWindowMinutes ?? DEFAULT_LIVE_WINDOW_MINUTES,
      },
    },
    undefined
  );
}

function parseStoredWebhook(raw: FirebaseFirestore.DocumentData): WebinarWebhook {
  const webhookRaw =
    raw.webhook && typeof raw.webhook === "object"
      ? (raw.webhook as Record<string, unknown>)
      : {};
  const enabled = toWebhookEnabled(webhookRaw.enabled, false);
  const url = toCleanString(webhookRaw.url);
  const confirmationBaseUrl = toCleanString(webhookRaw.confirmationBaseUrl);
  if (confirmationBaseUrl) {
    return { enabled, url, confirmationBaseUrl };
  }
  return { enabled, url };
}

function parseStoredRedirect(raw: FirebaseFirestore.DocumentData): WebinarRedirectConfig {
  const redirectRaw =
    raw.redirect && typeof raw.redirect === "object"
      ? (raw.redirect as Record<string, unknown>)
      : {};

  return normalizeRedirect(
    {
      redirect: {
        enabled: redirectRaw.enabled,
        url: redirectRaw.url,
      },
    },
    {
      enabled: false,
      url: "",
    }
  );
}

function parseStoredBot(raw: FirebaseFirestore.DocumentData): WebinarBotConfig {
  const botRaw =
    raw.bot && typeof raw.bot === "object" ? (raw.bot as Record<string, unknown>) : {};

  return normalizeBot(
    {
      bot: {
        enabled: botRaw.enabled,
        name: botRaw.name,
        link: botRaw.link,
        apiKey: botRaw.apiKey,
        conversationId: botRaw.conversationId,
        activationDelaySec: botRaw.activationDelaySec,
      },
    },
    {
      enabled: false,
      name: "",
      link: undefined,
      apiKey: "",
      conversationId: "",
      activationDelaySec: 60,
    }
  );
}

function parseStoredRegistrationPage(
  raw: FirebaseFirestore.DocumentData
): WebinarRegistrationPageConfig {
  const registrationPageRaw =
    raw.registrationPage && typeof raw.registrationPage === "object"
      ? (raw.registrationPage as Record<string, unknown>)
      : {};

  return normalizeRegistrationPage(
    {
      registrationPage: {
        eyebrow: registrationPageRaw.eyebrow,
        heading: registrationPageRaw.heading,
        description: registrationPageRaw.description,
        ctaLabel: registrationPageRaw.ctaLabel,
        ctaSubLabel: registrationPageRaw.ctaSubLabel,
        modalHeading: registrationPageRaw.modalHeading,
        submitLabel: registrationPageRaw.submitLabel,
        disclaimerText: registrationPageRaw.disclaimerText,
        phonePitchTitle: registrationPageRaw.phonePitchTitle,
        phonePitchBody: registrationPageRaw.phonePitchBody,
        arrowImageUrl: registrationPageRaw.arrowImageUrl,
        bonusImageUrl: registrationPageRaw.bonusImageUrl,
        accentColor: registrationPageRaw.accentColor,
        headingColor: registrationPageRaw.headingColor,
      },
    },
    DEFAULT_REGISTRATION_PAGE
  );
}

function parseStoredConfirmationPage(
  raw: FirebaseFirestore.DocumentData
): WebinarConfirmationPageConfig {
  const confirmationPageRaw =
    raw.confirmationPage && typeof raw.confirmationPage === "object"
      ? (raw.confirmationPage as Record<string, unknown>)
      : {};

  return normalizeConfirmationPage(
    {
      confirmationPage: {
        headline: confirmationPageRaw.headline,
        stepBannerText: confirmationPageRaw.stepBannerText,
        introText: confirmationPageRaw.introText,
        scheduleHeading: confirmationPageRaw.scheduleHeading,
        scheduledTimeLabel: confirmationPageRaw.scheduledTimeLabel,
        countdownLabel: confirmationPageRaw.countdownLabel,
        joinButtonLabel: confirmationPageRaw.joinButtonLabel,
        addToCalendarLabel: confirmationPageRaw.addToCalendarLabel,
        messengerButtonLabel: confirmationPageRaw.messengerButtonLabel,
        messengerUrl: confirmationPageRaw.messengerUrl,
        mediaSource: confirmationPageRaw.mediaSource,
        mediaType: confirmationPageRaw.mediaType,
        mediaUrl: confirmationPageRaw.mediaUrl,
        mediaPosition: confirmationPageRaw.mediaPosition,
        headlineColor: confirmationPageRaw.headlineColor,
        bannerColor: confirmationPageRaw.bannerColor,
        primaryButtonColor: confirmationPageRaw.primaryButtonColor,
      },
    },
    DEFAULT_CONFIRMATION_PAGE
  );
}

function toWebinarView(docId: string, raw: FirebaseFirestore.DocumentData): WebinarView {
  const schedule = parseStoredSchedule(raw);
  const webhook = parseStoredWebhook(raw);
  const redirect = parseStoredRedirect(raw);
  const registrationPage = parseStoredRegistrationPage(raw);
  const confirmationPage = parseStoredConfirmationPage(raw);
  const legacy = asLegacySchedule(schedule);
  return {
    webinarId: docId,
    id: docId,
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    videoPublicPath: String(raw.videoPublicPath ?? ""),
    durationSec: Number(raw.durationSec ?? 0),
    lateGraceMinutes: normalizeLateGraceMinutes(
      { lateGraceMinutes: raw.lateGraceMinutes },
      DEFAULT_LATE_GRACE_MINUTES
    ),
    schedule,
    scheduleType: legacy.scheduleType,
    scheduleLocalTime: legacy.scheduleLocalTime,
    scheduleWeekday: legacy.scheduleWeekday,
    webhook,
    redirect,
    registrationPage,
    confirmationPage,
  };
}

export async function createWebinarAction(formDataOrTypedInput: FormData | WebinarInput) {
  const input = parseInput(formDataOrTypedInput);
  assertRequiredForCreate(input);

  const title = toCleanString(input.title);
  const slug = toCleanString(input.slug);
  const videoPublicPath = toCleanString(input.videoPublicPath);
  const durationSec = toOptionalPositiveInt(input.durationSec);
  if (durationSec === null) {
    throw new Error("durationSec must be a positive number");
  }
  const lateGraceMinutes = normalizeLateGraceMinutes(input);

  const schedule = normalizeSchedule(input);
  const webhook = normalizeWebhook(input);
  const redirect = normalizeRedirect(input);
  const bot = normalizeBot(input);
  const registrationPage = normalizeRegistrationPage(input);
  const confirmationPage = normalizeConfirmationPage(input);
  await assertUniqueSlug(slug);

  const ref = adminDb.collection("webinars").doc();
  await ref.set({
    title,
    slug,
    videoPublicPath,
    durationSec,
    lateGraceMinutes,
    schedule,
    webhook,
    redirect,
    bot,
    registrationPage,
    confirmationPage,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { webinarId: ref.id };
}

export async function updateWebinarAction(
  webinarId: string,
  formDataOrTypedInput: FormData | WebinarInput
) {
  const cleanWebinarId = webinarId.trim();
  if (!cleanWebinarId) throw new Error("webinarId is required");

  const ref = adminDb.collection("webinars").doc(cleanWebinarId);
  const existing = await ref.get();
  if (!existing.exists) throw new Error("Webinar not found");

  const input = parseInput(formDataOrTypedInput);
  const existingData = existing.data() ?? {};
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (input.title !== undefined) {
    const title = toCleanString(input.title);
    if (!title) throw new Error("title cannot be empty");
    updates.title = title;
  }

  if (input.slug !== undefined) {
    const slug = toCleanString(input.slug);
    if (!slug) throw new Error("slug cannot be empty");
    await assertUniqueSlug(slug, cleanWebinarId);
    updates.slug = slug;
  }

  if (input.videoPublicPath !== undefined) {
    const videoPublicPath = toCleanString(input.videoPublicPath);
    if (!videoPublicPath) throw new Error("videoPublicPath cannot be empty");
    assertPublicVideoPath(videoPublicPath);
    updates.videoPublicPath = videoPublicPath;
  }

  if (input.durationSec !== undefined) {
    const durationSec = toOptionalPositiveInt(input.durationSec);
    if (durationSec === null) throw new Error("durationSec must be a positive number");
    updates.durationSec = durationSec;
  }

  if (input.lateGraceMinutes !== undefined) {
    updates.lateGraceMinutes = normalizeLateGraceMinutes(
      input,
      Number(existingData.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES)
    );
  }

  const scheduleKeysProvided =
    input.schedule !== undefined ||
    input.timezoneBase !== undefined ||
    input.daysOfWeek !== undefined ||
    input.times !== undefined ||
    input.liveWindowMinutes !== undefined ||
    input.scheduleType !== undefined ||
    input.scheduleLocalTime !== undefined ||
    input.scheduleWeekday !== undefined;

  const webhookKeysProvided =
    input.webhook !== undefined || input.webhookEnabled !== undefined || input.webhookUrl !== undefined;
  const redirectKeysProvided =
    input.redirect !== undefined ||
    input.redirectEnabled !== undefined ||
    input.redirectUrl !== undefined;
  const botKeysProvided =
    input.bot !== undefined ||
    input.botEnabled !== undefined ||
    input.botName !== undefined ||
    input.botLink !== undefined ||
    input.botApiKey !== undefined ||
    input.botConversationId !== undefined ||
    input.botActivationDelaySec !== undefined;
  const registrationPageKeysProvided =
    input.registrationPage !== undefined ||
    input.registrationPageEyebrow !== undefined ||
    input.registrationPageHeading !== undefined ||
    input.registrationPageDescription !== undefined ||
    input.registrationPageCtaLabel !== undefined ||
    input.registrationPageCtaSubLabel !== undefined ||
    input.registrationPageModalHeading !== undefined ||
    input.registrationPageSubmitLabel !== undefined ||
    input.registrationPageDisclaimerText !== undefined ||
    input.registrationPagePhonePitchTitle !== undefined ||
    input.registrationPagePhonePitchBody !== undefined ||
    input.registrationPageArrowImageUrl !== undefined ||
    input.registrationPageBonusImageUrl !== undefined ||
    input.registrationPageAccentColor !== undefined ||
    input.registrationPageHeadingColor !== undefined;
  const confirmationPageKeysProvided =
    input.confirmationPage !== undefined ||
    input.confirmationPageHeadline !== undefined ||
    input.confirmationPageStepBannerText !== undefined ||
    input.confirmationPageIntroText !== undefined ||
    input.confirmationPageScheduleHeading !== undefined ||
    input.confirmationPageScheduledTimeLabel !== undefined ||
    input.confirmationPageCountdownLabel !== undefined ||
    input.confirmationPageJoinButtonLabel !== undefined ||
    input.confirmationPageAddToCalendarLabel !== undefined ||
    input.confirmationPageMessengerButtonLabel !== undefined ||
    input.confirmationPageMessengerUrl !== undefined ||
    input.confirmationPageMediaSource !== undefined ||
    input.confirmationPageMediaType !== undefined ||
    input.confirmationPageMediaUrl !== undefined ||
    input.confirmationPageMediaPosition !== undefined ||
    input.confirmationPageHeadlineColor !== undefined ||
    input.confirmationPageBannerColor !== undefined ||
    input.confirmationPagePrimaryButtonColor !== undefined;

  if (scheduleKeysProvided) {
    const existingSchedule = parseStoredSchedule(existingData);
    updates.schedule = normalizeSchedule(input, existingSchedule);
  }

  if (webhookKeysProvided) {
    const existingWebhook = parseStoredWebhook(existingData);
    updates.webhook = normalizeWebhook(input, existingWebhook);
  }

  if (redirectKeysProvided) {
    const existingRedirect = parseStoredRedirect(existingData);
    updates.redirect = normalizeRedirect(input, existingRedirect);
  }

  if (botKeysProvided) {
    const existingBot = parseStoredBot(existingData);
    updates.bot = normalizeBot(input, existingBot);
  }

  if (registrationPageKeysProvided) {
    const existingRegistrationPage = parseStoredRegistrationPage(existingData);
    updates.registrationPage = normalizeRegistrationPage(input, existingRegistrationPage);
  }
  if (confirmationPageKeysProvided) {
    const existingConfirmationPage = parseStoredConfirmationPage(existingData);
    updates.confirmationPage = normalizeConfirmationPage(input, existingConfirmationPage);
  }

  if (Object.keys(updates).length === 1) {
    throw new Error("No fields to update");
  }

  await ref.update(updates);
  return { webinarId: cleanWebinarId };
}

export async function listWebinarsAction(): Promise<WebinarListItem[]> {
  const snap = await adminDb
    .collection("webinars")
    .select("title", "slug", "updatedAt")
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((doc) => {
    const raw = doc.data();
    return {
      webinarId: doc.id,
      title: String(raw.title ?? ""),
      slug: String(raw.slug ?? ""),
      updatedAt: toIsoOrNull(raw.updatedAt),
    };
  });
}

export async function getWebinarAction(webinarId: string): Promise<WebinarRecord | null> {
  const cleanWebinarId = webinarId.trim();
  if (!cleanWebinarId) throw new Error("webinarId is required");

  const doc = await adminDb.collection("webinars").doc(cleanWebinarId).get();
  if (!doc.exists) return null;

  const raw = doc.data() ?? {};
  const schedule = parseStoredSchedule(raw);
  const webhook = parseStoredWebhook(raw);
  const redirect = parseStoredRedirect(raw);
  const bot = parseStoredBot(raw);
  const registrationPage = parseStoredRegistrationPage(raw);
  const confirmationPage = parseStoredConfirmationPage(raw);
  const legacy = asLegacySchedule(schedule);

  return {
    webinarId: doc.id,
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    videoPublicPath: String(raw.videoPublicPath ?? ""),
    durationSec: Number(raw.durationSec ?? 0),
    lateGraceMinutes: normalizeLateGraceMinutes(
      { lateGraceMinutes: raw.lateGraceMinutes },
      DEFAULT_LATE_GRACE_MINUTES
    ),
    schedule,
    scheduleType: legacy.scheduleType,
    scheduleLocalTime: legacy.scheduleLocalTime,
    scheduleWeekday: legacy.scheduleWeekday,
    webhook,
    redirect,
    bot,
    registrationPage,
    confirmationPage,
    createdAt: toIsoOrNull(raw.createdAt),
    updatedAt: toIsoOrNull(raw.updatedAt),
  };
}

export async function getWebinarBySlugAction(slug: string): Promise<WebinarView | null> {
  const cleanSlug = slug.trim();
  if (!cleanSlug) throw new Error("slug is required");

  const snap = await adminDb.collection("webinars").where("slug", "==", cleanSlug).limit(2).get();
  if (snap.empty) return null;
  if (snap.size > 1) {
    throw new Error(`Multiple webinars found for slug "${cleanSlug}"`);
  }

  const doc = snap.docs[0];
  return toWebinarView(doc.id, doc.data());
}
