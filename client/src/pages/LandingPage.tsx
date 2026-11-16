// "/" — redirects to the default storefront when one is configured; otherwise points to the admin portal.
import { Navigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const slug = import.meta.env.VITE_DEFAULT_STORE_SLUG as string | undefined
  if (slug) return <Navigate to={`/${slug}`} replace />
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-4xl font-semibold">Kiros</h1>
      <p className="text-muted-foreground">Multi-branch restaurant ordering. Open a restaurant's storefront at /its-slug, or sign in to the admin portal.</p>
      <Button asChild><Link to="/admin/login">Admin portal</Link></Button>
    </main>
  )
}
