import type { WebinarWebhook } from "@/types/webinar";

type BaseWebhookInput = {
  webhook: WebinarWebhook;
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userTimeZone: string;
  isMobile: boolean;
  scheduledStartISO: string;
};

type RegistrationWebhookInput = BaseWebhookInput;

type AttendanceWebhookInput = BaseWebhookInput & {
  attendedAtISO: string;
  watchedMinutes: number;
};

type NoShowWebhookInput = BaseWebhookInput & {
  noShowAtISO: string;
};

export type RegistrationWebhookPayload = {
  eventType: "registration";
  attendanceStatus: "Registered";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  webinarTime: string;
  webinarTimeGHL: string;
  tokens: string;
  userTimeZone: string;
  confirmationLinkDesktop: string;
  confirmationLinkMobile: string;
  liveLinkDesktop: string;
  liveLinkMobile: string;
  isMobile: boolean;
  astatus: "Registered";
};

export type AttendanceWebhookPayload = {
  eventType: "attendance";
  attendanceStatus: "Attended";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  webinarTime: string;
  webinarTimeGHL: string;
  tokens: string;
  userTimeZone: string;
  confirmationLinkDesktop: string;
  confirmationLinkMobile: string;
  liveLinkDesktop: string;
  liveLinkMobile: string;
  attendedAtISO: string;
  attendedAtDisplay: string;
  watchedMinutes: number;
  isMobile: boolean;
  astatus: "Attended";
};

export type NoShowWebhookPayload = {
  eventType: "attendance";
  attendanceStatus: "No-show";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  webinarTime: string;
  webinarTimeGHL: string;
  tokens: string;
  userTimeZone: string;
  confirmationLinkDesktop: string;
  confirmationLinkMobile: string;
  liveLinkDesktop: string;
  liveLinkMobile: string;
  noShowAtISO: string;
  noShowAtDisplay: string;
  watchedMinutes: 0;
  isMobile: boolean;
  astatus: "No-show";
};

export type SupportedWebhookPayload =
  | RegistrationWebhookPayload
  | AttendanceWebhookPayload
  | NoShowWebhookPayload;

function getBaseUrl(webhook: WebinarWebhook): string {
  const fromWebinar = webhook.confirmationBaseUrl?.trim();
  if (fromWebinar) return fromWebinar.replace(/\/$/, "");

  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim() || process.env.BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    return "https://live.onlinebroadcastpro.com";
  }

  return "http://localhost:3000";
}

function formatForDisplay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

