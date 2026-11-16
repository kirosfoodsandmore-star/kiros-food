import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function initials(name: string | null | undefined): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

/** "1 item", "3 items". Pass `many` for irregular plurals. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "+2347044414000" → "(+234) 704 441 4000" (Nigerian numbers); anything else is returned as given. */
export function formatPhone(value: string): string {
  const d = value.replace(/[\s()-]/g, "")
  return /^\+234\d{10}$/.test(d) ? `(+234) ${d.slice(4, 7)} ${d.slice(7, 10)} ${d.slice(10)}` : value
}
