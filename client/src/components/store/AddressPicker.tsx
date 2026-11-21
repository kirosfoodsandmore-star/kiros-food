// Delivery address: saved addresses (when signed in) or a typed line + a pin dropped on the map.
// Placing the pin (device location, map tap or drag) also fills in the address line from where it landed.
import { LocateFixed } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { MapView, mapboxConfigured } from "@/components/shared/MapView"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lowAccuracyNote, roundCoord, useCurrentPosition } from "@/hooks/useCurrentPosition"
import { reversePlace } from "@/lib/geocode"
import { cn } from "@/lib/utils"
import type { Address, DeliveryAddress } from "@/types/store.types"

interface Props {
  value: DeliveryAddress | null
  onChange: (next: DeliveryAddress) => void
  saved?: Address[]
  branch?: { lat: number | null; lng: number | null }
}

export function AddressPicker({ value, onChange, saved = [], branch }: Props) {
  const pin = value?.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null
  const center = pin ?? (branch?.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : undefined)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number }>()
  const { locate, locating } = useCurrentPosition()

  // Latest form value for the async address lookup, so a slow response can't overwrite what was typed meanwhile.
  const latest = useRef(value)
  latest.current = value
  const moves = useRef(0)
  // The last line filled in from the pin: moving the pin may replace it, but never something the customer typed or picked.
  const autoLine = useRef<string | null>(null)

  /** The pin moved. Save it right away, then fill the address line from where it landed if that line is blank or ours. */
  const place = (lat: number, lng: number, fly = false) => {
    const id = ++moves.current
    const [la, ln] = [roundCoord(lat), roundCoord(lng)]
    onChange({ line: latest.current?.line ?? "", lat: la, lng: ln, instructions: latest.current?.instructions })
    if (fly) setFlyTo({ lat, lng })
    if (!mapboxConfigured) return
    reversePlace(la, ln)
      .then((p) => {
        if (!p?.address || id !== moves.current) return
        const now = latest.current
        const line = now?.line ?? ""
        if (line.trim() && line !== autoLine.current) return
        autoLine.current = p.address
        onChange({ line: p.address, lat: la, lng: ln, instructions: now?.instructions })
      })
      .catch(() => {
        // Filling in the address is a courtesy; the pin itself is already saved.
      })
  }

  const locateMe = () =>
    locate((fix) => {
      place(fix.lat, fix.lng, true)
      const note = lowAccuracyNote(fix)
      if (note) toast.warning(note)
    })

  return (
    <div className="space-y-2" data-cy="address-picker">
      {saved.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {saved.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange({ line: a.line, lat: a.lat, lng: a.lng, instructions: a.instructions })}
              className={cn("rounded-md border px-2.5 py-1 text-xs", value?.line === a.line ? "border-primary bg-secondary/50" : "hover:bg-muted")}
              data-cy={`saved-address-${a.id}`}
            >
              {a.label ?? a.line.slice(0, 24)}
            </button>
          ))}
        </div>
      ) : null}
      <Input value={value?.line ?? ""} onChange={(e) => onChange({ line: e.target.value, lat: value?.lat ?? null, lng: value?.lng ?? null, instructions: value?.instructions })} placeholder="Street, building, area" aria-label="Delivery address" data-cy="address-line" />
      <Input value={value?.instructions ?? ""} onChange={(e) => onChange({ line: value?.line ?? "", lat: value?.lat ?? null, lng: value?.lng ?? null, instructions: e.target.value })} placeholder="Directions for the rider (optional)" aria-label="Delivery instructions" data-cy="address-instructions" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pin ? "Drag the pin to your door." : "Tap the map to drop a pin so we can quote delivery."}</span>
        <Button type="button" variant="ghost" size="sm" onClick={locateMe} loading={locating} data-cy="address-locate">
          <LocateFixed /> Use my location
        </Button>
      </div>
      <MapView className="h-56" pins={pin ? [{ id: "pin", ...pin, selected: true }] : []} center={center} zoom={pin ? 16 : 12} flyTo={flyTo} onPick={(pos) => place(pos.lat, pos.lng)} />
    </div>
  )
}
