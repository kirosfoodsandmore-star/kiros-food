// Mapbox wrapper: places for branches (branch picker, branches overview) or a draggable pin for a delivery address.
// For several places it fits them all into view, names each one, and groups ones that sit close together into a count
// bubble that zooms in when clicked, so a map of a whole country stays readable.
import { MapPin } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import MapGL, { Marker, NavigationControl, type MapMouseEvent, type MapRef } from "react-map-gl/mapbox"
import { MAPBOX_TOKEN, mapboxConfigured } from "@/lib/mapbox"
import { cn } from "@/lib/utils"

export { MAPBOX_TOKEN, mapboxConfigured }

export interface MapPinData {
  id: string
  lat: number
  lng: number
  label?: string
  selected?: boolean
  muted?: boolean
}

interface MapViewProps {
  pins: MapPinData[]
  onPinClick?: (id: string) => void
  /** When set, clicking the map moves a single draggable pin and reports the new position. */
  onPick?: (pos: { lat: number; lng: number }) => void
  /** Where to look. Without it the map fits all the pins (or centres on the one pin). */
  center?: { lat: number; lng: number }
  zoom?: number
  /** Glide the camera to a point. Pass a new object each time (e.g. after a search) to move again. */
  flyTo?: { lat: number; lng: number; zoom?: number }
  className?: string
}

/** Where maps start, and what address search leans toward, when there's no pin yet. */
export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }

// Streets shows towns, roads, parks, buildings and place names in colour (like a familiar road map), and it's used
// in both themes: the dark Mapbox styles (navigation-night especially: teal roads, faint labels on near-black)
// made places hard to pick out, which matters most when someone is placing a pin on their door.
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12"

const FIT = { padding: 56, maxZoom: 14 }
/** Pins closer together than this (in screen pixels) are drawn as one bubble. */
const CLUSTER_PX = 44
/** Zoomed in this far, pins are never grouped. */
const CLUSTER_OFF_ZOOM = 16

type Bounds = [[number, number], [number, number]]
type InitialViewState = NonNullable<ComponentProps<typeof MapGL>["initialViewState"]>

const boundsOf = (pins: MapPinData[]): Bounds => [
  [Math.min(...pins.map((p) => p.lng)), Math.min(...pins.map((p) => p.lat))],
  [Math.max(...pins.map((p) => p.lng)), Math.max(...pins.map((p) => p.lat))],
]

interface Place {
  key: string
  lat: number
  lng: number
  x: number
  y: number
  pins: MapPinData[]
}

interface Layout {
  places: Place[]
  /** Ids of single pins whose name fits without covering something else. */
  named: Set<string>
}

const rank = (p: MapPinData) => (p.selected ? 0 : p.muted ? 2 : 1)
const hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]

/** Groups close pins, then decides which names can be shown without overlapping each other or a pin. */
function layoutPins(pins: MapPinData[], project: (p: { lat: number; lng: number }) => { x: number; y: number }, zoom: number, grouping: boolean, namesForAll: boolean): Layout {
  const order = [...pins].sort((a, b) => rank(a) - rank(b))
  const pts = new Map(order.map((p) => [p.id, project(p)]))
  const taken = new Set<string>()
  const places: Place[] = []
  for (const p of order) {
    if (taken.has(p.id)) continue
    const a = pts.get(p.id)!
    const members = [p]
    taken.add(p.id)
    if (grouping && zoom < CLUSTER_OFF_ZOOM) {
      for (const q of order) {
        if (taken.has(q.id)) continue
        const b = pts.get(q.id)!
        if (Math.hypot(a.x - b.x, a.y - b.y) <= CLUSTER_PX) {
          members.push(q)
          taken.add(q.id)
        }
      }
    }
    const n = members.length
    places.push({
      key: n === 1 ? p.id : `cluster:${members.map((m) => m.id).join(",")}`,
      lat: members.reduce((s, m) => s + m.lat, 0) / n,
      lng: members.reduce((s, m) => s + m.lng, 0) / n,
      x: members.reduce((s, m) => s + pts.get(m.id)!.x, 0) / n,
      y: members.reduce((s, m) => s + pts.get(m.id)!.y, 0) / n,
      pins: members,
    })
  }

  // Every pin and bubble claims its space first; names then take whatever room is left, most important first.
  const occupied = places.map((pl) => (pl.pins.length > 1 ? [pl.x - 18, pl.y - 18, pl.x + 18, pl.y + 18] : [pl.x - 14, pl.y - 32, pl.x + 14, pl.y]))
  const named = new Set<string>()
  for (const pl of places) {
    const p = pl.pins[0]
    if (pl.pins.length > 1 || !p.label || !(namesForAll || p.selected)) continue
    const w = Math.min(160, p.label.length * 6.4 + 16)
    const box = [pl.x - w / 2, pl.y + 2, pl.x + w / 2, pl.y + 22]
    if (p.selected || !occupied.some((o) => hit(o, box))) {
      named.add(p.id)
      occupied.push(box)
    }
  }
  return { places, named }
}

