import { defineStore } from 'pinia'
import * as turf from '@turf/turf'
import ilsData from '~/data/ils.json'
import stationData from '~/data/stations.json'
import type { IlsRegion } from '~/types/ils'
import type { Station } from '~/types/station'

const ilsRegions = ilsData as unknown as IlsRegion[]
const stations = stationData as unknown as Station[]

export const useCatalogStore = defineStore('catalog', () => {
  const ilsById = new Map(ilsRegions.map((ils) => [ils.id, ils]))
  const stationsByIls = new Map<string, Station[]>()
  for (const station of stations) {
    const list = stationsByIls.get(station.ilsId) ?? []
    list.push(station)
    stationsByIls.set(station.ilsId, list)
  }
  const stationById = new Map(stations.map((s) => [s.id, s]))

  function getIls(ilsId: string): IlsRegion | undefined {
    return ilsById.get(ilsId)
  }

  function getPlayableArea(ilsId: string) {
    const ils = getIls(ilsId)
    return ils?.playableArea ?? ils?.area
  }

  function getPlayableBbox(ilsId: string) {
    const ils = getIls(ilsId)
    return ils?.playableBbox ?? ils?.bbox
  }

  function getPlayableCenter(ilsId: string) {
    const ils = getIls(ilsId)
    return ils?.playableCenter ?? ils?.center
  }

  // Narrowed to the current playable scope when an ILS has one (see IlsRegion.playableArea) -
  // stations outside it stay in the real dataset but aren't dispatchable for now.
  function getStationsForIls(ilsId: string): Station[] {
    const all = stationsByIls.get(ilsId) ?? []
    const playableArea = getPlayableArea(ilsId)
    if (!playableArea) return all
    return all.filter((s) => turf.booleanPointInPolygon(turf.point([s.lon, s.lat]), playableArea))
  }

  function getStation(stationId: string): Station | undefined {
    return stationById.get(stationId)
  }

  return {
    ilsRegions,
    stations,
    getIls,
    getPlayableArea,
    getPlayableBbox,
    getPlayableCenter,
    getStationsForIls,
    getStation
  }
})
