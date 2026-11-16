// Delivery address: saved addresses (when signed in) or a typed line + a pin dropped on the map.
import { LocateFixed } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { MapView } from "@/components/shared/MapView"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Address, DeliveryAddress } from "@/types/store.types"

interface Props {
  value: DeliveryAddress | null
  onChange: (next: DeliveryAddress) => void
  saved?: Address[]
  branch?: { lat: number | null; lng: number | null }
}

export function AddressPicker({ value, onChange, saved = [], branch }: Props) {
  const [locating, setLocating] = useState(false)
  const pin = value?.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null
  const center = pin ?? (branch?.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : undefined)

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Location is not available in this browser")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ line: value?.line ?? "", lat: pos.coords.latitude, lng: pos.coords.longitude, instructions: value?.instructions })
        setLocating(false)
      },
      () => {
        toast.error("Could not read your location")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

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
        <Button type="button" variant="ghost" size="sm" onClick={locate} loading={locating} data-cy="address-locate">
          <LocateFixed /> Use my location
        </Button>
      </div>
      <MapView className="h-56" pins={pin ? [{ id: "pin", ...pin, selected: true }] : []} center={center} zoom={pin ? 16 : 12} onPick={(pos) => onChange({ line: value?.line ?? "", ...pos, instructions: value?.instructions })} />
    </div>
  )
}
