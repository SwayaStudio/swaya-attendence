/**
 * Timezone-aware work date helpers.
 * Mongo's Date is UTC; we store workDate as "YYYY-MM-DD" in the company's timezone
 * to avoid day-boundary mismatches near midnight.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function getWorkDateInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function todayWorkDate(timezone: string): string {
  return getWorkDateInTimezone(new Date(), timezone);
}

/**
 * Build a Date for a given workDate string + HH:mm in the given timezone (returns
 * UTC Date). Uses date-fns-tz's `fromZonedTime`, which interprets the wall-clock
 * time AS the target timezone and returns the correct UTC instant — independent
 * of the host process's own timezone (the previous implementation was only
 * correct when the server ran in UTC).
 */
export function zonedDateTimeToUtc(
  workDate: string,
  hhmm: string,
  timezone: string
): Date {
  return fromZonedTime(`${workDate}T${hhmm}:00`, timezone);
}

/** All work-date strings from `from` to `to` inclusive (YYYY-MM-DD). */
export function enumerateWorkDates(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** True if the given work-date (YYYY-MM-DD) falls on a Sunday. */
export function isSunday(workDate: string): boolean {
  return new Date(`${workDate}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * True if `instant` falls within [startHHmm, endHHmm) in the given timezone.
 * Both bounds are "HH:mm" 24-hour strings (e.g. "13:00", "14:00").
 */
export function isWithinLocalTimeWindow(
  instant: Date,
  timezone: string,
  startHHmm: string,
  endHHmm: string
): boolean {
  const cur = formatInTimeZone(instant, timezone, "HH:mm");
  return cur >= startHHmm && cur < endHHmm;
}
