#!/usr/bin/env node
// Replaces the OSM-derived + synthetic stations in app/data/stations.json for a given
// Landkreis with the hand-curated real data from data-source/landkreise/<name>.json
// (real station addresses/coordinates and real vehicle Funkrufnamen, no guessing).
//
// Every station inside the Landkreis's real administrative boundary is dropped from
// stations.json and replaced 1:1 by the curated roster - the two data sets are never
// merged station-by-station, since the curated file is the authoritative, complete list.
//
// Run with: node scripts/apply-landkreis-overrides.mjs <landkreis-name> [<landkreis-name>...]
// e.g.:     node scripts/apply-landkreis-overrides.mjs landsberg

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as turf from '@turf/turf'
import { getDistrictPolygon } from './lib/districts.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LANDKREISE_DIR = path.resolve(__dirname, '../data-source/landkreise')
const STATIONS_PATH = path.resolve(__dirname, '../app/data/stations.json')
const ILS_DISTRICTS_PATH = path.resolve(__dirname, '../data-source/ils-districts.json')

// Maps a data-source/landkreise/<name>.json file to the official Landkreis name used in
// OSM admin boundaries and in data-source/ils-districts.json's `match` strings.
const LANDKREIS_DISTRICT = {
  landsberg: 'Landsberg am Lech'
}

const STATION_TYPE = { FF: 'feuerwache', RD: 'rettungswache', SEG: 'bereitschaft' }

function resolveIlsId(ilsDistricts, districtMatch) {
  for (const ils of ilsDistricts.ils) {
    if (ils.districts.some(d => d.match === districtMatch)) return ils.id
  }
  return null
}

function toStation(entry, ilsId) {
  return {
    id: entry.id,
    osmId: `real:${entry.id}`,
    name: entry.name,
    type: STATION_TYPE[entry.typ] ?? 'feuerwache',
    ilsId,
    lat: entry.lat,
    lon: entry.lon,
    vehicles: entry.einsatzmittel.map((e, index) => ({
      id: `${entry.id}-v${index + 1}`,
      type: e.typ,
      funkrufname: e.funkrufname,
      status: 'frei'
    }))
  }
}

async function applyOverride(name, stations, ilsDistricts) {
  const districtMatch = LANDKREIS_DISTRICT[name]
  if (!districtMatch) {
    throw new Error(`No LANDKREIS_DISTRICT entry for "${name}" - add its official Landkreis name`)
  }

  const ilsId = resolveIlsId(ilsDistricts, districtMatch)
  if (!ilsId) {
    throw new Error(`Could not find an ILS for district "${districtMatch}" in ils-districts.json`)
  }

  const polygon = await getDistrictPolygon(districtMatch)
  if (!polygon) {
    throw new Error(`Could not match district boundary for "${districtMatch}" via Overpass`)
  }

  const raw = JSON.parse(await readFile(path.join(LANDKREISE_DIR, `${name}.json`), 'utf-8'))
  const missingCoords = raw.filter(e => e.lat == null || e.lon == null)
  if (missingCoords.length) {
    throw new Error(`${name}.json has ${missingCoords.length} station(s) without coordinates - run "pnpm geocode:landkreis ${name}" first`)
  }

  const before = stations.length
  const kept = stations.filter(s => !(s.ilsId === ilsId && turf.booleanPointInPolygon(turf.point([s.lon, s.lat]), polygon)))
  const removed = before - kept.length

  const added = raw.map(entry => toStation(entry, ilsId))
  console.log(`[apply-landkreis-overrides] ${name}: removed ${removed} existing station(s) in ${districtMatch}, added ${added.length} real station(s)`)

  return [...kept, ...added]
}

async function main() {
  let names = process.argv.slice(2)
  if (!names.length) {
    const files = await readdir(LANDKREISE_DIR)
    names = files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  }
  if (!names.length) {
    console.error('No Landkreis files found in data-source/landkreise')
    process.exit(1)
  }

  let stations = JSON.parse(await readFile(STATIONS_PATH, 'utf-8'))
  const ilsDistricts = JSON.parse(await readFile(ILS_DISTRICTS_PATH, 'utf-8'))

  for (const name of names) {
    stations = await applyOverride(name, stations, ilsDistricts)
  }

  await writeFile(STATIONS_PATH, JSON.stringify(stations, null, 2))
  console.log(`[apply-landkreis-overrides] done: ${stations.length} stations total`)
}

main().catch((err) => {
  console.error('[apply-landkreis-overrides] failed:', err)
  process.exit(1)
})
