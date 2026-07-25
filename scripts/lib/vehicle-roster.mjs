// Deterministic, seeded vehicle roster generation.
// OSM does not encode which specific vehicles sit at a given Feuerwache/Rettungswache,
// so we synthesize a plausible roster per station (types + Funkrufnamen follow the real
// Bavarian Kennziffer scheme, but exact fleet composition is invented) EXCEPT for the
// hand-researched real stations in scripts/lib/real-ffb-data.mjs, which are used verbatim
// where they match. Seeded by the station's OSM id so re-running the pipeline is stable.

import { extractOrt, orgPrefixFor, buildFunkrufname, FEUERWEHR_KENNZIFFER, RETTUNGSDIENST_KENNZIFFER } from './funkrufname.mjs'
import { REAL_RETTUNGSWACHEN, REAL_FEUERWACHEN, FEUERWEHR_ADDITIONS } from './real-ffb-data.mjs'

function hashSeed(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const CAREER_NAME_HINTS = ['berufsfeuerwehr', 'feuerwache 1', 'hauptfeuerwache']
const VOLUNTEER_NAME_HINTS = ['freiwillige feuerwehr']

function isCareerFireStation(station, rng) {
  const name = (station.name ?? '').toLowerCase()
  const operator = (station.operator ?? '').toLowerCase()
  if (CAREER_NAME_HINTS.some((hint) => name.includes(hint) || operator.includes(hint))) return true
  if (VOLUNTEER_NAME_HINTS.some((hint) => name.includes(hint) || operator.includes(hint))) return false
  // Bavaria only has professional (Berufs-)Feuerwehren in its larger kreisfreie Städte;
  // everywhere else is volunteer (Freiwillige Feuerwehr). Without a reliable tag, bias
  // heavily toward volunteer and let a small random slice represent unlabeled career stations.
  return rng() < 0.06
}

function syntheticTypeList(station, rng) {
  const types = []
  if (station.type === 'rettungswache') {
    const rtwCount = 1 + (rng() < 0.55 ? 1 : 0)
    for (let i = 0; i < rtwCount; i++) types.push('RTW')
    if (rng() < 0.3) types.push('KTW')
    if (rng() < 0.12) types.push('NEF')
  } else {
    const career = isCareerFireStation(station, rng)
    const lfCount = career ? (rng() < 0.6 ? 2 : 1) : 1
    for (let i = 0; i < lfCount; i++) types.push('LF')
    if (career) {
      types.push('ELW')
      if (rng() < 0.7) types.push('DLK')
      if (rng() < 0.35) types.push('RW')
    } else if (rng() < 0.25) {
      types.push('TSF')
    }
  }
  return types
}

function findRealOverride(list, ort, stationName) {
  // Exact match on the extracted place name - a substring/"includes" match is dangerous
  // here (e.g. "Buch" would wrongly match "Buchenau", "Landsberg" would match
  // "Landsberg-Land"), now that entries are precise real village names.
  const lowerOrt = ort.toLowerCase()
  const lowerName = stationName.toLowerCase()
  return list.find((entry) => {
    if (lowerOrt !== entry.ort.toLowerCase()) return false
    if (entry.require && !lowerName.includes(entry.require.toLowerCase())) return false
    if (entry.exclude?.some((ex) => lowerName.includes(ex.toLowerCase()))) return false
    return true
  })
}

let counter = 0
function vehicleId(stationId, type) {
  counter += 1
  return `${stationId}-${type.toLowerCase()}-${counter}`
}

export function generateVehicleRoster(station) {
  const rng = hashSeed(`${station.osmId}:${station.type}`)
  const ort = extractOrt(station.name)

  let typeList
  let operatorOverride
  // Real overrides were researched specifically for this ILS's four Landkreise - without this
  // scope check a same-named village elsewhere in Bavaria (there are several other "Buch"es)
  // would wrongly inherit them too.
  const inScope = station.ilsId === 'fuerstenfeldbruck'

  if (station.type === 'rettungswache') {
    const real = inScope ? findRealOverride(REAL_RETTUNGSWACHEN, ort, station.name) : null
    typeList = real ? [...real.vehicles] : syntheticTypeList(station, rng)
    operatorOverride = real?.operator
  } else {
    const real = inScope ? findRealOverride(REAL_FEUERWACHEN, ort, station.name) : null
    typeList = real ? [...real.vehicles] : syntheticTypeList(station, rng)
    const addition = inScope ? findRealOverride(FEUERWEHR_ADDITIONS, ort, station.name) : null
    if (addition) typeList.push(...addition.add)
  }

  const orgPrefix = orgPrefixFor(station, operatorOverride)
  // Real Funkrufname numbering runs per Kennziffer (radio code), not per type label -
  // e.g. an LF and an HLF at the same station share code 40 and must not both be "40/1".
  const kennzifferIndex = {}
  const vehicles = []
  for (const type of typeList) {
    const kennziffer = FEUERWEHR_KENNZIFFER[type] ?? RETTUNGSDIENST_KENNZIFFER[type]
    kennzifferIndex[kennziffer] = (kennzifferIndex[kennziffer] ?? 0) + 1
    vehicles.push({
      id: vehicleId(station.id, type),
      type,
      funkrufname: buildFunkrufname(orgPrefix, ort, type, kennzifferIndex[kennziffer]),
      status: 'frei'
    })
  }

  return vehicles
}
