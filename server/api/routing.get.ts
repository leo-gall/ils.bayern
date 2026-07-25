import { getRoute } from '../utils/routing'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fromLat = Number(query.fromLat)
  const fromLon = Number(query.fromLon)
  const toLat = Number(query.toLat)
  const toLon = Number(query.toLon)

  if ([fromLat, fromLon, toLat, toLon].some((n) => Number.isNaN(n))) {
    throw createError({ statusCode: 400, statusMessage: 'fromLat, fromLon, toLat, toLon are required numbers' })
  }

  const config = useRuntimeConfig()
  return await getRoute({ lat: fromLat, lon: fromLon }, { lat: toLat, lon: toLon }, config.orsApiKey)
})
