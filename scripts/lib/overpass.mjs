const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]

/**
 * Runs an Overpass QL query, retrying across mirrors/backoff since the
 * public Overpass instances are shared and occasionally rate-limit or time out.
 */
export async function queryOverpass(ql, { attempts = 3 } = {}) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 240_000)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'ils-bayern-data-pipeline/1.0 (+https://github.com/, one-off dev data fetch; contact: leo@lgll.dev)'
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!res.ok) {
        throw new Error(`Overpass ${endpoint} responded ${res.status} ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err
      console.warn(`[overpass] attempt ${attempt + 1}/${attempts} via ${endpoint} failed: ${err.message}`)
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)))
      }
    }
  }
  throw lastError
}
