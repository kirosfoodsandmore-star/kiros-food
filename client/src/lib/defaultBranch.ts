// The branch to show before a visitor has chosen one, so the menu and home page are never empty on a first visit.
// The admin picks it in Settings (the restaurant's defaultBranchId). A branch that is open right now beats one that is
// closed, and a closed one beats one that is paused, so a default that is closed or paused gives way to an open branch.
// Within the same tier the admin's choice wins, then the list order. A default that is no longer offered is ignored.
import type { StoreBranch } from "@/types/store.types"

export function pickDefaultBranch(branches: StoreBranch[], preferredId: string | null): StoreBranch | null {
  if (branches.length === 0) return null
  const rank = (b: StoreBranch) => (b.isOpen && !b.isPaused ? 0 : !b.isPaused ? 1 : 2)
  const best = Math.min(...branches.map(rank))
  const pool = branches.filter((b) => rank(b) === best)
  return pool.find((b) => b.id === preferredId) ?? pool[0]
}