export function MapView({ pins, onPinClick, onPick, center, zoom = 11, flyTo, className }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])
  const display = !onPick

  useEffect(() => {
    if (flyTo) mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 15, duration: 900 })
  }, [flyTo])

  const autoFit = display && !center && pins.length > 0
  const initial = useMemo<InitialViewState>(() => {
    if (center) return { latitude: center.lat, longitude: center.lng, zoom }
    if (display && pins.length > 1) return { bounds: boundsOf(pins), fitBoundsOptions: FIT }
    const c = pins[0] ?? DEFAULT_CENTER
    return { latitude: c.lat, longitude: c.lng, zoom: display && pins.length === 1 ? Math.max(zoom, 13) : zoom }
    // Only the first render's view matters; later changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If the places change after the map is up (branches finish loading, one is added), bring them all back into view.
  const pinsKey = pins.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|")
  const shown = useRef(pinsKey)
  useEffect(() => {
    if (shown.current === pinsKey) return
    shown.current = pinsKey
    const map = mapRef.current
    if (!map || !autoFit) return
    if (pins.length === 1) map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: Math.max(zoom, 13), duration: 600 })
    else map.fitBounds(boundsOf(pins), { ...FIT, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey])

  const layout = useMemo<Layout | null>(() => {
    const map = mapRef.current?.getMap()
    if (!map || pins.length === 0) return null
    return layoutPins(pins, (p) => map.project([p.lng, p.lat]), map.getZoom(), display && pins.length > 1, display)
    // `tick` re-runs this when the camera moves; the map instance is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, tick, display])

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      onPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    },
    [onPick]
  )

  if (!mapboxConfigured) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground", className)} data-cy="map-unavailable">
        Map unavailable — set VITE_MAPBOX_TOKEN to show branch locations.
      </div>
    )
  }

  // Before the map exists there's nothing to measure, so show every pin on its own; the layout takes over once it loads.
  const places: Place[] = layout?.places ?? pins.map((p) => ({ key: p.id, lat: p.lat, lng: p.lng, x: 0, y: 0, pins: [p] }))

  return (
    <div className={cn("overflow-hidden rounded-xl border", className)} data-cy="map">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initial}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        onClick={onPick ? handleClick : undefined}
        onLoad={bump}
        onMoveEnd={bump}
        cursor={onPick ? "crosshair" : "grab"}
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="top-right" showCompass={false} />
        {places.map((pl) => {
          if (pl.pins.length > 1) {
            const hasSelected = pl.pins.some((p) => p.selected)
            return (
              <Marker key={pl.key} latitude={pl.lat} longitude={pl.lng} anchor="center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    mapRef.current?.fitBounds(boundsOf(pl.pins), { padding: 80, maxZoom: CLUSTER_OFF_ZOOM, duration: 600 })
                  }}
                  className={cn("grid size-9 place-items-center rounded-full text-sm font-semibold shadow-lg ring-2 ring-white transition-transform hover:scale-110", hasSelected ? "bg-accent text-accent-foreground" : "bg-foreground text-background")}
                  aria-label={`${pl.pins.length} places here. Zoom in`}
                  data-cy="map-cluster"
                >
                  {pl.pins.length}
                </button>
              </Marker>
            )
          }
          const p = pl.pins[0]
          return (
            <Marker
              key={pl.key}
              latitude={p.lat}
              longitude={p.lng}
              anchor="bottom"
              draggable={Boolean(onPick)}
              onDragEnd={onPick ? (e) => onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onPinClick?.(p.id)
              }}
            >
              {/* The pin's tip sits on the coordinate; the name hangs below it without shifting the pin. */}
              <button type="button" className="group relative block" aria-label={p.label ?? "Location"} data-cy={`map-pin-${p.id}`}>
                <MapPin
                  className={cn("size-8 stroke-white drop-shadow-md transition-transform group-hover:scale-110", p.selected ? "fill-accent" : p.muted ? "fill-muted-foreground" : "fill-primary")}
                  strokeWidth={1.75}
                />
                {(layout ? layout.named.has(p.id) : p.selected && p.label) ? (
                  <span className={cn("pointer-events-none absolute left-1/2 top-full mt-0.5 max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded bg-card px-1.5 py-0.5 text-[11px] font-medium text-card-foreground shadow ring-1 ring-black/10", p.selected && "ring-accent")}>
                    {p.label}
                  </span>
                ) : null}
              </button>
            </Marker>
          )
        })}
      </MapGL>
    </div>
  )
}
