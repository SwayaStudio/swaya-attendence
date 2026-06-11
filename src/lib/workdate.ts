/**
 * Timezone-aware work date helpers.
 * Mongo's Date is UTC; we store workDate as "YYYY-MM-DD" in the company's timezone
 * to avoid day-boundary mismatches near midnight.
 */
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export function getWorkDateInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function todayWorkDate(timezone: string): string {
  return getWorkDateInTimezone(new Date(), timezone);
}

/** Build a Date for a given workDate string + HH:mm in the given timezone (returns UTC Date). */
export function zonedDateTimeToUtc(
  workDate: string,
  hhmm: string,
  timezone: string
): Date {
  // Build an ISO string interpreted in `timezone` by formatting the parts.
  const [y, m, d] = workDate.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  // Use a UTC anchor and adjust by the offset of the target timezone at that moment.
  const anchor = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMin = getTimezoneOffsetMinutes(timezone, anchor);
  return new Date(anchor.getTime() - offsetMin * 60_000);
}

function getTimezoneOffsetMinutes(tz: string, instant: Date): number {
  // Compare parts in tz vs UTC at the same instant.
  const zoned = toZonedTime(instant, tz);
  const utc = new Date(instant);
  // getTimezoneOffset is opposite sign; we compute tz - utc in minutes.
  const z = zoned.getTime();
  const u = utc.getTime();
  return Math.round((z - u) / 60_000);
}
