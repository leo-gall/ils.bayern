interface LatLon {
  lat: number
  lon: number
}

interface RouteResult {
  durationSeconds: number
  distanceMeters: number
  source: 'ors' | 'osrm' | 'fallback'
  geometry: [number, number][]
}

function routeKey(from: LatLon, to: LatLon) {
  const r = (n: number) => n.toFixed(4)
  return `${r(from.lat)},${r(from.lon)}->${r(to.lat)},${r(to.lon)}`
}

/**
 * Real driving-time ETA between two points, proxied server-side through
 * /api/routing (OpenRouteService -> OSRM -> straight-line fallback chain).
 * Results are cached in the persisted game store since stations are fixed and
 * many incidents reuse similar geometry.
 */
export function useRouting() {
  const store = useGameStore()

  async function getEta(from: LatLon, to: LatLon): Promise<RouteResult> {
    const key = routeKey(from, to)
    const cached = store.routeCache[key]
    if (cached) {
      return { durationSeconds: cached.durationSeconds, distanceMeters: cached.distanceMeters, source: cached.source, geometry: cached.geometry }
    }

    const result = await $fetch<RouteResult>('/api/routing', {
      query: {
        fromLat: from.lat,
        fromLon: from.lon,
        toLat: to.lat,
        toLon: to.lon
      }
    })

    store.cacheRoute(key, { ...result, cachedAt: Date.now() })
    return result
  }

  return { getEta }
}
