// Mapbox public token (pk.…), shared by the map and the address search.
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ""
export const mapboxConfigured = MAPBOX_TOKEN.startsWith("pk.")
