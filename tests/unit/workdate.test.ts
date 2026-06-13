import { describe, it, expect } from "vitest";
import {
  getWorkDateInTimezone,
  enumerateWorkDates,
  isSunday,
  isWithinLocalTimeWindow,
  zonedDateTimeToUtc,
} from "@/lib/workdate";

describe("getWorkDateInTimezone", () => {
  it("rolls to the local calendar day near midnight (IST is UTC+5:30)", () => {
    // 2026-06-13 19:30 UTC == 2026-06-14 01:00 IST -> work date is the 14th.
    const d = new Date("2026-06-13T19:30:00Z");
    expect(getWorkDateInTimezone(d, "Asia/Kolkata")).toBe("2026-06-14");
  });

  it("keeps the same UTC day when timezone is UTC", () => {
    const d = new Date("2026-06-13T19:30:00Z");
    expect(getWorkDateInTimezone(d, "UTC")).toBe("2026-06-13");
  });

  it("rolls backward for a negative offset zone", () => {
    // 2026-06-13 02:00 UTC == 2026-06-12 21:00 in New York (UTC-4 in June).
    const d = new Date("2026-06-13T02:00:00Z");
    expect(getWorkDateInTimezone(d, "America/New_York")).toBe("2026-06-12");
  });
});

describe("enumerateWorkDates", () => {
  it("is inclusive of both endpoints", () => {
    expect(enumerateWorkDates("2026-06-13", "2026-06-15")).toEqual([
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
  });

  it("returns a single day when from == to", () => {
    expect(enumerateWorkDates("2026-06-13", "2026-06-13")).toEqual([
      "2026-06-13",
    ]);
  });

  it("crosses a month boundary correctly", () => {
    expect(enumerateWorkDates("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("returns empty when to is before from", () => {
    expect(enumerateWorkDates("2026-06-15", "2026-06-13")).toEqual([]);
  });
});

describe("isSunday", () => {
  it("detects a Sunday", () => {
    expect(isSunday("2026-06-14")).toBe(true); // 2026-06-14 is a Sunday
  });
  it("rejects a weekday", () => {
    expect(isSunday("2026-06-15")).toBe(false); // Monday
  });
});

describe("isWithinLocalTimeWindow (lunch pause)", () => {
  const tz = "Asia/Kolkata";
  it("is inside the 13:00-14:00 window at 13:30 local", () => {
    // 08:00 UTC == 13:30 IST
    const d = new Date("2026-06-13T08:00:00Z");
    expect(isWithinLocalTimeWindow(d, tz, "13:00", "14:00")).toBe(true);
  });

  it("is start-inclusive at exactly 13:00 local", () => {
    const d = new Date("2026-06-13T07:30:00Z"); // 13:00 IST
    expect(isWithinLocalTimeWindow(d, tz, "13:00", "14:00")).toBe(true);
  });

  it("is end-exclusive at exactly 14:00 local", () => {
    const d = new Date("2026-06-13T08:30:00Z"); // 14:00 IST
    expect(isWithinLocalTimeWindow(d, tz, "13:00", "14:00")).toBe(false);
  });

  it("is outside the window at 12:59 local", () => {
    const d = new Date("2026-06-13T07:29:00Z"); // 12:59 IST
    expect(isWithinLocalTimeWindow(d, tz, "13:00", "14:00")).toBe(false);
  });
});

describe("zonedDateTimeToUtc", () => {
  it("maps a wall-clock IST time back to the right UTC instant", () => {
    // 09:00 IST on 2026-06-13 == 03:30 UTC
    const utc = zonedDateTimeToUtc("2026-06-13", "09:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-06-13T03:30:00.000Z");
  });

  it("is identity for UTC", () => {
    const utc = zonedDateTimeToUtc("2026-06-13", "09:00", "UTC");
    expect(utc.toISOString()).toBe("2026-06-13T09:00:00.000Z");
  });
});