function formatForGhl(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function buildConfirmationLink(input: {
  baseUrl: string;
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  webinarTime: string;
  userTimeZone: string;
}): string {
  const url = new URL(`${input.baseUrl}/confirm/${input.token}`);
  const customName = `${input.firstName} ${input.lastName}`.trim();
  url.searchParams.set("time", input.webinarTime);
  url.searchParams.set("firstName", input.firstName);
  url.searchParams.set("lastName", input.lastName);
  url.searchParams.set("email", input.email);
  url.searchParams.set("phone", input.phone);
  url.searchParams.set("custom_name", customName);
  url.searchParams.set("token", input.token);
  url.searchParams.set("timeZone", input.userTimeZone);
  return url.toString();
}

function buildLiveLink(baseUrl: string, token: string) {
  return `${baseUrl}/live/${token}`;
}

export function buildRegistrationWebhookPayload(
  input: RegistrationWebhookInput
): RegistrationWebhookPayload {
  const baseUrl = getBaseUrl(input.webhook);
  const webinarTime = formatForDisplay(input.scheduledStartISO, input.userTimeZone);
  const webinarTimeGHL = formatForGhl(input.scheduledStartISO, input.userTimeZone);
  const confirmationLink = buildConfirmationLink({
    baseUrl,
    token: input.token,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    userTimeZone: input.userTimeZone,
  });
  const liveLink = buildLiveLink(baseUrl, input.token);

  return {
    eventType: "registration",
    attendanceStatus: "Registered",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    webinarTimeGHL,
    tokens: input.token,
    userTimeZone: input.userTimeZone,
    confirmationLinkDesktop: confirmationLink,
    confirmationLinkMobile: confirmationLink,
    liveLinkDesktop: liveLink,
    liveLinkMobile: liveLink,
    isMobile: input.isMobile,
    astatus: "Registered",
  };
}

export function buildAttendanceWebhookPayload(
  input: AttendanceWebhookInput
): AttendanceWebhookPayload {
  const baseUrl = getBaseUrl(input.webhook);
  const webinarTime = formatForDisplay(input.scheduledStartISO, input.userTimeZone);
  const webinarTimeGHL = formatForGhl(input.scheduledStartISO, input.userTimeZone);
  const confirmationLink = buildConfirmationLink({
    baseUrl,
    token: input.token,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    userTimeZone: input.userTimeZone,
  });
  const liveLink = buildLiveLink(baseUrl, input.token);

  return {
    eventType: "attendance",
    attendanceStatus: "Attended",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    webinarTimeGHL,
    tokens: input.token,
    userTimeZone: input.userTimeZone,
    confirmationLinkDesktop: confirmationLink,
    confirmationLinkMobile: confirmationLink,
    liveLinkDesktop: liveLink,
    liveLinkMobile: liveLink,
    attendedAtISO: input.attendedAtISO,
    attendedAtDisplay: formatForDisplay(input.attendedAtISO, input.userTimeZone),
    watchedMinutes: Math.max(0, Math.floor(input.watchedMinutes)),
    isMobile: input.isMobile,
    astatus: "Attended",
  };
}

export function buildNoShowWebhookPayload(
  input: NoShowWebhookInput
): NoShowWebhookPayload {
  const baseUrl = getBaseUrl(input.webhook);
  const webinarTime = formatForDisplay(input.scheduledStartISO, input.userTimeZone);
  const webinarTimeGHL = formatForGhl(input.scheduledStartISO, input.userTimeZone);
  const confirmationLink = buildConfirmationLink({
    baseUrl,
    token: input.token,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    userTimeZone: input.userTimeZone,
  });
  const liveLink = buildLiveLink(baseUrl, input.token);

  return {
    eventType: "attendance",
    attendanceStatus: "No-show",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    webinarTime,
    webinarTimeGHL,
    tokens: input.token,
    userTimeZone: input.userTimeZone,
    confirmationLinkDesktop: confirmationLink,
    confirmationLinkMobile: confirmationLink,
    liveLinkDesktop: liveLink,
    liveLinkMobile: liveLink,
    noShowAtISO: input.noShowAtISO,
    noShowAtDisplay: formatForDisplay(input.noShowAtISO, input.userTimeZone),
    watchedMinutes: 0,
    isMobile: input.isMobile,
    astatus: "No-show",
  };
}

export async function postWebhookPayload(url: string, payload: SupportedWebhookPayload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Webhook POST failed (${response.status}) url=${url} body=${body.slice(0, 400)}`);
  }
}

export async function postRegistrationWebhook(input: RegistrationWebhookInput) {
  if (!input.webhook.enabled || !input.webhook.url) return;
  const payload = buildRegistrationWebhookPayload(input);
  await postWebhookPayload(input.webhook.url, payload);
}

export async function postAttendanceWebhook(input: AttendanceWebhookInput) {
  if (!input.webhook.enabled || !input.webhook.url) return;
  const payload = buildAttendanceWebhookPayload(input);
  await postWebhookPayload(input.webhook.url, payload);
}

export async function postNoShowWebhook(input: NoShowWebhookInput) {
  if (!input.webhook.enabled || !input.webhook.url) return;
  const payload = buildNoShowWebhookPayload(input);
  await postWebhookPayload(input.webhook.url, payload);
}
