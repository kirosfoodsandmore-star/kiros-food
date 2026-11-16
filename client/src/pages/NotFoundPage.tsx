import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center" data-cy="not-found">
      <p className="font-display text-6xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">That page doesn't exist</h1>
      <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
    </main>
  )
}
