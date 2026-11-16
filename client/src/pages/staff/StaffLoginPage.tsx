// The sign-in for kitchen and branch staff: the people who work the orders day to day. It lands them on the live order
// board. Riders have their own sign-in, and owners and managers can use the admin one (or this one: they're welcome).
import { Link } from "react-router-dom"
import { PortalLogin } from "@/components/auth/PortalLogin"
import { isRiderOnly, staffHome } from "@/lib/adminHome"

export default function StaffLoginPage() {
  return (
    <PortalLogin
      title="Staff sign in"
      description="For kitchen and branch staff: your live orders."
      accepts={(p) => !isRiderOnly(p)}
      wrongDoor={
        <>
          That's a rider account. Riders sign in with the <Link to="/rider/login" className="font-medium underline">rider login</Link>.
        </>
      }
      landing={staffHome}
      returnPrefix="/admin"
      otherDoors={[{ label: "Admin login", to: "/admin/login" }, { label: "Rider login", to: "/rider/login" }]}
      cy="staff"
    />
  )
}
