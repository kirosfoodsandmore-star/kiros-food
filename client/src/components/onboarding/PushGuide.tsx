// The notification setup guide: opens a couple of seconds after someone signs in on a device where notifications could
// work but aren't on yet, and walks them through it. It adapts to what they're on:
//   1. why: what their role gets alerted about (so it's worth a minute)
//   2. set up: the browser's permission prompt, or "Add to Home Screen" on an iPhone (Safari can't do notifications until
//      the site is installed), or how to unblock it if they said no before
//   3. done: send themselves a real test notification, so they know it works
// Choices are remembered per person on this device (lib/pushGuide.ts): finished or "don't ask again" is never repeated,
// "maybe later" asks again after a few days, at most twice more. The account page's "Show me how" reopens it any time.
import { BellRing, CheckCircle2, Share, ShieldAlert, Smartphone, SquarePlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { PushEndpoints } from "@/endpoints/admin.endpoints"
import { usePush } from "@/hooks/usePush"
import { enablePush, pushOptedOut, pushState } from "@/lib/push"
import { detectPlatform, guideHeadline, isStandalone, needsInstall, OPEN_GUIDE_EVENT, pushReasons, readGuideRecord, shouldOfferGuide, writeGuideRecord, type GuideOutcome, type GuidePlatform } from "@/lib/pushGuide"
import { cn } from "@/lib/utils"

type Step = "why" | "allow" | "done"
type Mode = "allow" | "install" | "blocked" | "unsupported"
type TestResult = { status: "idle" | "sending" | "sent" | "unreached" | "error"; message?: string }

const UNBLOCK: Record<GuidePlatform, string[]> = {
  ios: ["Open the Settings app", "Tap Notifications, then Kiros (the Home Screen app)", "Turn on Allow Notifications"],
  android: ["Tap the lock icon (or the ⓘ) next to the address", "Tap Permissions, then Notifications", "Choose Allow"],
  desktop: ["Click the lock icon at the left of the address bar", "Find Notifications in the list", "Change it to Allow"],
}

const AFTER_DELAY_MS = 2500

export function PushGuide() {
  const { session, can } = useAuth()
  const userId = session?.user.id
  const push = usePush()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("why")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<TestResult>({ status: "idle" })
  const platform = useMemo(() => detectPlatform(navigator.userAgent, navigator.maxTouchPoints), [])
  const standalone = useMemo(() => isStandalone(), [])
  const reasons = useMemo(() => pushReasons(can), [can])

  // Open for someone new to this device. The delay lets the page settle, and lets the quiet re-registration that runs
  // for people who already allowed notifications finish first, so they aren't asked for something they've already done.
  useEffect(() => {
    if (!userId || reasons.length === 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void pushState().then((state) => {
        if (cancelled) return
        const offer = shouldOfferGuide({ state, install: needsInstall(platform, standalone, state), optedOut: pushOptedOut(), record: readGuideRecord(userId), now: Date.now() })
        if (offer) {
          setStep("why")
          setOpen(true)
        }
      })
    }, AFTER_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [userId, reasons.length, platform, standalone])

  // "Show me how" on the account page.
  const { recheck } = push
  useEffect(() => {
    const reopen = () => {
      recheck()
      setError(null)
      setTest({ status: "idle" })
      setStep("why")
      setOpen(true)
    }
    window.addEventListener(OPEN_GUIDE_EVENT, reopen)
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, reopen)
  }, [recheck])

  if (!userId || reasons.length === 0) return null

  const state = push.state
  const mode: Mode = needsInstall(platform, standalone, state ?? "off") ? "install" : state === "unsupported" ? "unsupported" : state === "blocked" ? "blocked" : "allow"
  const steps = mode === "install" || mode === "unsupported" ? 2 : 3
  const position = step === "why" ? 1 : step === "allow" ? 2 : steps

  const finish = (outcome: GuideOutcome) => {
    writeGuideRecord(userId, outcome)
    setOpen(false)
  }

  const allow = async () => {
    setBusy(true)
    setError(null)
    try {
      await enablePush()
      writeGuideRecord(userId, "done")
      setTest({ status: "idle" })
      setStep("done")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      recheck()
    }
  }

  // They've changed the browser's setting: look again, and carry on if it now works.
  const checkAgain = async () => {
    setError(null)
    const now = await pushState()
    recheck()
    if (now === "off" || now === "on") await allow()
    else setError("It still looks blocked. Check the setting again, then press the button.")
  }

  const sendTest = async () => {
    setTest({ status: "sending" })
    const res = await PushEndpoints.test()
    if (!res.success) setTest({ status: "error", message: res.message })
    else setTest({ status: res.data?.delivered ? "sent" : "unreached" })
  }

  const dots = (
    <ol className="flex gap-1.5" aria-label={`Step ${position} of ${steps}`}>
      {Array.from({ length: steps }, (_, i) => (
        <li key={i} className={cn("h-1.5 rounded-full transition-all", i + 1 === position ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")} aria-current={i + 1 === position ? "step" : undefined} />
      ))}
    </ol>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish(step === "done" ? "done" : "later")}>
      <DialogContent className="sm:max-w-md" data-cy="push-guide">
        {step === "why" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><BellRing className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">{guideHeadline(can)}</DialogTitle>
              <DialogDescription>Turn on notifications on this device and we'll alert you, even when your phone is locked or this app is closed, when:</DialogDescription>
            </DialogHeader>
            <ul className="space-y-2.5 text-sm" data-cy="push-guide-reasons">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{r}</li>
              ))}
            </ul>
            {dots}
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
              <Button onClick={() => setStep("allow")} data-cy="push-guide-start">Set it up</Button>
              <Button variant="ghost" onClick={() => finish("later")} data-cy="push-guide-later">Maybe later</Button>
              <button type="button" className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => finish("never")} data-cy="push-guide-never">Don't ask me again</button>
            </DialogFooter>
          </>
        ) : null}

        {step === "allow" && mode === "allow" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><Smartphone className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">Allow notifications</DialogTitle>
              <DialogDescription>Press the button below. Your browser will then ask whether this site can send you notifications: choose <strong>Allow</strong>.</DialogDescription>
            </DialogHeader>
            {error ? <p className="text-sm text-destructive" role="alert" data-cy="push-guide-error">{error}</p> : null}
            <p className="text-xs text-muted-foreground">You can switch this off whenever you like in My account.</p>
            {dots}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("why")} disabled={busy}>Back</Button>
              <Button onClick={() => void allow()} loading={busy} data-cy="push-guide-allow">Turn on notifications</Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "allow" && mode === "install" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><SquarePlus className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">Add Kiros to your Home Screen</DialogTitle>
              <DialogDescription>iPhones only send notifications to apps on the Home Screen. It takes a few seconds:</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm" data-cy="push-guide-install">
              <li className="flex gap-3"><Num n={1} /><span>Tap the <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Share" /> Share button at the bottom of Safari.</span></li>
              <li className="flex gap-3"><Num n={2} /><span>Scroll down and choose <strong>Add to Home Screen</strong> <SquarePlus className="mx-0.5 inline size-4 align-text-bottom" aria-hidden />, then <strong>Add</strong>.</span></li>
              <li className="flex gap-3"><Num n={3} /><span>Open <strong>Kiros</strong> from your Home Screen and sign in. We'll finish setting up notifications there.</span></li>
            </ol>
            {dots}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("why")}>Back</Button>
              <Button onClick={() => finish("later")} data-cy="push-guide-installed">Got it</Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "allow" && mode === "blocked" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-warning/15 text-warning"><ShieldAlert className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">Notifications are blocked</DialogTitle>
              <DialogDescription>This device was told not to allow them, so the browser won't ask again. You can change that:</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm" data-cy="push-guide-unblock">
              {UNBLOCK[platform].map((line, i) => <li key={line} className="flex gap-3"><Num n={i + 1} /><span>{line}</span></li>)}
            </ol>
            {error ? <p className="text-sm text-destructive" role="alert" data-cy="push-guide-error">{error}</p> : null}
            {dots}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("why")} disabled={busy}>Back</Button>
              <Button onClick={() => void checkAgain()} loading={busy} data-cy="push-guide-recheck">I've allowed it, check again</Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "allow" && mode === "unsupported" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><ShieldAlert className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">This browser can't do notifications</DialogTitle>
              <DialogDescription>Try Chrome, Edge or Firefox, or the installed app on your phone. Until then you'll still see alerts while this screen is open.</DialogDescription>
            </DialogHeader>
            {dots}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("why")}>Back</Button>
              <Button onClick={() => finish("later")}>Close</Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <DialogHeader className="items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-5" aria-hidden /></span>
              <DialogTitle className="text-xl">You're all set</DialogTitle>
              <DialogDescription>Notifications are on for this device. Want to see one arrive?</DialogDescription>
            </DialogHeader>
            <div className="space-y-2" data-cy="push-guide-test">
              <Button variant="outline" onClick={() => void sendTest()} loading={test.status === "sending"} className="w-full" data-cy="push-guide-send-test">
                <BellRing /> {test.status === "idle" ? "Send me a test notification" : "Send another"}
              </Button>
              {test.status === "sent" ? <p className="text-sm text-success" role="status" data-cy="push-guide-test-sent">Sent. A notification should appear on this device in a moment.</p> : null}
              {test.status === "unreached" ? <p className="text-sm text-warning" role="status" data-cy="push-guide-test-unreached">We couldn't reach this device. Check that Do Not Disturb and battery saver aren't blocking notifications, then try again.</p> : null}
              {test.status === "error" ? <p className="text-sm text-destructive" role="alert" data-cy="push-guide-test-error">{test.message}</p> : null}
            </div>
            {dots}
            <DialogFooter>
              <Button onClick={() => finish("done")} data-cy="push-guide-done">Done</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Num({ n }: { n: number }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>{n}</span>
}
