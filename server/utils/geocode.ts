export type LocationContext = 'gebaeude' | 'wald' | 'wasser' | 'strasse'

interface NominatimReverseResult {
  category?: string
  class?: string
  type?: string
  addresstype?: string
  display_name?: string
  address?: Record<string, string>
}

async function fetchReverse(lat: number, lon: number): Promise<NominatimReverseResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ils-bayern-game/1.0 (dispatch simulation, reverse geocoding for fictional incidents)' }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function addressFromResult(json: NominatimReverseResult): string | null {
  const addr = json.address
  if (!addr) return json.display_name ?? null
  const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
  const place = addr.city || addr.town || addr.village || addr.municipality
  return [street, place].filter(Boolean).join(', ') || json.display_name || null
}

/**
 * Approximates the terrain at a point from what Nominatim's reverse lookup resolves to:
 * deep in a forest with nothing else nearby it resolves to the enclosing wood/forest
 * polygon itself (category natural/wood or landuse/forest), similarly for water bodies,
 * and to a building/address when one exists nearby. Used to keep spawned incidents
 * plausible for where they land (no "Kellerbrand" in the middle of a forest).
 */
function contextFromResult(json: NominatimReverseResult): LocationContext {
  const category = json.category ?? json.class
  const type = json.type

  if (category === 'natural' && (type === 'wood' || type === 'scrub')) return 'wald'
  if (category === 'landuse' && type === 'forest') return 'wald'
  if (category === 'natural' && (type === 'water' || type === 'bay' || type === 'strait')) return 'wasser'
  if (category === 'waterway') return 'wasser'
  if (category === 'building' || json.addresstype === 'building' || json.address?.house_number) return 'gebaeude'
  if (category === 'landuse' && ['residential', 'commercial', 'industrial', 'farmyard'].includes(type ?? '')) return 'gebaeude'

  return 'strasse'
}

export async function lookupLocation(lat: number, lon: number): Promise<{ address: string | null, context: LocationContext }> {
  const json = await fetchReverse(lat, lon)
  if (!json) return { address: null, context: 'strasse' }
  return { address: addressFromResult(json), context: contextFromResult(json) }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const json = await fetchReverse(lat, lon)
  return json ? addressFromResult(json) : null
}
