type DailyHours = { enabled?: unknown; from?: unknown; to?: unknown };

function localDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    weekday: read("weekday").toLowerCase().slice(0, 3),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

function parseMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3]?.toLowerCase();
  if (hour > 23 || minute > 59 || (period && (hour < 1 || hour > 12))) return null;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function isVendorVideoVisibleInFeed(publishedAt: Date | string | null | undefined, schedule: unknown, now = new Date()) {
  if (!publishedAt) return true;
  const publishedDate = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (!Number.isFinite(publishedDate.getTime())) return true;
  const publishedLocal = localDateParts(publishedDate);
  const currentLocal = localDateParts(now);
  if (publishedLocal.date !== currentLocal.date) return false;

  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return true;
  const day = (schedule as Record<string, unknown>)[publishedLocal.weekday] as DailyHours | undefined;
  if (!day || typeof day !== "object") return true;
  if (day.enabled === false || day.enabled === 0) return false;
  const opens = parseMinutes(day.from);
  const closes = parseMinutes(day.to);
  if (opens === null || closes === null) return true;
  return opens <= closes
    ? currentLocal.minutes >= opens && currentLocal.minutes < closes
    : currentLocal.minutes >= opens || currentLocal.minutes < closes;
}
