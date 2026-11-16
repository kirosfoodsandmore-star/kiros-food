// Plain-language selection rules for an option group, shared by the item page and the home-page preview.
// minSelect/maxSelect come from Admin → Option groups (e.g. a salad's Base 1/1, Fillings 1/10, Cravings 2/2).

interface Rule {
  minSelect: number
  maxSelect: number
}

/** "Pick 1", "Pick 2", "Pick up to 10", "Pick 2–4", "Optional · up to 3". */
export function ruleLabel({ minSelect, maxSelect }: Rule): string {
  if (minSelect === 0) return maxSelect === 1 ? "Optional · pick 1" : `Optional · up to ${maxSelect}`
  if (minSelect === maxSelect) return `Pick ${minSelect}`
  if (minSelect === 1) return `Pick up to ${maxSelect}`
  return `Pick ${minSelect}–${maxSelect}`
}

/** What's still missing for this group, e.g. "pick 1 more", or null when the rule is met. */
export function ruleShortfall({ minSelect }: Rule, count: number): string | null {
  return count < minSelect ? `pick ${minSelect - count} more` : null
}
