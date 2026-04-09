import type { WebinarWebhook } from "@/types/webinar";

type RegistrationWebhookInput = {
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

export async function postRegistrationWebhook(input: RegistrationWebhookInput) {
  if (!input.webhook.enabled || !input.webhook.url) return;

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

  const payload = {
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
    isMobile: input.isMobile,
    astatus: "Registered",
  };

  const response = await fetch(input.webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Webhook POST failed (${response.status}) url=${input.webhook.url} body=${body.slice(0, 400)}`
    );
  }
}
