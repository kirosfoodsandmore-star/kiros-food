// A short two-note chime for new-order and new-delivery alerts. Silent if the browser won't allow audio.
//
// Browsers keep audio locked until the person has tapped, clicked or typed on the page, and a context made at the moment
// an alert arrives (with nobody having touched the page since it loaded) stays locked, so the alert was silent. One
// shared context is made and unlocked on the first interaction instead (armChime), then reused for every alert.
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    return ctx
  } catch {
    return null
  }
}

/** Unlock audio on the first tap/click/key so later alerts can sound. Returns a cleanup for the listeners. */
export function armChime(): () => void {
  const events = ["pointerdown", "keydown"] as const
  const unlock = () => {
    void audio()?.resume().catch(() => undefined)
    off()
  }
  const off = () => events.forEach((e) => window.removeEventListener(e, unlock))
  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }))
  return off
}

function ring(c: AudioContext): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = "sine"
  o.frequency.setValueAtTime(880, c.currentTime)
  o.frequency.setValueAtTime(1320, c.currentTime + 0.12)
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.5)
}

export function playChime(): void {
  try {
    const c = audio()
    if (!c) return
    if (c.state === "running") ring(c)
    else void c.resume().then(() => (c.state === "running" ? ring(c) : undefined)).catch(() => undefined)
  } catch {
    /* no audio */
  }
}
