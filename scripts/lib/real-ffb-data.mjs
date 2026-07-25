// Hand-researched real vehicle rosters for the ILS Fürstenfeldbruck coverage area
// (Landkreise Fürstenfeldbruck, Dachau, Starnberg, Landsberg am Lech).
//
// Sources:
// - Feuerwehr fleet-per-village data (57 stations): https://bos-fahrzeuge.info/standorte/72/Fuerstenfeldbruck/feuerwehr/
//   (crowd-sourced real BOS vehicle registry; parsed from the "aktiv", non-"a.D." entries across
//   its 6 result pages - see scripts/lib/real-ffb-data.README for the extraction method).
// - Rettungswachen/Rettungsdienst counts: https://wiki.lstsim.de/Leitstelle_F%C3%BCrstenfeldbruck/Fahrzeuge
// - BRK Kreisverband Fürstenfeldbruck: https://www.brk-ffb.de/angebote/bevoelkerungsschutz-und-rettung/rettungsdienst/rettungsmittel/rettungswagen.html
// - Feuerwehr Fürstenfeldbruck Technik: https://www.feuerwehr-ffb.de/feuerwehr/technik/
// - Kreis-Sonderfahrzeuge: https://www.ff-emmering.de/2018/02/05/spezalfahrzeuge-des-lk-fuerstenfeldbruck/
//
// NOTE: the bos-fahrzeuge.info roster per village is what contributors happened to document,
// not a guaranteed-complete inventory - a station listed with only e.g. one MTW may well have
// an LF/TSF in reality that nobody photographed/logged. It is still real, sourced data rather
// than an invented one, so it's used verbatim. Villages with zero bos-fahrzeuge.info entries
// still fall back to the procedurally generated roster.

function counts(spec) {
  const vehicles = []
  for (const [type, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) vehicles.push(type)
  }
  return vehicles
}

// Rettungswachen: matched by substring against the station's extracted "Ort" name.
// operator: Funkrufname-Organisationskennwort override (defaults to "Rotkreuz" for BRK).
export const REAL_RETTUNGSWACHEN = [
  { ort: 'Dachau', vehicles: counts({ RTW: 3, KTW: 1, NEF: 1 }) },
  { ort: 'Indersdorf', vehicles: counts({ RTW: 1, NEF: 1 }) },
  { ort: 'Odelzhausen', vehicles: counts({ RTW: 1 }) },
  { ort: 'Fürstenfeldbruck', vehicles: counts({ RTW: 3, KTW: 3, NEF: 2 }) },
  { ort: 'Germering', vehicles: counts({ RTW: 3 }) },
  { ort: 'Gröbenzell', vehicles: counts({ RTW: 1, KTW: 1, NEF: 1 }), operator: 'Johannes' },
  { ort: 'Türkenfeld', vehicles: counts({ RTW: 1 }) },
  { ort: 'Dießen', vehicles: counts({ RTW: 1, NEF: 1 }) },
  { ort: 'Landsberg', vehicles: counts({ RTW: 2, KTW: 3, NEF: 1 }) },
  { ort: 'Gauting', vehicles: counts({ RTW: 1, KTW: 1, NEF: 1 }) },
  { ort: 'Seefeld', vehicles: counts({ RTW: 1, KTW: 1, NEF: 1 }) },
  { ort: 'Starnberg', vehicles: counts({ RTW: 3, KTW: 3, NEF: 1 }) },
  // Windach (Ldkr. Landsberg am Lech): not tagged in OSM, so fetch-data.mjs never
  // creates this station on its own - app/data/stations.json carries a hand-added
  // "Rettungswache Windach (im Feuerwehrhaus)" record (co-located with the Feuerwache
  // below) that this entry keeps in sync across enrich-vehicles.mjs re-runs.
  { ort: 'Windach', vehicles: counts({ RTW: 1 }) }
]

