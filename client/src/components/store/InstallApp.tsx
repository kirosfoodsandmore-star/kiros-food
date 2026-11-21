// "Get the app": wraps any button. One tap installs: it opens the browser's own install dialog (Chrome, Edge, Android).
// It is only rendered where that works, or on iPhone/iPad, where Apple offers no install API and the person has to use
// Safari's Share menu, so there the tap shows those two steps. Nowhere else does it show instructions. Once the site is
// running as an installed app, or the browser can't install it, nothing renders.
import { Share, SquarePlus } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useInstallApp } from "@/lib/installApp"

function IosSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="install-help">
        <DialogHeader>
          <DialogTitle>Add KIROS Foods to your Home Screen</DialogTitle>
          <DialogDescription>Apple only lets you do this from Safari.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Tap <b>Share</b> <Share className="inline size-4 align-text-bottom" aria-hidden /> at the bottom of Safari.</li>
          <li>Tap <b>Add to Home Screen</b> <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />, then <b>Add</b>.</li>
        </ol>
      </DialogContent>
    </Dialog>
  )
}

/** `children` renders the trigger; call the function it receives when it is clicked. */
export function InstallApp({ children }: { children: (install: () => void) => ReactNode }) {
  const { installed, canPrompt, install, ios } = useInstallApp()
  const [steps, setSteps] = useState(false)
  if (installed || (!canPrompt && !ios)) return null
  const onClick = () => {
    if (canPrompt) void install()
    else setSteps(true)
  }
  return (
    <>
      {children(onClick)}
      {ios && !canPrompt ? <IosSteps open={steps} onOpenChange={setSteps} /> : null}
    </>
  )
}
