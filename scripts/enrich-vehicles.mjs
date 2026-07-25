#!/usr/bin/env node
// Regenerates vehicle rosters (with Funkrufnamen, and real overrides for the ILS
// Fürstenfeldbruck area) on the already-fetched app/data/stations.json, without
// re-hitting the Overpass API. Run with: node scripts/enrich-vehicles.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { generateVehicleRoster } from './lib/vehicle-roster.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATIONS_PATH = path.resolve(__dirname, '../app/data/stations.json')

async function main() {
  const stations = JSON.parse(await readFile(STATIONS_PATH, 'utf-8'))

  for (const station of stations) {
    station.vehicles = generateVehicleRoster(station)
  }

  await writeFile(STATIONS_PATH, JSON.stringify(stations, null, 2))

  const totalVehicles = stations.reduce((sum, s) => sum + s.vehicles.length, 0)
  console.log(`[enrich-vehicles] regenerated rosters for ${stations.length} stations, ${totalVehicles} vehicles total`)
}

main().catch((err) => {
  console.error('[enrich-vehicles] failed:', err)
  process.exit(1)
})
