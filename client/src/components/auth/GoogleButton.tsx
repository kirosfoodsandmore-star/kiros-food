// "Continue with Google" for every sign-in door. It opens Google's account picker through Firebase and hands the
// resulting Firebase ID token to `onIdToken`; the server verifies it and decides whether that Google account is
// allowed in. Nothing renders when Firebase isn't configured for this build.
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { firebaseConfigured, signInWithGoogle } from "@/lib/firebase"

/** What went wrong, in words a person can act on. Null when they simply closed the Google window. */
function problem(err: unknown): string | null {
  const code = (err as { code?: string } | null)?.code
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null
  if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups for this site and try again."
  if (code === "auth/network-request-failed") return "Couldn't reach Google. Check your connection and try again."
  if (code === "auth/unauthorized-domain") return "Google sign-in isn't allowed on this web address yet. Add it in Firebase under Authentication → Settings → Authorized domains."
  return (err as Error | null)?.message || "Google sign-in failed. Please try again."
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

interface Props {
  /** Receives the Firebase ID token. Throw to show an error toast; resolve once you've signed the person in. */
  onIdToken: (idToken: string) => Promise<void>
  label?: string
  /** data-cy hook. */
  cy: string
}

export function GoogleButton({ onIdToken, label = "Continue with Google", cy }: Props) {
  const [busy, setBusy] = useState(false)
  if (!firebaseConfigured) return null

  const click = async () => {
    setBusy(true)
    try {
      await onIdToken(await signInWithGoogle())
    } catch (err) {
      const message = problem(err)
      if (message) toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={click} loading={busy} data-cy={cy}>
        <GoogleMark />
        {label}
      </Button>
    </div>
  )
}
