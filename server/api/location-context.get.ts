import { lookupLocation } from '../utils/geocode'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const lat = Number(query.lat)
  const lon = Number(query.lon)

  if ([lat, lon].some((n) => Number.isNaN(n))) {
    throw createError({ statusCode: 400, statusMessage: 'lat and lon are required numbers' })
  }

  return await lookupLocation(lat, lon)
})
