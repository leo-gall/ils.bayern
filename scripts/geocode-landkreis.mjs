#!/usr/bin/env node
// Adds lat/lon coordinates to a per-Landkreis station roster in
// data-source/landkreise/<name>.json, geocoding each station's `adresse` via Nominatim.
// Re-runnable: stations that already carry lat/lon are left untouched, and every lookup
// is cached in .cache/geocode-<name>.json so re-runs (after a rate-limit hiccup, a fixed
// address, etc.) don't re-query addresses that already resolved.
//
// Run with: node scripts/geocode-landkreis.mjs <landkreis-name>
// e.g.:     node scripts/geocode-landkreis.mjs landsberg

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { geocodeAddress } from './lib/nominatim.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../data-source/landkreise')
const CACHE_DIR = path.resolve(__dirname, '../.cache')

const name = process.argv[2]
if (!name) {
  console.error('Usage: node scripts/geocode-landkreis.mjs <landkreis-name>')
  process.exit(1)
}

const filePath = path.join(DATA_DIR, `${name}.json`)
const cachePath = path.join(CACHE_DIR, `geocode-${name}.json`)

function addressKey(adresse) {
  return `${adresse.strasse}, ${adresse.plz} ${adresse.ort}`
}

// Rebuilds the station with lat/lon inserted right after `adresse`, instead of just
// assigning the properties (which would append them after `einsatzmittel`), so the
// written JSON reads in a sensible field order.
function withCoordinates(station, coords) {
  const { id, name, adresse, typ, einsatzmittel } = station
  return { id, name, adresse, lat: coords.lat, lon: coords.lon, typ, einsatzmittel }
}

async function main() {
  const stations = JSON.parse(await readFile(filePath, 'utf-8'))
  const cache = existsSync(cachePath) ? JSON.parse(await readFile(cachePath, 'utf-8')) : {}

  let geocoded = 0
  let failed = 0
  const result = []

  for (const station of stations) {
    if (station.lat != null && station.lon != null) {
      result.push(station)
      continue
    }

    const key = addressKey(station.adresse)
    let coords = cache[key]
    if (coords === undefined) {
      console.log(`[geocode-landkreis] looking up: ${key}`)
      coords = await geocodeAddress(station.adresse)
      cache[key] = coords
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(cachePath, JSON.stringify(cache, null, 2))
    }

    if (coords) {
      result.push(withCoordinates(station, coords))
      geocoded += 1
    } else {
      console.warn(`[geocode-landkreis] no match for: ${key}`)
      result.push(station)
      failed += 1
    }
  }

  await writeFile(filePath, JSON.stringify(result, null, 2) + '\n')
  console.log(`[geocode-landkreis] done: ${geocoded} geocoded, ${failed} failed, ${stations.length} total`)
}

main().catch((err) => {
  console.error('[geocode-landkreis] failed:', err)
  process.exit(1)
})
