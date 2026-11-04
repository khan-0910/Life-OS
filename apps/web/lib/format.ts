import { addDays, toMs, type ISODate } from "@lifeos/domain";

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts);
    cache.set(key, f);
  }
  return f;
}

/** Calendar dates are formatted in UTC so they never shift by a day. */
function dateAsUtc(date: ISODate): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatDateLong(date: ISODate): string {
  return fmt("long", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(dateAsUtc(date));
}

export function formatDateShort(date: ISODate): string {
  return fmt("short", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateAsUtc(date));
}

export function formatWeekday(date: ISODate, style: "short" | "narrow" = "short"): string {
  return fmt(`wd-${style}`, { weekday: style, timeZone: "UTC" }).format(dateAsUtc(date));
}

export function formatDayNumber(date: ISODate): string {
  return String(Number(date.slice(8, 10)));
}

export function formatTime(instant: string | number, tz: string): string {
  return fmt(`t-${tz}`, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(toMs(instant)));
}

export function formatDateTime(instant: string | number, tz: string): string {
  return fmt(`dt-${tz}`, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz }).format(
    new Date(toMs(instant)),
  );
}

/** Wall-clock minutes to a localized label such as "9 AM" or "09:00". */
export function formatMinutes(minutes: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, 0, minutes));
  return fmt("min", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

export function formatHour(hour: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, hour));
  return fmt("hour", { hour: "numeric", timeZone: "UTC" }).format(d);
}

export function relativeDay(date: ISODate, today: ISODate): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatDateShort(date);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function greeting(minutes: number): string {
  if (minutes < 5 * 60) return "Still up";
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

export function pct(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}
