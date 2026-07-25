// Shared Bavarian Landkreis/kreisfreie Stadt boundary lookup, factored out of
// fetch-data.mjs so other scripts (apply-landkreis-overrides.mjs) can point-in-polygon
// test against a district without duplicating the Overpass query/cache logic.

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import osmtogeojson from 'osmtogeojson'
import { queryOverpass } from './overpass.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.resolve(__dirname, '../../.cache')
const FORCE_REFRESH = process.env.FORCE_REFRESH === '1'

const BOUNDARY_QUERY = `
[out:json][timeout:180];
area["ISO3166-2"="DE-BY"]["admin_level"="4"]->.bavaria;
relation["admin_level"="6"]["boundary"="administrative"](area.bavaria);
out geom;
`

function normalizeName(name) {
  return (name ?? '').trim().toLowerCase()
}

// OSM tags Bavarian Landkreise as "Landkreis X" and kreisfreie Städte as the bare
// place name "X" - stripping that prefix aligns with the plain district names used here.
function stripAdminPrefix(name) {
  return normalizeName(name).replace(/^landkreis\s+/, '')
}

let cachedByName = null

async function fetchDistrictFeatures() {
  const cachePath = path.join(CACHE_DIR, 'boundaries.json')
  let osmData
  if (!FORCE_REFRESH && existsSync(cachePath)) {
    osmData = JSON.parse(await readFile(cachePath, 'utf-8'))
  } else {
    console.log('[districts] querying Overpass for Bavarian Landkreis/kreisfreie Stadt boundaries…')
    osmData = await queryOverpass(BOUNDARY_QUERY)
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(cachePath, JSON.stringify(osmData))
  }

  const geojson = osmtogeojson(osmData)
  const byName = new Map()
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') continue
    const name = stripAdminPrefix(feature.properties?.name)
    if (!name) continue
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(feature)
  }
  return byName
}

/** Returns the GeoJSON polygon/multipolygon feature for a district ("Landsberg am Lech",
 * "Landkreis " prefix optional), or null if it couldn't be matched. Exact match only. */
export async function getDistrictPolygon(districtMatch) {
  if (!cachedByName) cachedByName = await fetchDistrictFeatures()
  const key = normalizeName(districtMatch).replace(/^landkreis\s+/, '')
  const matches = cachedByName.get(key)
  return matches?.length ? matches[0] : null
}
