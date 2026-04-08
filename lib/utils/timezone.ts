type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function readPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find((p) => p.type === type)?.value;
  if (!found) throw new Error(`Missing date part: ${type}`);
  return found;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseLocalTimeHHMM(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const timeZoneParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
    timeZone,
  }).formatToParts(date);

  return {
    year: Number(readPart(timeZoneParts, "year")),
    month: Number(readPart(timeZoneParts, "month")),
    day: Number(readPart(timeZoneParts, "day")),
    hour: Number(readPart(timeZoneParts, "hour")),
    minute: Number(readPart(timeZoneParts, "minute")),
    second: Number(readPart(timeZoneParts, "second")),
    weekday: weekdayMap[readPart(timeZoneParts, "weekday")] ?? 0,
  };
}

function getOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const asUtc = Date.UTC(
    Number(readPart(parts, "year")),
    Number(readPart(parts, "month")) - 1,
    Number(readPart(parts, "day")),
    Number(readPart(parts, "hour")),
    Number(readPart(parts, "minute")),
    Number(readPart(parts, "second"))
  );

  return Math.round((asUtc - date.getTime()) / 60000);
}

export function addDaysYMD(
  year: number,
  month: number,
  day: number,
  daysToAdd: number
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function zonedDateTimeToUtcDate(input: {
  timeZone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}): Date {
  const second = input.second ?? 0;
  const guessUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    second
  );

  let adjustedUtc = guessUtc - getOffsetMinutes(input.timeZone, new Date(guessUtc)) * 60000;
  const nextOffset = getOffsetMinutes(input.timeZone, new Date(adjustedUtc));
  adjustedUtc = guessUtc - nextOffset * 60000;

  return new Date(adjustedUtc);
}