// Feuerwachen: full roster replacement for the well-documented main stations. `require`/
// `exclude` disambiguate real-world duplicate/adjacent OSM entries (Kreisbrandinspektion
// admin office, the separate Luftwaffenfeuerwehr on the airfield, a second substation, etc.)
// that would otherwise also match on the bare place name.
export const REAL_FEUERWACHEN = [
  {
    ort: 'Fürstenfeldbruck',
    require: 'Freiwillige Feuerwehr',
    exclude: ['Wache 2', 'Luftwaffe', 'Kreisbrandinspektion'],
    vehicles: counts({ ELW: 1, MTW: 1, TLF: 1, DLK: 2, HLF: 2, LF: 2, RW: 1 })
  },
  // The following 57 stations come straight from bos-fahrzeuge.info (see file header).
  { ort: 'Adelshofen', vehicles: counts({ MTW: 1 }) },
  { ort: 'Bergkirchen', vehicles: counts({ TSF: 1 }) },
  { ort: 'Buch', vehicles: counts({ MTW: 1, LF: 1 }) },
  { ort: 'Dachau', vehicles: counts({ ELW: 2, TLF: 1, DLK: 1, GW: 3, HLF: 1, LF: 1 }) },
  { ort: 'Denklingen', vehicles: counts({ GW: 1 }) },
  { ort: 'Dettenhofen', vehicles: counts({ LF: 1 }) },
  { ort: 'Dießen', vehicles: counts({ GW: 1 }) },
  { ort: 'Egenhofen', vehicles: counts({ HLF: 1 }) },
  { ort: 'Egling', vehicles: counts({ HLF: 1 }) },
  { ort: 'Eichenau', vehicles: counts({ HLF: 1 }) },
  { ort: 'Eichhofen', vehicles: counts({ TSF: 1 }) },
  { ort: 'Eisenhofen', vehicles: counts({ MTW: 1 }) },
  { ort: 'Eisolzried', vehicles: counts({ LF: 1 }) },
  { ort: 'Emmering', vehicles: counts({ LF: 1 }) },
  { ort: 'Eschenried', vehicles: counts({ MTW: 1 }) },
  { ort: 'Feldafing', vehicles: counts({ MTW: 1 }) },
  { ort: 'Feldgeding', vehicles: counts({ LF: 1, GW: 1 }) },
  { ort: 'Gauting', vehicles: counts({ ELW: 1, DLK: 1, HLF: 1, LF: 1, RW: 1 }) },
  { ort: 'Geiselbullach', vehicles: counts({ GW: 1 }) },
  { ort: 'Germering', vehicles: counts({ ELW: 1, TLF: 1, GW: 1, RW: 1 }) },
  { ort: 'Gilching', vehicles: counts({ HLF: 1, GW: 1 }) },
  { ort: 'Grafrath', vehicles: counts({ MTW: 1, HLF: 1, LF: 1 }) },
  { ort: 'Gröbenzell', vehicles: counts({ ELW: 1 }) },
  { ort: 'Günding', vehicles: counts({ HLF: 1, GW: 1 }) },
  { ort: 'Hagenheim', vehicles: counts({ LF: 1 }) },
  { ort: 'Haimhausen', vehicles: counts({ MTW: 1, LF: 1, GW: 1 }) },
  { ort: 'Hebertshausen', vehicles: counts({ MTW: 1 }) },
  { ort: 'Herrsching', vehicles: counts({ ELW: 1, DLK: 1, HLF: 2, GW: 1, RW: 1 }) },
  { ort: 'Hilgertshausen', vehicles: counts({ LF: 1 }) },
  { ort: 'Indersdorf', vehicles: counts({ TLF: 1, DLK: 1, HLF: 1 }) },
  { ort: 'Karlsfeld', vehicles: counts({ GW: 1, HLF: 1 }) },
  { ort: 'Kaufering', vehicles: counts({ MTW: 1, DLK: 1, GW: 2, LF: 1, HLF: 1 }) },
  { ort: 'Kempfenhausen', vehicles: counts({ MTW: 1 }) },
  { ort: 'Landsberg', vehicles: counts({ GW: 1, HLF: 1 }) },
  { ort: 'Landsberg-Land', vehicles: counts({ ELW: 1 }) },
  { ort: 'Lauterbach', vehicles: counts({ LF: 1 }) },
  { ort: 'Maisach', vehicles: counts({ MTW: 2 }) },
  { ort: 'Oberbachern', vehicles: counts({ LF: 1 }) },
  { ort: 'Oberschweinbach', vehicles: counts({ LF: 1 }) },
  { ort: 'Odelzhausen', vehicles: counts({ LF: 1 }) },
  { ort: 'Olching', vehicles: counts({ MTW: 1, TLF: 1, GW: 1 }) },
  { ort: 'Penzing', vehicles: counts({ GW: 1 }) },
  { ort: 'Petershausen', vehicles: counts({ MTW: 1, HLF: 1, GW: 1 }) },
  { ort: 'Petzenhausen', vehicles: counts({ TSF: 1 }) },
  { ort: 'Prittriching', vehicles: counts({ MTW: 1, HLF: 1 }) },
  { ort: 'Rumeltshausen', vehicles: counts({ MTW: 1 }) },
  { ort: 'Röhrmoos', vehicles: counts({ HLF: 1 }) },
  { ort: 'Scheuring', vehicles: counts({ TSF: 1 }) },
  { ort: 'Schwabhausen', vehicles: counts({ TLF: 1, MTW: 1 }) },
  { ort: 'Schönbrunn', vehicles: counts({ DLK: 1 }) },
  { ort: 'Schöngeising', vehicles: counts({ MTW: 1 }) },
  { ort: 'Sittenbach', vehicles: counts({ TSF: 2 }) },
  { ort: 'Starnberg', vehicles: counts({ ELW: 1, MTW: 1, DLK: 1, HLF: 2, RW: 1 }) },
  { ort: 'Unterschweinbach', vehicles: counts({ LF: 1 }) },
  { ort: 'Vierkirchen', vehicles: counts({ MTW: 1, LF: 1 }) },
  { ort: 'Weßling', vehicles: counts({ HLF: 1, GW: 1, MTW: 1 }) },
  { ort: 'Wiedenzhausen', vehicles: counts({ LF: 1 }) },
  // Not tagged in OSM either - see the matching REAL_RETTUNGSWACHEN comment above.
  { ort: 'Windach', vehicles: counts({ LF: 1 }) }
]

// Feuerwachen: additional Kreis-level Sonderfahrzeuge stationed alongside the normal roster.
export const FEUERWEHR_ADDITIONS = [
  { ort: 'Mammendorf', add: ['DLK'] },
  { ort: 'Puchheim', require: 'Freiwillige Feuerwehr', exclude: ['Bahnhof'], add: ['ELW'] }
]
