#!/usr/bin/env node
// One-time (re-runnable) data pipeline: builds app/data/ils.json and
// app/data/stations.json from OpenStreetMap Overpass data plus the hand-curated
// ILS -> district mapping in data-source/ils-districts.json.
//
// Run with: pnpm run fetch:data

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import osmtogeojson from 'osmtogeojson'
import * as turf from '@turf/turf'
import { queryOverpass } from './lib/overpass.mjs'
import { generateVehicleRoster } from './lib/vehicle-roster.mjs'
import ilsDistricts from '../data-source/ils-districts.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../app/data')
const CACHE_DIR = path.resolve(__dirname, '../.cache')
const FORCE_REFRESH = process.env.FORCE_REFRESH === '1'

async function cachedQuery(cacheName, ql) {
  const cachePath = path.join(CACHE_DIR, cacheName)
  if (!FORCE_REFRESH && existsSync(cachePath)) {
    console.log(`[fetch-data] using cached Overpass response: ${cacheName}`)
    return JSON.parse(await readFile(cachePath, 'utf-8'))
  }
  const data = await queryOverpass(ql)
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cachePath, JSON.stringify(data))
  return data
}

const BOUNDARY_QUERY = `
[out:json][timeout:180];
area["ISO3166-2"="DE-BY"]["admin_level"="4"]->.bavaria;
relation["admin_level"="6"]["boundary"="administrative"](area.bavaria);
out geom;
`

// Generous bounding box around Bavaria (south, west, north, east). A bbox filter is
// far cheaper for Overpass to evaluate than an area/polygon filter, which was timing
// out (504) for this tag set over the whole state; stations just outside the actual
// border are filtered back out afterward via point-in-polygon against the real outline.
const BAVARIA_BBOX = '47.2,8.9,50.6,13.9'

const STATION_QUERY = `
[out:json][timeout:180];
(
  node["amenity"="fire_station"](${BAVARIA_BBOX});
  way["amenity"="fire_station"](${BAVARIA_BBOX});
  node["amenity"="rescue_station"](${BAVARIA_BBOX});
  way["amenity"="rescue_station"](${BAVARIA_BBOX});
  node["emergency"="ambulance_station"](${BAVARIA_BBOX});
  way["emergency"="ambulance_station"](${BAVARIA_BBOX});
);
out center tags;
`

function normalizeName(name) {
  return (name ?? '').trim().toLowerCase()
}

// OSM tags Bavarian Landkreise as "Landkreis X" and kreisfreie Städte as the bare
// place name "X" - stripping that prefix is enough to align with our curated,
// prefix-free `match` strings collected in data-source/ils-districts.json.
function stripAdminPrefix(name) {
  return normalizeName(name).replace(/^landkreis\s+/, '')
}

async function fetchDistrictFeatures() {
  console.log('[fetch-data] querying Overpass for Bavarian Landkreis/kreisfreie Stadt boundaries…')
  const osmData = await cachedQuery('boundaries.json', BOUNDARY_QUERY)
  const geojson = osmtogeojson(osmData)
  const byName = new Map()
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') continue
    const name = stripAdminPrefix(feature.properties?.name)
    if (!name) continue
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(feature)
  }
  console.log(`[fetch-data] resolved ${byName.size} distinct district boundary names`)
  return byName
}

function matchDistrict(byName, matchString) {
  // Exact match only (after stripping the "Landkreis " prefix): a substring/fuzzy
  // fallback here is dangerous, e.g. "Pfaffenhofen an der Ilm" contains "hof" and
  // "Regen" is a substring of "Regensburg" - both would silently mis-assign a
  // whole district to the wrong ILS.
  const key = normalizeName(matchString)
  const exact = byName.get(key)
  return exact?.length ? exact[0] : null
}

async function buildIlsAreas(byName) {
  const results = []
  let totalMatched = 0
  let totalExpected = 0
  for (const ils of ilsDistricts.ils) {
    const matchedFeatures = []
    const missing = []
    for (const district of ils.districts) {
      totalExpected += 1
      const feature = matchDistrict(byName, district.match)
      if (feature) {
        matchedFeatures.push(feature)
        totalMatched += 1
      } else {
        missing.push(district.match)
      }
    }
    if (missing.length) {
      console.warn(`[fetch-data] ${ils.name}: could not match districts: ${missing.join(', ')}`)
    }
    if (!matchedFeatures.length) {
      console.warn(`[fetch-data] ${ils.name}: NO districts matched, skipping area`)
      continue
    }

    const rawUnion = matchedFeatures.length === 1
      ? matchedFeatures[0]
      : turf.union(turf.featureCollection(matchedFeatures))
    const simplified = turf.simplify(rawUnion, { tolerance: 0.002, highQuality: true })
    const bbox = turf.bbox(rawUnion)
    const center = turf.centerOfMass(rawUnion).geometry.coordinates

    results.push({
      id: ils.id,
      name: ils.name,
      city: ils.city,
      website: ils.website,
      districtsMatched: matchedFeatures.length,
      districtsTotal: ils.districts.length,
      center,
      bbox,
      area: simplified.geometry,
      // Kept only in-process (not written to disk) for accurate point-in-polygon joins.
      _rawUnion: rawUnion
    })
  }
  console.log(`[fetch-data] matched ${totalMatched}/${totalExpected} curated district entries`)
  return results
}

