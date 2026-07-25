interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

/**
 * Minimal in-memory sliding-window limiter. There is no auth/session backend in
 * this app, so this just protects the server-held Anthropic key from casual
 * abuse if the dev instance is ever exposed - not meant to be bulletproof.
 */
export function checkRateLimit(key: string, { max, windowMs }: { max: number, windowMs: number }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return
  }
  bucket.count += 1
  if (bucket.count > max) {
    throw createError({ statusCode: 429, statusMessage: 'Zu viele Anfragen, bitte kurz warten.' })
  }
}
