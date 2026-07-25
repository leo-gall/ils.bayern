// Only these ILS regions are currently playable - vehicle/station rosters have only been
// manually verified against real sources for Fürstenfeldbruck (and its Landkreise Dachau,
// Starnberg, Landsberg am Lech). The other 25 regions still use fully synthetic rosters and
// are hidden from selection until they get the same treatment.
export const ACTIVE_ILS_IDS: readonly string[] = ['fuerstenfeldbruck']

export function isIlsActive(ilsId: string): boolean {
  return ACTIVE_ILS_IDS.includes(ilsId)
}
