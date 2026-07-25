import * as turf from '@turf/turf'

export interface LatLon {
  lat: number
  lon: number
}

export interface RouteResult {
  durationSeconds: number
  distanceMeters: number
  source: 'ors' | 'osrm' | 'fallback'
  /** [lon, lat] pairs (GeoJSON order) tracing the route, for animating a unit's position. */
  geometry: [number, number][]
}

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function tryOpenRouteService(from: LatLon, to: LatLon, apiKey: string): Promise<RouteResult | null> {
  if (!apiKey) return null
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${encodeURIComponent(apiKey)}&start=${from.lon},${from.lat}&end=${to.lon},${to.lat}`
    const res = await fetchWithTimeout(url, 6000)
    if (!res.ok) return null
    const json = await res.json()
    const feature = json?.features?.[0]
    const summary = feature?.properties?.summary
    if (!summary) return null
    const geometry = feature?.geometry?.coordinates ?? [[from.lon, from.lat], [to.lon, to.lat]]
    return { durationSeconds: summary.duration, distanceMeters: summary.distance, source: 'ors', geometry }
  } catch {
    return null
  }
}

async function tryOsrm(from: LatLon, to: LatLon): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
    const res = await fetchWithTimeout(url, 6000)
    if (!res.ok) return null
    const json = await res.json()
    const route = json?.routes?.[0]
    if (!route) return null
    const geometry = route.geometry?.coordinates ?? [[from.lon, from.lat], [to.lon, to.lat]]
    return { durationSeconds: route.duration, distanceMeters: route.distance, source: 'osrm', geometry }
  } catch {
    return null
  }
}

const AVG_SPEED_KMH = 55
const ROAD_DETOUR_FACTOR = 1.3

function straightLineFallback(from: LatLon, to: LatLon): RouteResult {
  const distanceKm = turf.distance(turf.point([from.lon, from.lat]), turf.point([to.lon, to.lat])) * ROAD_DETOUR_FACTOR
  const durationSeconds = (distanceKm / AVG_SPEED_KMH) * 3600
  return { durationSeconds, distanceMeters: distanceKm * 1000, source: 'fallback', geometry: [[from.lon, from.lat], [to.lon, to.lat]] }
}

export async function getRoute(from: LatLon, to: LatLon, orsApiKey: string): Promise<RouteResult> {
  const ors = await tryOpenRouteService(from, to, orsApiKey)
  if (ors) return ors
  const osrm = await tryOsrm(from, to)
  if (osrm) return osrm
  return straightLineFallback(from, to)
}
