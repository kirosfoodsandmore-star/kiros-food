// The way from the customer website into the team's own screens. Customers only ever see one quiet "Team login"
// link (footer and phone menu) that opens a page where people choose Admin, Staff or Rider; the individual logins
// aren't advertised on the public site. Someone already signed in gets a direct link back to their portal.
import { ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { adminHome, isRiderOnly } from "@/lib/adminHome"

export interface TeamEntry {
  label: string
  href: string
  hint: string
}

export function useTeamEntries(): { signedIn: boolean; entries: TeamEntry[] } {
  const { isAuthenticated, permissions } = useAuth()
  if (!isAuthenticated) return { signedIn: false, entries: [{ label: "Team login", href: "/team", hint: "Admin, staff and riders" }] }
  return {
    signedIn: true,
    entries: [isRiderOnly(permissions) ? { label: "My deliveries", href: "/rider", hint: "Back to your deliveries" } : { label: "Team portal", href: adminHome(permissions), hint: "Back to your work" }],
  }
}

/** In the header, only for someone already signed in: a quick way back to their portal. Customers see nothing here. */
export function TeamPortalLink() {
  const { signedIn, entries } = useTeamEntries()
  if (!signedIn) return null
  return (
    <Button variant="ghost" size="sm" className="hidden text-muted-foreground lg:inline-flex" asChild>
      <Link to={entries[0].href} data-cy="team-link"><ShieldCheck /> {entries[0].label}</Link>
    </Button>
  )
}
