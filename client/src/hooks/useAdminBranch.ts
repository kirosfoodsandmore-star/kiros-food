// The branch the admin screens are filtered to, remembered across pages and reloads (and shared by every screen, so the
// sidebar badge follows the branch picked on a page). The remembered value belongs to the browser, not to an account: sign
// in as an owner, pick a branch, then sign in as a branch manager and the manager inherits a branch they can't see, and
// every request that carries it is refused with a 403 (the dashboard shows "could not be loaded"). So a remembered branch
// the signed-in person has no access to is ignored and forgotten.
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { usePersistedState } from "@/hooks/usePersistedState"
import { ADMIN_BRANCH_KEY } from "@/lib/adminBranchKey"

export function useAdminBranch(): [string, (id: string) => void] {
  const { session } = useAuth()
  const [stored, setStored] = usePersistedState<string>(ADMIN_BRANCH_KEY, "")
  const user = session?.user
  const allowed = !stored || !user || user.allBranches || user.branchIds.includes(stored)
  useEffect(() => {
    if (!allowed) setStored("")
  }, [allowed, setStored])
  return [allowed ? stored : "", setStored]
}