async function fetchStations() {
  console.log('[fetch-data] querying Overpass for Feuerwachen/Rettungswachen…')
  const osmData = await cachedQuery('stations.json', STATION_QUERY)
  const stations = []
  for (const el of osmData.elements) {
    const tags = el.tags ?? {}
    const lat = el.type === 'node' ? el.lat : el.center?.lat
    const lon = el.type === 'node' ? el.lon : el.center?.lon
    if (lat == null || lon == null) continue

    const type = tags.amenity === 'fire_station' ? 'feuerwache' : 'rettungswache'
    stations.push({
      osmId: `${el.type}/${el.id}`,
      name: tags.name ?? (type === 'feuerwache' ? `Feuerwache (${el.type}/${el.id})` : `Rettungswache (${el.type}/${el.id})`),
      operator: tags.operator ?? null,
      type,
      lat,
      lon
    })
  }
  console.log(`[fetch-data] fetched ${stations.length} stations (fire + rescue)`)
  return stations
}

const SEAM_GAP_FALLBACK_KM = 3

function assignStationsToIls(stations, ilsAreas, bavariaOutline) {
  let seamFallbackCount = 0
  let droppedOutsideBavaria = 0
  const assigned = []

  for (const station of stations) {
    const point = turf.point([station.lon, station.lat])
    const insideBavaria = turf.booleanPointInPolygon(point, bavariaOutline)
    if (!insideBavaria) {
      droppedOutsideBavaria += 1
      continue
    }

    let matchedIls = ilsAreas.find((ils) => turf.booleanPointInPolygon(point, ils._rawUnion))
    if (!matchedIls) {
      // Station is within Bavaria's true outline but fell into a seam gap between
      // two adjacent district polygons - snap to the nearest ILS centroid, but only
      // within a tight radius so this never masks a real data problem.
      let best = null
      let bestDist = Infinity
      for (const ils of ilsAreas) {
        const d = turf.distance(point, turf.point(ils.center))
        if (d < bestDist) {
          bestDist = d
          best = ils
        }
      }
      if (best && bestDist <= SEAM_GAP_FALLBACK_KM) {
        matchedIls = best
        seamFallbackCount += 1
      }
    }

    if (matchedIls) {
      assigned.push({ ...station, ilsId: matchedIls.id })
    }
  }

  if (seamFallbackCount) {
    console.warn(`[fetch-data] ${seamFallbackCount} stations fell into a polygon seam gap; snapped to nearest ILS centroid (<=${SEAM_GAP_FALLBACK_KM}km)`)
  }
  if (droppedOutsideBavaria) {
    console.warn(`[fetch-data] dropped ${droppedOutsideBavaria} stations outside Bavaria's outline (bbox fetch includes border neighbors)`)
  }
  return assigned
}

function slugifyStationId(station, index) {
  return `st-${station.type === 'feuerwache' ? 'fw' : 'rw'}-${station.osmId.replace('/', '-')}-${index}`
}

async function main() {
  const districtByName = await fetchDistrictFeatures()
  const ilsAreas = await buildIlsAreas(districtByName)

  const bavariaOutline = ilsAreas.length === 1
    ? ilsAreas[0]._rawUnion
    : turf.union(turf.featureCollection(ilsAreas.map((ils) => ils._rawUnion)))

  const rawStations = await fetchStations()
  const joined = assignStationsToIls(rawStations, ilsAreas, bavariaOutline)

  const stations = joined.map((station, index) => {
    const id = slugifyStationId(station, index)
    const vehicles = generateVehicleRoster({ id, osmId: station.osmId, type: station.type, name: station.name, operator: station.operator })
    return {
      id,
      osmId: station.osmId,
      name: station.name,
      type: station.type,
      ilsId: station.ilsId,
      lat: station.lat,
      lon: station.lon,
      vehicles
    }
  })

  const ilsOut = ilsAreas.map(({ _rawUnion, ...rest }) => rest)

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(path.join(OUT_DIR, 'ils.json'), JSON.stringify(ilsOut, null, 2))
  await writeFile(path.join(OUT_DIR, 'stations.json'), JSON.stringify(stations, null, 2))

  console.log('\n[fetch-data] summary')
  console.log(`  ILS regions written:     ${ilsOut.length}/26`)
  console.log(`  stations written:        ${stations.length}`)
  const perType = stations.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})
  console.log(`  by type:                 ${JSON.stringify(perType)}`)
  const withoutStations = ilsOut.filter((ils) => !stations.some((s) => s.ilsId === ils.id))
  if (withoutStations.length) {
    console.warn(`  ILS regions with ZERO stations: ${withoutStations.map((i) => i.id).join(', ')}`)
  }
  console.log(`  output dir:               ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('[fetch-data] failed:', err)
  process.exit(1)
})
