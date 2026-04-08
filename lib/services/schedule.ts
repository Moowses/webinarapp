import {
  addDaysYMD,
  getZonedParts,
  isValidTimeZone,
  parseLocalTimeHHMM,
  zonedDateTimeToUtcDate,
} from "@/lib/utils/timezone";

export type WebinarScheduleType = "weekly" | "daily";

export type WebinarScheduleConfig = {
  scheduleType: WebinarScheduleType;
  scheduleLocalTime: string;
  scheduleWeekday?: number;
};

type ComputeInput = {
  now: Date;
  userTimeZone: string;
  durationSec: number;
  config: WebinarScheduleConfig;
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

function normalizeWeekday(weekday?: number) {
  if (typeof weekday !== "number") return null;
  if (!Number.isInteger(weekday)) return null;
  if (weekday < 0 || weekday > 6) return null;
  return weekday;
}

export function computeRegistrationWindow(input: ComputeInput) {
  if (!isValidTimeZone(input.userTimeZone)) {
    throw new Error("Invalid user time zone");
  }

  const localTime = parseLocalTimeHHMM(input.config.scheduleLocalTime);
  if (!localTime) {
    throw new Error("Invalid webinar scheduleLocalTime, expected HH:mm");
  }

  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw new Error("Invalid webinar durationSec");
  }

  const nowParts = getZonedParts(input.now, input.userTimeZone);
  let daysAhead = 0;

  if (input.config.scheduleType === "weekly") {
    const targetWeekday = normalizeWeekday(input.config.scheduleWeekday);
    if (targetWeekday === null) {
      throw new Error("Invalid webinar scheduleWeekday for weekly schedule");
    }

    daysAhead = (targetWeekday - nowParts.weekday + 7) % 7;
    if (
      daysAhead === 0 &&
      hasPassedToday(nowParts.hour, nowParts.minute, localTime.hour, localTime.minute)
    ) {
      daysAhead = 7;
    }
  } else {
    daysAhead = hasPassedToday(
      nowParts.hour,
      nowParts.minute,
      localTime.hour,
      localTime.minute
    )
      ? 1
      : 0;
  }

  const targetDay = addDaysYMD(nowParts.year, nowParts.month, nowParts.day, daysAhead);
  const scheduledStart = zonedDateTimeToUtcDate({
    timeZone: input.userTimeZone,
    year: targetDay.year,
    month: targetDay.month,
    day: targetDay.day,
    hour: localTime.hour,
    minute: localTime.minute,
    second: 0,
  });

  const scheduledEnd = new Date(scheduledStart.getTime() + input.durationSec * 1000);

  return {
    scheduledStartISO: scheduledStart.toISOString(),
    scheduledEndISO: scheduledEnd.toISOString(),
    timezoneGroupKey: input.userTimeZone,
  };
}
