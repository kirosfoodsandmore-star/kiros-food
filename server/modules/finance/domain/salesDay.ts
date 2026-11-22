// The "sales day" of a late-trading restaurant: it rolls over at SALES_DAY_STARTS_HOUR local time, not at midnight, so
// a cashier who closes at 1am is still on the same day as the evening before. Sales-only staff can change a sale only
// while the sales day it was recorded on is still the current one. Pure: no I/O.
import { todayIn } from "../../../shared/utils/dates";

export const SALES_DAY_STARTS_HOUR = 6;

/** The sales day (YYYY-MM-DD, in `timeZone`) that `at` falls on: 05:59 still belongs to the day before. */
export function salesDayOf(at: Date, timeZone: string): string {
  return todayIn(timeZone, new Date(at.getTime() - SALES_DAY_STARTS_HOUR * 3_600_000));
}
