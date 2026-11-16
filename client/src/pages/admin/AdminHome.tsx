// What "/admin" shows: the dashboard for people who can see it, otherwise their own home (see lib/adminHome).
import { lazy } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { adminHome } from "@/lib/adminHome"

const DashboardPage = lazy(() => import("./DashboardPage"))

export default function AdminHome() {
  const { can, permissions } = useAuth()
  if (can("dashboard.view")) return <DashboardPage />
  return <Navigate to={adminHome(permissions)} replace />
}
