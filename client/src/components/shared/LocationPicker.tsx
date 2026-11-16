// "Where is it?" without coordinates: search an address or place, use the device location, or drop and drag a pin.
// It reports lat/lng (and the address/city it found) to the form, which never has to show raw numbers.
import { Check, LocateFixed, Loader2, MapPin, Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { DEFAULT_CENTER, MapView } from "@/components/shared/MapView"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { lowAccuracyNote, roundCoord, useCurrentPosition } from "@/hooks/useCurrentPosition"
import { parseCoordinates, reversePlace, searchPlaces, type PlaceResult } from "@/lib/geocode"
import { mapboxConfigured } from "@/lib/mapbox"
import { cn } from "@/lib/utils"

export interface LocationPatch {
  lat: number | null
  lng: number | null
  /** Set only when the picker has something better than what's in the form. */
  address?: string
  city?: string
}

interface Props {
  lat: unknown
  lng: unknown
  /** Current address/city in the form: a pin drop only fills these in when they're blank. */
  address: string
  city: string
  onChange: (patch: LocationPatch) => void
  className?: string
}

const toNum = (v: unknown): number | null => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

export function LocationPicker({ lat, lng, address, city, onChange, className }: Props) {
  const pinLat = toNum(lat)
  const pinLng = toNum(lng)
  const hasPin = pinLat !== null && pinLng !== null

  const listId = useId()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number }>()
  const { locate, locating } = useCurrentPosition()

  // Latest form values for async callbacks, so a slow reverse lookup can't overwrite what was typed meanwhile.
  const latest = useRef({ address, city })
  latest.current = { address, city }
  const pinMoves = useRef(0)

  const pasted = parseCoordinates(query)
  const trimmed = query.trim()

  // Debounced type-ahead. Pasted coordinates need no lookup.
  useEffect(() => {
    if (!mapboxConfigured || trimmed.length < 3 || parseCoordinates(trimmed)) {
      setResults([])
      setSearching(false)
      setFailed(false)
      return
    }
    const ctrl = new AbortController()
    setSearching(true)
    const t = setTimeout(() => {
      searchPlaces(trimmed, { near: hasPin ? { lat: pinLat, lng: pinLng } : DEFAULT_CENTER, signal: ctrl.signal })
        .then((r) => {
          setResults(r)
          setFailed(false)
          setActive(-1)
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return
          setResults([])
          setFailed(true)
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false)
        })
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // The pin is only a search bias; moving it shouldn't re-run a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed])

  const choose = (p: PlaceResult) => {
    pinMoves.current++
    onChange({ lat: roundCoord(p.lat), lng: roundCoord(p.lng), address: p.address || undefined, city: p.city || undefined })
    setFlyTo({ lat: p.lat, lng: p.lng })
    setQuery("")
    setResults([])
    setOpen(false)
  }

  const choosePasted = () => {
    if (pasted) moveTo(pasted.lat, pasted.lng, true)
    setQuery("")
    setOpen(false)
  }

  /** The pin moved (map click, drag, device location or pasted coordinates). Fill blank address/city from where it landed. */
  const moveTo = (la: number, ln: number, fly = false) => {
    const id = ++pinMoves.current
    onChange({ lat: roundCoord(la), lng: roundCoord(ln) })
    if (fly) setFlyTo({ lat: la, lng: ln })
    if (latest.current.address.trim() && latest.current.city.trim()) return
    reversePlace(la, ln)
      .then((p) => {
        if (!p || id !== pinMoves.current) return
        const { address: a, city: c } = latest.current
        const patch: LocationPatch = { lat: roundCoord(la), lng: roundCoord(ln) }
        if (!a.trim() && p.address) patch.address = p.address
        if (!c.trim() && p.city) patch.city = p.city
        if (patch.address || patch.city) onChange(patch)
      })
      .catch(() => {
        // Filling in the address is a courtesy; the pin itself is already saved.
      })
  }

  const setToMyLocation = () =>
    locate((fix) => {
      moveTo(fix.lat, fix.lng, true)
      const note = lowAccuracyNote(fix)
      if (note) toast.warning(note)
    })

  const clearPin = () => {
    pinMoves.current++
    onChange({ lat: null, lng: null })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = pasted ? 1 : results.length
    if (e.key === "ArrowDown" && count) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % count)
    } else if (e.key === "ArrowUp" && count) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? count - 1 : i - 1))
    } else if (e.key === "Enter") {
      // Never submit the surrounding form from here.
      e.preventDefault()
      if (pasted) choosePasted()
      else if (results.length) choose(results[active >= 0 ? active : 0])
    } else if (e.key === "Escape" && open) {
      // Close the list. (SimpleFormDialog keeps the dialog itself open while a combobox is expanded.)
      e.preventDefault()
      setOpen(false)
    }
  }

  if (!mapboxConfigured) return <ManualCoordinates lat={pinLat} lng={pinLng} onChange={onChange} className={className} />

  const showList = open && (Boolean(pasted) || results.length > 0 || failed || (trimmed.length >= 3 && !searching))

  return (
    <div className={cn("space-y-2", className)} data-cy="location-picker">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            aria-label="Search for an address or place"
            placeholder="Search for an address or place…"
            autoComplete="off"
            spellCheck={false}
            className="pl-9 pr-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            data-cy="location-search"
          />
          {searching ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" /> : null}
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              // Keep focus in the input while clicking an option, or blur would close the list first.
              onMouseDown={(e) => e.preventDefault()}
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border bg-card p-1 shadow-lg scrollbar-thin"
            >
              {pasted ? (
                <Option id={`${listId}-0`} active onPick={choosePasted} icon={<MapPin />} title="Use these coordinates" detail={`${pasted.lat}, ${pasted.lng}`} />
              ) : results.map((r, i) => <Option key={r.id} id={`${listId}-${i}`} active={i === active} onPick={() => choose(r)} icon={<MapPin />} title={r.name} detail={r.detail} />)}
              {!pasted && results.length === 0 ? (
                <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
                  {failed ? "Search isn't available right now. Click the map to drop a pin instead." : "No matches. Try a street or landmark and the city."}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={setToMyLocation} disabled={locating} aria-label="Use my current location" title="Use my current location" data-cy="location-here">
          {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
        </Button>
      </div>

      <MapView
        className="h-56"
        pins={hasPin ? [{ id: "branch-pin", lat: pinLat, lng: pinLng, label: "Branch location" }] : []}
        center={hasPin ? { lat: pinLat, lng: pinLng } : undefined}
        zoom={hasPin ? 16 : 11}
        flyTo={flyTo}
        onPick={(p) => moveTo(p.lat, p.lng)}
      />

      <div className="flex min-h-6 items-center justify-between gap-2 text-xs" aria-live="polite">
        {hasPin ? (
          <>
            <span className="flex items-center gap-1.5 text-success" data-cy="location-status">
              <Check className="size-3.5" aria-hidden /> Pin set. Drag it to fine-tune.
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearPin} data-cy="location-clear">
              <X /> Remove pin
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground" data-cy="location-status">Search above, or click the map to drop a pin.</span>
        )}
      </div>
    </div>
  )
}

function Option({ id, active, onPick, icon, title, detail }: { id: string; active: boolean; onPick: () => void; icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onClick={onPick}
      className={cn("flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground", active ? "bg-muted" : "hover:bg-muted")}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </li>
  )
}

/** Without a Mapbox token there's no search or map, so fall back to plain coordinates rather than losing the feature. */
function ManualCoordinates({ lat, lng, onChange, className }: { lat: number | null; lng: number | null; onChange: (p: LocationPatch) => void; className?: string }) {
  // Keep what's typed as text ("6." is a valid thing to have half-typed) and only report the parsed number.
  const [raw, setRaw] = useState({ lat: lat === null ? "" : String(lat), lng: lng === null ? "" : String(lng) })
  useEffect(() => {
    const same = (text: string, n: number | null) => toNum(text) === n
    setRaw((r) => ({ lat: same(r.lat, lat) ? r.lat : lat === null ? "" : String(lat), lng: same(r.lng, lng) ? r.lng : lng === null ? "" : String(lng) }))
  }, [lat, lng])
  const set = (which: "lat" | "lng", text: string) => {
    const next = { ...raw, [which]: text }
    setRaw(next)
    onChange({ lat: toNum(next.lat), lng: toNum(next.lng) })
  }
  return (
    <div className={cn("space-y-2", className)} data-cy="location-manual">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude"><Input inputMode="decimal" value={raw.lat} onChange={(e) => set("lat", e.target.value)} placeholder="6.5244" /></Field>
        <Field label="Longitude"><Input inputMode="decimal" value={raw.lng} onChange={(e) => set("lng", e.target.value)} placeholder="3.3792" /></Field>
      </div>
      <p className="text-xs text-muted-foreground">Address search and the map pin need a Mapbox token (VITE_MAPBOX_TOKEN).</p>
    </div>
  )
}
