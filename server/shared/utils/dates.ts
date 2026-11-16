// Timezone-aware date helpers. Branches have their own IANA timezone; opening hours, slots and
// "today" are always computed in that zone, never in the server's.

export interface LocalParts {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Minutes since local midnight */
  minutes: number;
  /** HH:MM */
  time: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function localParts(at: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(at).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: hour * 60 + minute,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** The UTC offset (ms) of `timeZone` at the given instant. */
function offsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)) - 1, Number(p.date.slice(8, 10)), Math.floor(p.minutes / 60), p.minutes % 60, at.getUTCSeconds());
  return asUtc - at.getTime() + at.getUTCMilliseconds();
}

/** The instant at local `date` + `time` (HH:MM) in `timeZone`. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m, 0, 0));
  const first = new Date(guess.getTime() - offsetMs(guess, timeZone));
  // One more pass handles DST edges where the offset differs between guess and answer.
  return new Date(guess.getTime() - offsetMs(first, timeZone));
}

export function todayIn(timeZone: string, at = new Date()): string {
  return localParts(at, timeZone).date;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatDateTime(at: Date | string, timeZone: string): string {
  return new Date(at).toLocaleString("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" });
}

/** Default inclusive date range: the last `days` days ending today (in the given zone). */
export function resolveRange(timeZone: string, from?: string, to?: string, days = 30): { from: string; to: string } {
  const end = to ?? todayIn(timeZone);
  const start = from ?? addDays(end, -(days - 1));
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
