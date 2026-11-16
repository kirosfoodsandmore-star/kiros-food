// The rider's own sign-in, so riders aren't sent through the admin one. Only accounts that can deliver belong here.
import { Link } from "react-router-dom"
import { PortalLogin } from "@/components/auth/PortalLogin"
import { isRiderOnly } from "@/lib/adminHome"

export default function RiderLoginPage() {
  return (
    <PortalLogin
      title="Rider sign in"
      description="See the deliveries assigned to you."
      // Rider-only accounts. Owners (who hold "*") and managers who also ride use the admin login, where Deliveries is in their sidebar.
      accepts={isRiderOnly}
      wrongDoor={
        <>
          That account isn't set up as a rider. Kitchen or branch staff: <Link to="/staff/login" className="font-medium underline">use the staff login</Link>. Owners and managers: <Link to="/admin/login" className="font-medium underline">use the admin login</Link>.
        </>
      }
      landing={() => "/rider"}
      returnPrefix="/rider"
      otherDoors={[{ label: "Staff login", to: "/staff/login" }, { label: "Admin login", to: "/admin/login" }]}
      cy="rider"
    />
  )
}
