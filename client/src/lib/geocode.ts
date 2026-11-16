// Address search on Mapbox's Geocoding API (v6), so nobody has to know a latitude or longitude.
import { MAPBOX_TOKEN } from "@/lib/mapbox"

const BASE = "https://api.mapbox.com/search/geocode/v6"

export interface PlaceResult {
  id: string
  /** Short name, e.g. "Allen Avenue". */
  name: string
  /** The rest of the line, e.g. "Ikeja, Lagos, Nigeria". */
  detail: string
  /** Single-line address to put in the address field. */
  address: string
  /** Best guess at the city/town, may be empty. */
  city: string
  lat: number
  lng: number
}

interface GeocodeFeature {
  id?: string
  properties?: {
    mapbox_id?: string
    name?: string
    name_preferred?: string
    full_address?: string
    place_formatted?: string
    coordinates?: { latitude?: number; longitude?: number }
    context?: Record<string, { name?: string } | undefined>
  }
  geometry?: { coordinates?: [number, number] }
}

function toPlace(f: GeocodeFeature): PlaceResult | null {
  const p = f.properties
  const lng = p?.coordinates?.longitude ?? f.geometry?.coordinates?.[0]
  const lat = p?.coordinates?.latitude ?? f.geometry?.coordinates?.[1]
  if (!p || typeof lat !== "number" || typeof lng !== "number") return null
  const ctx = p.context ?? {}
  const name = p.name_preferred ?? p.name ?? ""
  const detail = p.place_formatted ?? ""
  return {
    id: p.mapbox_id ?? f.id ?? `${lat},${lng}`,
    name,
    detail,
    address: p.full_address ?? [name, detail].filter(Boolean).join(", "),
    city: ctx.place?.name ?? ctx.locality?.name ?? ctx.district?.name ?? ctx.region?.name ?? "",
    lat,
    lng,
  }
}

async function request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<PlaceResult[]> {
  const qs = new URLSearchParams({ ...params, access_token: MAPBOX_TOKEN })
  const res = await fetch(`${BASE}/${path}?${qs}`, { signal })
  if (!res.ok) throw new Error(`Address search failed (${res.status})`)
  const body = (await res.json()) as { features?: GeocodeFeature[] }
  return (body.features ?? []).map(toPlace).filter((x): x is PlaceResult => x !== null)
}

/** Type-ahead search. `near` biases results toward a point without excluding anywhere else. */
export function searchPlaces(query: string, opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}): Promise<PlaceResult[]> {
  const params: Record<string, string> = { q: query, limit: "5", autocomplete: "true", language: "en" }
  if (opts.near) params.proximity = `${opts.near.lng},${opts.near.lat}`
  return request("forward", params, opts.signal)
}

/** The address at a point; resolves to null where there's nothing sensible (open water, etc.). */
export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
  const [first] = await request("reverse", { latitude: String(lat), longitude: String(lng), limit: "1", language: "en" }, signal)
  return first ?? null
}

/** Accepts what Google Maps copies ("6.4281, 3.4219") so people can paste a pin straight in. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}
