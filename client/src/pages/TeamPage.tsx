// "Team login": the one discreet link on the customer website leads here, where people pick the right door. The
// logins themselves aren't advertised anywhere else on the public site, and someone already signed in is sent
// straight to their own portal.
import { ChevronRight } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { adminHome } from "@/lib/adminHome"
import { AuthShell } from "@/pages/admin/auth/LoginPage"

const DOORS = [
  { to: "/admin/login", label: "Admin", hint: "Owners and managers", cy: "team-choose-admin" },
  { to: "/staff/login", label: "Staff", hint: "Kitchen and branch staff", cy: "team-choose-staff" },
  { to: "/rider/login", label: "Rider", hint: "Your deliveries", cy: "team-choose-rider" },
]

export default function TeamPage() {
  const { isAuthenticated, permissions } = useAuth()
  if (isAuthenticated) return <Navigate to={adminHome(permissions)} replace />

  return (
    <AuthShell title="Team login" description="Choose how you sign in.">
      <nav aria-label="Team login" className="space-y-2" data-cy="team-page">
        {DOORS.map((d) => (
          <Link key={d.to} to={d.to} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-primary/60 hover:bg-muted" data-cy={d.cy}>
            <span>
              <span className="block font-medium">{d.label}</span>
              <span className="block text-sm text-muted-foreground">{d.hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>
    </AuthShell>
  )
}
