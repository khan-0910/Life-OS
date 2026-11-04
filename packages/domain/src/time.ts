/**
 * Date and time rules for LifeOS.
 *
 * Two kinds of value are used throughout the product:
 *  - `ISODate` ("YYYY-MM-DD"): a calendar date in the user's configured time zone.
 *    Used for all-day items (due dates, planned dates, habit days, reviews).
 *    It is never converted through a timestamp, so it cannot drift by a day.
 *  - Instants: UTC epoch milliseconds or ISO-8601 strings with "Z". Used for
 *    timed items (time blocks, focus sessions, completion times).
 *
 * Converting between the two always takes an explicit IANA time zone.
 * Wall-clock times that do not exist (spring-forward gap) resolve forward by the
 * length of the gap; ambiguous times (fall-back overlap) resolve to the earlier
 * instant. This matches Temporal's "compatible" disambiguation.
 */

export type ISODate = string;
export type Instant = string;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function dateParts(date: ISODate): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid ISO date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function fromUtcDate(dt: Date): ISODate {
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = dateParts(date);
  return fromUtcDate(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = dateParts(a);
  const [by, bm, bd] = dateParts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: ISODate): number {
  const [y, m, d] = dateParts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1): ISODate {
  const offset = (weekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function toMs(instant: number | string | Date): number {
  if (typeof instant === "number") return instant;
  if (instant instanceof Date) return instant.getTime();
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid instant: ${instant}`);
  return ms;
}

export function toInstant(ms: number): Instant {
  return new Date(ms).toISOString();
}

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wall(ms: number, tz: string): Wall {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 1970,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: (out.hour ?? 0) % 24,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

/** Offset of `tz` from UTC at `ms`, in milliseconds (wall − UTC). */
export function tzOffsetMs(ms: number, tz: string): number {
  const base = Math.floor(ms / 1000) * 1000;
  const w = wall(base, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - base;
}

/** The calendar date of an instant, as seen in `tz`. */
export function dateInTz(instant: number | string | Date, tz: string): ISODate {
  const w = wall(toMs(instant), tz);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/** Minutes after local midnight (0–1439) of an instant, as seen in `tz`. */
export function minutesInTz(instant: number | string | Date, tz: string): number {
  const w = wall(toMs(instant), tz);
  return w.hour * 60 + w.minute;
}

/**
 * The instant at which the wall clock in `tz` reads `date` + `minutes`.
 * `minutes` may exceed 1440 or be negative; it is applied to the wall clock.
 */
export function zonedTimeToMs(date: ISODate, minutes: number, tz: string): number {
  const [y, m, d] = dateParts(date);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const before = tzOffsetMs(naive - DAY_MS, tz);
  const after = tzOffsetMs(naive + DAY_MS, tz);
  if (before === after) return naive - before;
  const a = naive - before;
  const b = naive - after;
  const aOk = tzOffsetMs(a, tz) === before;
  const bOk = tzOffsetMs(b, tz) === after;
  if (aOk && bOk) return Math.min(a, b); // ambiguous: earlier occurrence
  if (aOk) return a;
  if (bOk) return b;
  return a; // nonexistent: shift forward by the gap
}

/** Start instant of a calendar day in `tz` (not always 00:00 on DST days). */
export function startOfDayMs(date: ISODate, tz: string): number {
  return zonedTimeToMs(date, 0, tz);
}

/** Length of a calendar day in `tz`, in minutes (1380/1440/1500 around DST). */
export function dayLengthMinutes(date: ISODate, tz: string): number {
  return Math.round((startOfDayMs(addDays(date, 1), tz) - startOfDayMs(date, tz)) / MINUTE_MS);
}

export function todayInTz(tz: string, now: number = Date.now()): ISODate {
  return dateInTz(now, tz);
}

/** "HH:MM" (24h) → minutes, or null when invalid. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
