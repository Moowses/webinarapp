export type WebinarScheduleDayTime = {
  dayOfWeek: number;
  time: string;
};

export type WebinarSchedule = {
  timezoneBase: string;
  daysOfWeek: number[];
  times: string[];
  dayTimes?: WebinarScheduleDayTime[];
  liveWindowMinutes: number;
};

export type WebinarWebhook = {
  enabled: boolean;
  url: string;
  confirmationBaseUrl?: string;
};

export type WebinarBotConfig = {
  enabled: boolean;
  name: string;
  link?: string;
  apiKey: string;
  conversationId: string;
  activationDelaySec: number;
};

export type WebinarRedirectConfig = {
  enabled: boolean;
  url: string;
};

export type WebinarRegistrationPageConfig = {
  eyebrow: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaSubLabel: string;
  modalHeading: string;
  submitLabel: string;
  disclaimerText: string;
  phonePitchTitle: string;
  phonePitchBody: string;
  arrowImageUrl: string;
  bonusImageUrl: string;
  accentColor: string;
  headingColor: string;
};

export type WebinarConfirmationPageConfig = {
  headline: string;
  stepBannerText: string;
  introText: string;
  scheduleHeading: string;
  scheduledTimeLabel: string;
  countdownLabel: string;
  joinButtonLabel: string;
  addToCalendarLabel: string;
  messengerButtonLabel: string;
  messengerUrl: string;
  mediaSource: "self-hosted" | "external";
  mediaType: "video" | "image";
  mediaUrl: string;
  mediaPosition: "left" | "right";
  headlineColor: string;
  bannerColor: string;
  primaryButtonColor: string;
};

export type Webinar = {
  webinarId: string;
  title: string;
  slug: string;
  videoPublicPath: string;
  durationSec: number;
  lateGraceMinutes?: number;
  schedule: WebinarSchedule;
  webhook: WebinarWebhook;
  redirect?: WebinarRedirectConfig;
  bot?: WebinarBotConfig;
  registrationPage?: WebinarRegistrationPageConfig;
  confirmationPage?: WebinarConfirmationPageConfig;
  createdAt?: string | null;
  updatedAt?: string | null;
};
