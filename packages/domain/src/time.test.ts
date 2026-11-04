import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInTz,
  dayLengthMinutes,
  diffDays,
  isISODate,
  minutesInTz,
  parseClock,
  startOfWeek,
  weekday,
  zonedTimeToMs,
} from "./time";

const NY = "America/New_York";

describe("calendar dates", () => {
  it("validates real dates only", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-1-01")).toBe(false);
  });

  it("adds days across month, year and DST boundaries without drift", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("computes weekdays and week starts", () => {
    expect(weekday("2026-10-30")).toBe(5); // Friday
    expect(startOfWeek("2026-10-30", 1)).toBe("2026-10-26");
    expect(startOfWeek("2026-10-30", 0)).toBe("2026-10-25");
    expect(startOfWeek("2026-10-25", 1)).toBe("2026-10-19");
  });
});

describe("time zones", () => {
  it("assigns instants near midnight to the local date, not the UTC date", () => {
    // 2026-10-31T03:30Z is still Oct 30 in New York (UTC-4).
    expect(dateInTz("2026-10-31T03:30:00Z", NY)).toBe("2026-10-30");
    expect(dateInTz("2026-10-31T03:30:00Z", "UTC")).toBe("2026-10-31");
    expect(dateInTz("2026-10-30T14:30:00Z", "Asia/Tokyo")).toBe("2026-10-30");
    expect(dateInTz("2026-10-30T15:30:00Z", "Asia/Tokyo")).toBe("2026-10-31");
  });

  it("round-trips wall-clock times on ordinary days", () => {
    const ms = zonedTimeToMs("2026-10-30", 9 * 60 + 15, NY);
    expect(new Date(ms).toISOString()).toBe("2026-10-30T13:15:00.000Z");
    expect(minutesInTz(ms, NY)).toBe(555);
  });

  it("resolves the spring-forward gap forward", () => {
    // 02:30 does not exist on 2026-03-08 in New York; it becomes 03:30 EDT.
    const ms = zonedTimeToMs("2026-03-08", 150, NY);
    expect(new Date(ms).toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(minutesInTz(ms, NY)).toBe(210);
  });

  it("resolves the fall-back overlap to the earlier instant", () => {
    const ms = zonedTimeToMs("2026-11-01", 90, NY);
    expect(new Date(ms).toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("knows DST days are 23 and 25 hours long", () => {
    expect(dayLengthMinutes("2026-03-08", NY)).toBe(23 * 60);
    expect(dayLengthMinutes("2026-11-01", NY)).toBe(25 * 60);
    expect(dayLengthMinutes("2026-10-30", NY)).toBe(24 * 60);
  });

  it("handles half-hour offsets", () => {
    const ms = zonedTimeToMs("2026-10-30", 0, "Asia/Kolkata");
    expect(new Date(ms).toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });

  it("parses clock strings", () => {
    expect(parseClock("09:05")).toBe(545);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("9:5")).toBeNull();
  });
});
