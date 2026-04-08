import { hashToken } from "@/lib/utils/tokens";

export function buildLiveSessionId(input: {
  webinarId: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
}) {
  return hashToken(
    `${input.webinarId}__${input.timezoneGroupKey}__${input.scheduledStartISO}`
  ).slice(0, 40);
}
