// Structured address geocoding via the public Nominatim (OpenStreetMap) search API.
// Nominatim's usage policy caps public-instance traffic at 1 request/second and
// requires an identifying User-Agent - see https://operations.osmfoundation.org/policies/nominatim/.

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'ils-bayern-data-pipeline/1.0 (+https://github.com/, one-off dev data fetch; contact: leo@lgll.dev)'
const MIN_INTERVAL_MS = 1100

let lastRequestAt = 0

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

/**
 * Looks up a structured German address and returns its coordinates, or null if
 * Nominatim found no match. Throws on transport/HTTP errors so the caller can retry.
 */
export async function geocodeAddress({ strasse, plz, ort }) {
  await throttle()
  const params = new URLSearchParams({
    format: 'jsonv2',
    street: strasse,
    postalcode: plz,
    city: ort,
    country: 'Germany',
    limit: '1'
  })
  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' }
  })
  if (!res.ok) {
    throw new Error(`Nominatim responded ${res.status} ${res.statusText}`)
  }
  const results = await res.json()
  if (!results.length) return null
  return { lat: Number(results[0].lat), lon: Number(results[0].lon) }
}
