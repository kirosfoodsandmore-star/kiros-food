// Pure logic: is a branch open right now, and which time slots can an order be scheduled for.
// No I/O. All times are computed in the branch's own timezone.
import { SCHEDULE_DAYS_AHEAD } from "../../../config/constants";
import { addDays, localParts, minutesToTime, timeToMinutes, zonedToUtc } from "../../../shared/utils/dates";

export interface HoursWindow {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface BranchClock {
  timezone: string;
  isPaused: boolean;
  prepTimeMinutes: number;
  slotIntervalMinutes: number;
}

export interface OpenState {
  /** Open for ASAP orders right now (within hours, not a closure, not paused). */
  isOpen: boolean;
  /** Within opening hours regardless of pause. */
  withinHours: boolean;
  isPaused: boolean;
  /** Today's closing time (HH:MM) when within hours. */
  closesAt: string | null;
  /** Next opening instant when closed. */
  nextOpenAt: Date | null;
  localTime: string;
}

interface Window {
  start: number;
  end: number;
}

/** Opening windows for a local date as minute ranges [start, end) where end may exceed 1440 (past midnight). */
function windowsFor(date: string, weekday: number, hours: HoursWindow[], closures: Set<string>): Window[] {
  if (closures.has(date)) return [];
  return hours
    .filter((h) => h.weekday === weekday)
    .map((h) => {
      const start = timeToMinutes(h.opensAt);
      let end = h.closesAt === "24:00" ? 1440 : timeToMinutes(h.closesAt);
      if (end <= start) end += 1440;
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function computeOpenState(branch: BranchClock, hours: HoursWindow[], closureDates: string[], now = new Date()): OpenState {
  const closures = new Set(closureDates);
  const local = localParts(now, branch.timezone);
  const today = windowsFor(local.date, local.weekday, hours, closures);
  // A window that started yesterday and runs past midnight also counts.
  const yesterday = addDays(local.date, -1);
  const spill = windowsFor(yesterday, weekdayOf(yesterday), hours, closures)
    .filter((w) => w.end > 1440)
    .map((w) => ({ start: w.start - 1440, end: w.end - 1440 }));
  const current = [...spill, ...today].find((w) => local.minutes >= w.start && local.minutes < w.end);
  const withinHours = Boolean(current);

  let nextOpenAt: Date | null = null;
  if (!withinHours) {
    for (let i = 0; i <= SCHEDULE_DAYS_AHEAD + 7 && !nextOpenAt; i++) {
      const date = addDays(local.date, i);
      const windows = windowsFor(date, weekdayOf(date), hours, closures);
      const next = windows.find((w) => i > 0 || w.start > local.minutes);
      if (next) nextOpenAt = zonedToUtc(date, minutesToTime(next.start), branch.timezone);
    }
  }
  return {
    isOpen: withinHours && !branch.isPaused,
    withinHours,
    isPaused: branch.isPaused,
    closesAt: current ? minutesToTime(current.end % 1440) : null,
    nextOpenAt,
    localTime: local.time,
  };
}

export interface SlotDay {
  date: string;
  slots: Array<{ at: string; label: string }>;
}

/**
 * Scheduled pickup/delivery slots for the next few days: every `slotInterval` minutes inside opening
 * hours, starting no earlier than now + prep time (+ zone travel). ASAP is a separate flag.
 */
export function generateSlots(branch: BranchClock, hours: HoursWindow[], closureDates: string[], extraMinutes = 0, now = new Date()): { asapAvailable: boolean; days: SlotDay[] } {
  const closures = new Set(closureDates);
  const local = localParts(now, branch.timezone);
  const interval = Math.max(5, branch.slotIntervalMinutes);
  const lead = branch.prepTimeMinutes + extraMinutes;
  const earliest = local.minutes + lead;
  const days: SlotDay[] = [];
  for (let i = 0; i <= SCHEDULE_DAYS_AHEAD; i++) {
    const date = addDays(local.date, i);
    const windows = windowsFor(date, weekdayOf(date), hours, closures);
    const slots: SlotDay["slots"] = [];
    for (const w of windows) {
      let m = Math.ceil(w.start / interval) * interval;
      for (; m + lead <= w.end; m += interval) {
        if (i === 0 && m < earliest) continue;
        // Skip slots that land after midnight into the next calendar day for clarity: they show under that day.
        if (m >= 1440) break;
        slots.push({ at: zonedToUtc(date, minutesToTime(m), branch.timezone).toISOString(), label: minutesToTime(m) });
      }
    }
    days.push({ date, slots });
  }
  const state = computeOpenState(branch, hours, closureDates, now);
  return { asapAvailable: state.isOpen, days };
}

/** Is `at` inside a valid slot window (on an interval boundary, within hours, not in the past)? */
export function isValidScheduledTime(branch: BranchClock, hours: HoursWindow[], closureDates: string[], at: Date, extraMinutes = 0, now = new Date()): boolean {
  if (at.getTime() < now.getTime() + (branch.prepTimeMinutes + extraMinutes) * 60_000 - 60_000) return false;
  const { days } = generateSlots(branch, hours, closureDates, extraMinutes, now);
  const iso = at.toISOString();
  return days.some((d) => d.slots.some((s) => s.at === iso));
}
