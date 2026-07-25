export interface IlsRegion {
  id: string
  name: string
  city: string
  website: string
  districtsMatched: number
  districtsTotal: number
  /** [lon, lat] */
  center: [number, number]
  /** [west, south, east, north] */
  bbox: [number, number, number, number]
  area: GeoJSON.Polygon | GeoJSON.MultiPolygon
  /**
   * Temporary gameplay scope, narrower than the real jurisdiction above - e.g. ILS
   * Fürstenfeldbruck really covers 4 Landkreise, but only Landkreis Landsberg am Lech
   * is playable for now while the Leitstelle itself stays "ILS Fürstenfeldbruck".
   * Falls back to area/bbox/center when absent. Drives map bounds, incident/call spawn
   * sampling, and which stations are dispatchable - remove once the full area reopens.
   */
  playableArea?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  playableBbox?: [number, number, number, number]
  playableCenter?: [number, number]
}
