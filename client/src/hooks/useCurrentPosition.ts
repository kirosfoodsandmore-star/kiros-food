// "Where am I?" from the device, for setting a branch's pin without hunting for it on a map.
import { useCallback, useState } from "react"
import { toast } from "sonner"

export interface DeviceFix {
  lat: number
  lng: number
  /** How far off the fix could be, in metres. Phones are usually within tens; a desktop on Wi-Fi can be hundreds. */
  accuracyM: number
}

/** Six decimals is about 10 cm, plenty for a pin and tidy to store. */
export const roundCoord = (n: number) => Number(n.toFixed(6))

function messageFor(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Location access is blocked for this site. Allow it from the lock icon in your browser's address bar, then try again."
  if (err.code === err.POSITION_UNAVAILABLE) return "Your device couldn't work out where it is. Check that location services are turned on."
  if (err.code === err.TIMEOUT) return "Finding your location took too long. Try again, or click the map instead."
  return "Couldn't get your location. Click the map instead."
}

/** A heads-up when the fix is too rough to trust, or null when it's fine. */
export function lowAccuracyNote(fix: DeviceFix): string | null {
  if (fix.accuracyM < 300) return null
  const m = fix.accuracyM >= 1000 ? `${(fix.accuracyM / 1000).toFixed(1)} km` : `${Math.round(fix.accuracyM)} m`
  return `This device could only place you within about ${m}. Drag the pin to fine-tune it.`
}

export function useCurrentPosition() {
  const [locating, setLocating] = useState(false)

  /** Asks the browser (which prompts for permission the first time). Failures are reported here; `onFix` only runs on success. */
  const locate = useCallback((onFix: (fix: DeviceFix) => void) => {
    if (!navigator.geolocation) {
      toast.error("This browser can't share your location. Click the map instead.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy })
      },
      (err) => {
        setLocating(false)
        toast.error(messageFor(err))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    )
  }, [])

  return { locate, locating }
}
