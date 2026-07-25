import { defineStore } from 'pinia'
import type { UnitState } from '~/types/unit'
import type { Incident } from '~/types/incident'
import type { CallSession, CallMessage } from '~/types/call'

interface RouteCacheEntry {
  durationSeconds: number
  distanceMeters: number
  source: 'ors' | 'osrm' | 'fallback'
  geometry: [number, number][]
  cachedAt: number
}

// Bump whenever the persisted shape of units/incidents/calls changes, or whenever the
// underlying catalog scope changes (e.g. narrowing to a playable sub-area), so stale
// saves from before the change get discarded instead of showing a stale unit roster.
const DATA_VERSION = 16

interface GameStateShape {
  dataVersion: number
  selectedIlsId: string | null
  gameStartedAt: number | null
  units: Record<string, UnitState>
  incidents: Record<string, Incident>
  calls: Record<string, CallSession>
  activeCallId: string | null
  routeCache: Record<string, RouteCacheEntry>
}

export const useGameStore = defineStore('game', {
  state: (): GameStateShape => ({
    dataVersion: DATA_VERSION,
    selectedIlsId: null,
    gameStartedAt: null,
    units: {},
    incidents: {},
    calls: {},
    activeCallId: null,
    routeCache: {}
  }),

  getters: {
    needsReset: state => state.dataVersion !== DATA_VERSION,
    unitList: state => Object.values(state.units),
    incidentList: state => Object.values(state.incidents),
    openIncidents: state => Object.values(state.incidents).filter(i => i.status !== 'abgeschlossen'),
    openCalls: state => Object.values(state.calls).filter(c => c.status !== 'beendet'),
    ringingCalls: state => Object.values(state.calls).filter(c => c.status === 'klingelt'),
    activeCall: state => (state.activeCallId ? state.calls[state.activeCallId] : null)
  },

  actions: {
    resetForIls(ilsId: string, units: UnitState[]) {
      this.dataVersion = DATA_VERSION
      this.selectedIlsId = ilsId
      this.gameStartedAt = Date.now()
      this.units = Object.fromEntries(units.map(u => [u.id, u]))
      this.incidents = {}
      this.calls = {}
      this.activeCallId = null
    },

    upsertIncident(incident: Incident) {
      this.incidents[incident.id] = incident
    },

    upsertCall(call: CallSession) {
      this.calls[call.id] = call
    },

    appendCallMessage(callId: string, message: CallMessage) {
      const call = this.calls[callId]
      if (!call) return
      call.messages.push(message)
    },

    appendRadioMessage(unitId: string, message: UnitState['radioLog'][number]) {
      const unit = this.units[unitId]
      if (!unit) return
      unit.radioLog.push(message)
    },

    cacheRoute(key: string, entry: RouteCacheEntry) {
      this.routeCache[key] = entry
    }
  },

  persist: true
})
