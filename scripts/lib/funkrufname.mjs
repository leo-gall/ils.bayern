// Real Bavarian BOS Funkrufname construction: "<Organisationskennwort> <Ort> <Kennziffer>/<lfd. Nr.>"
// Kennziffer table per the official Bavarian fire service radio call name scheme.
// Sources: LFV Bayern Funkrufnamen fact sheet; feuerwehr-michelau.de Kennziffern overview.
export const FEUERWEHR_KENNZIFFER = {
  ELW: 12,
  MTW: 14,
  TLF: 23,
  DLK: 30,
  LF: 40,
  HLF: 40,
  TSF: 44,
  RW: 61,
  GW: 53
}

// Rettungsdienst (BRK) Funkrufkennziffern, confirmed via real Leitstelle Fürstenfeldbruck vehicle
// listings (RTW=71, KTW=72, NEF=76).
export const RETTUNGSDIENST_KENNZIFFER = {
  RTW: 71,
  KTW: 72,
  NEF: 76
}

const PREFIX_STRIP = [
  /^Freiwillige Feuerwehr\s+/i,
  /^Freiw\.?\s*Feuerwehr\s+/i,
  /^Feuerwehr\s+/i,
  /^FF\s+/i,
  /^Berufsfeuerwehr\s+/i,
  /^Luftwaffenfeuerwehr\s+/i,
  /^Kreisbrandinspektion\s+/i,
  /^BRK[\s-]*Rettungswache\s+/i,
  /^Rettungswache\s+/i,
  /^BRK\s+/i
]

const SUFFIX_STRIP = [
  /\s*\(.*\)\s*$/,
  /\s+e\.?\s*V\.?$/i,
  /\s*-\s*Wache\s*\d+\s*$/i,
  /\s*-\s*Wache\s*[A-Za-z]+\s*$/i
]

/** Best-effort extraction of the place name a station is named after, for use in a Funkrufname. */
export function extractOrt(stationName) {
  let name = stationName
  for (const re of PREFIX_STRIP) name = name.replace(re, '')
  for (const re of SUFFIX_STRIP) name = name.replace(re, '')
  return name.trim() || stationName
}

/**
 * Organisationskennwort by station type: Feuerwehr uses "Florian" statewide; rescue-service
 * stations default to "Rotkreuz" (BRK runs the large majority of Bavarian Rettungsdienst) unless
 * a specific operator override says otherwise (e.g. Johanniter-run Gröbenzell -> "Johannes").
 */
export function orgPrefixFor(station, operatorOverride) {
  if (operatorOverride) return operatorOverride
  return station.type === 'feuerwache' ? 'Florian' : 'Rotkreuz'
}

export function buildFunkrufname(orgPrefix, ort, type, laufendeNummer) {
  const kennziffer = FEUERWEHR_KENNZIFFER[type] ?? RETTUNGSDIENST_KENNZIFFER[type]
  return `${orgPrefix} ${ort} ${kennziffer}/${laufendeNummer}`
}
