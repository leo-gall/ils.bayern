import * as turf from '@turf/turf'
import type { UnitState, UnitStatus, RadioMessage, ProactiveReportKind } from '~/types/unit'
import type { Incident, IncidentSeverity } from '~/types/incident'
import type { CallSession, CallMessage } from '~/types/call'
import { scenarioTemplates } from '~/data/scenario-templates'
import type { LocationContext } from '~/utils/locationContext'
import { isLeadUnit, isUnitExcess } from '~/utils/incidentCommand'
import { BOS_STATUS } from '~/utils/bosStatus'
import { randomCallerName } from '~/data/caller-names'
import { randomCallerOpener } from '~/data/caller-openers'
import type { ScenarioTemplate } from '~/data/scenario-templates'

// Real Ausrückzeit (turnout/prep) is a few minutes; kept short here so a dispatched unit is
// visibly en route quickly instead of sitting at the station for a full minute of real time.
// Exported so app/utils/incidentProgress.ts can estimate completion % using the same figures.
export const ALARM_DELAY_MS = 15_000
export const ABSCHLUSS_DELAY_MS = 30_000
const MIN_TRAVEL_MS = 30_000
const MAX_OPEN_CALLS = 8

export const ON_SCENE_DURATION_MS: Record<IncidentSeverity, number> = {
  niedrig: 5 * 60_000,
  mittel: 10 * 60_000,
  hoch: 15 * 60_000,
  kritisch: 20 * 60_000
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Fully scripted (no LLM) call flow: a fixed greeting and a caller statement built from
// the scenario's own text (never generated) - see spawnRandomCall. The dispatcher wraps
// the call up themselves via Einsatz anlegen + Auflegen, not a scripted confirmation line.
const OPENING_QUESTION = 'Notruf Feuerwehr und Rettungsdienst - Wo befindet sich der Unfallort und was ist passiert?'

// Real callers don't recite the objective ground truth (scenario.summary) - they're
// stressed, focused on what scares them, and speak in lay terms. The opener's urgency and
// the statement's phrasing both scale with severity (see caller-openers.ts and each
// template's hand-authored callerStatement).
function buildCallerStatement(name: string, address: string | null, template: ScenarioTemplate): string {
  const opener = randomCallerOpener(template.severity)
  const location = address ? `Hier ist ${name}, ich bin in ${address}.` : `Hier ist ${name}, ich weiß leider nicht genau, wo ich bin.`
  return `${opener} ${location} ${template.callerStatement}`
}

/** In-flight guard so the clock's tick loop never double-triggers an async transition. */
const transitioning = new Set<string>()

export function useDispatchEngine() {
  const game = useGameStore()
  const catalog = useCatalogStore()
  const { getEta } = useRouting()

  function initializeUnitsForIls(ilsId: string): UnitState[] {
    const stations = catalog.getStationsForIls(ilsId)
    const units: UnitState[] = []
    for (const station of stations) {
      for (const vehicle of station.vehicles) {
        units.push({
          id: vehicle.id,
          stationId: station.id,
          ilsId,
          type: vehicle.type,
          callSign: vehicle.funkrufname,
          stationName: station.name,
          status: 'frei',
          missionId: null,
          contactedForMissionId: null,
          pendingReportKind: null,
          statusEndsAt: null,
          statusChangedAt: Date.now(),
          radioLog: [],
          routeGeometry: null
        })
      }
    }
    return units
  }

  function randomPointInIls(ilsId: string): [number, number] | null {
    const bbox = catalog.getPlayableBbox(ilsId)
    const area = catalog.getPlayableArea(ilsId)
    const center = catalog.getPlayableCenter(ilsId)
    if (!bbox || !area || !center) return null
    const [west, south, east, north] = bbox
    for (let attempt = 0; attempt < 50; attempt++) {
      const lon = west + Math.random() * (east - west)
      const lat = south + Math.random() * (north - south)
      const point = turf.point([lon, lat])
      if (turf.booleanPointInPolygon(point, area)) {
        return [lon, lat]
      }
    }
    // Fallback: jitter around the region's center rather than fail to spawn.
    const [lon, lat] = center
    return [lon + (Math.random() - 0.5) * 0.01, lat + (Math.random() - 0.5) * 0.01]
  }

  function jitterPoint(lat: number, lon: number, maxKm: number): [number, number] {
    const bearing = Math.random() * 360
    const distanceKm = Math.random() * maxKm
    const dest = turf.destination([lon, lat], distanceKm, bearing)
    return dest.geometry.coordinates as [number, number]
  }

  /** Somewhere within a village/town: jitters around a random real station's location,
   * which (per catalog data) always sits in an actual Ort, not open countryside. */
  function pointNearSettlement(ilsId: string): [number, number] | null {
    const stations = catalog.getStationsForIls(ilsId)
    if (stations.length === 0) return null
    const station = stations[Math.floor(Math.random() * stations.length)]!
    return jitterPoint(station.lat, station.lon, 0.4)
  }

  /** Somewhere along a real road connecting two villages/towns, sampled from the actual
   * routed road geometry (not just a straight line) between two random stations. */
  async function pointOnMajorRoad(ilsId: string): Promise<[number, number] | null> {
    const stations = catalog.getStationsForIls(ilsId)
    if (stations.length < 2) return null
    const a = stations[Math.floor(Math.random() * stations.length)]!
    let b = stations[Math.floor(Math.random() * stations.length)]!
    for (let attempt = 0; attempt < 5 && b.id === a.id; attempt++) {
      b = stations[Math.floor(Math.random() * stations.length)]!
    }
    if (a.id === b.id) return null

    try {
      const route = await getEta({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon })
      if (route.geometry.length < 2) return null
      const line = turf.lineString(route.geometry)
      const totalKm = turf.length(line, { units: 'kilometers' })
      if (totalKm < 2) return null
      // Keep away from both ends so the point reads as "on the road", not "in a village".
      const t = 0.15 + Math.random() * 0.7
      const pt = turf.along(line, totalKm * t, { units: 'kilometers' })
      return pt.geometry.coordinates as [number, number]
    } catch {
      return null
    }
  }

  /** Weighted, fully code-driven (no LLM) pick of where a new call happens: most emergencies
   * happen where people are (villages/towns), a good share on the roads connecting them,
   * and only rarely in genuinely empty countryside ("Pampa"). */
  async function generateSpawnPoint(ilsId: string): Promise<[number, number] | null> {
    const r = Math.random()
    if (r < 0.65) {
      return pointNearSettlement(ilsId) ?? randomPointInIls(ilsId)
    }
    if (r < 0.9) {
      return (await pointOnMajorRoad(ilsId)) ?? pointNearSettlement(ilsId) ?? randomPointInIls(ilsId)
    }
    return randomPointInIls(ilsId)
  }

  async function lookupPoint(lat: number, lon: number): Promise<{ address: string | null, context: LocationContext }> {
    try {
      return await $fetch<{ address: string | null, context: LocationContext }>('/api/location-context', {
        query: { lat, lon }
      })
    } catch {
      return { address: null, context: 'strasse' }
    }
  }

  /** Dispatcher-triggered: generates a new incoming call with a hidden scenario. No Einsatz
   * exists yet - the dispatcher has to create one themselves from what they learn on the call.
   * The scenario is picked to match the terrain at the sampled point (no Kellerbrand in the
   * middle of a forest), determined via reverse geocoding. Fully scripted, fixed-scheme call:
   * a fixed greeting followed by one caller statement carrying every critical fact (name, Ort,
   * Lage, Verletzungen/Gefahren) in a single message - no LLM, no back-and-forth. */
  async function spawnRandomCall(ilsId: string): Promise<CallSession | null> {
    const openCalls = Object.values(game.calls).filter(c => c.ilsId === ilsId && c.status !== 'beendet').length
    if (openCalls >= MAX_OPEN_CALLS) return null

    const point = await generateSpawnPoint(ilsId)
    if (!point) return null
    const [lon, lat] = point

    const { address, context } = await lookupPoint(lat, lon)
    const eligible = scenarioTemplates.filter(t => t.locationContexts.includes(context))
    const pool = eligible.length ? eligible : scenarioTemplates
    const template = pool[Math.floor(Math.random() * pool.length)]!
    const callerName = randomCallerName()

    const now = Date.now()
    const call: CallSession = {
      id: uid('call'),
      ilsId,
      incidentId: null,
      status: 'klingelt',
      messages: [
        { id: uid('msg'), role: 'disponent', text: OPENING_QUESTION, timestamp: now },
        { id: uid('msg'), role: 'anrufer', text: buildCallerStatement(callerName, address, template), timestamp: now + 1 }
      ],
      createdAt: now,
      scenario: {
        summary: template.summary,
        keyword: template.keyword,
        severity: template.severity,
        requiredVehicleTypes: template.requiredVehicleTypes
      },
      lat,
      lon,
      address,
      callerName,
      followUps: { ...template.followUps }
    }

    game.upsertCall(call)
    return call
  }

  /** Dispatcher asks one of the call's remaining generic follow-up questions (see
   * CallDialog) - both the question and its fixed answer are scripted, no LLM. */
  function askFollowUp(callId: string, question: string) {
    const call = game.calls[callId]
    const answer = call?.followUps[question]
    if (!call || call.status === 'beendet' || !answer) return
    addCallMessage(callId, 'disponent', question)
    addCallMessage(callId, 'anrufer', answer)
  }

  /** Dispatcher manually logs an Einsatz from an active call, using their own assessment. */
  function createIncidentFromCall(callId: string, details: { keyword: string, severity: IncidentSeverity }): Incident | null {
    const call = game.calls[callId]
    if (!call || call.incidentId) return null

    const incident: Incident = {
      id: uid('inc'),
      ilsId: call.ilsId,
      lat: call.lat,
      lon: call.lon,
      address: call.address,
      status: 'neu',
      keyword: details.keyword,
      severity: details.severity,
      scenario: call.scenario,
      createdAt: Date.now(),
      assignedUnitIds: [],
      callId: call.id,
      backupRequested: false
    }

    call.incidentId = incident.id
    game.upsertIncident(incident)
    return incident
  }

  function dispatchUnit(unitId: string, incidentId: string) {
    const unit = game.units[unitId]
    const incident = game.incidents[incidentId]
    if (!unit || !incident) return
    if (unit.status !== 'frei') return

    unit.missionId = incidentId
    unit.contactedForMissionId = null
    setStatus(unit, 'alarmiert', ALARM_DELAY_MS)

    if (!incident.assignedUnitIds.includes(unitId)) {
      incident.assignedUnitIds.push(unitId)
    }
    if (incident.status === 'neu') {
      incident.status = 'in_bearbeitung'
    }
    // A fresh dispatch is assumed to address any outstanding request for more units.
    incident.backupRequested = false
  }

  function setBackupRequested(incidentId: string, value: boolean) {
    const incident = game.incidents[incidentId]
    if (!incident) return
    incident.backupRequested = value
  }

  function setStatus(unit: UnitState, status: UnitStatus, endsInMs: number | null) {
    unit.status = status
    unit.statusChangedAt = Date.now()
    unit.statusEndsAt = endsInMs == null ? null : Date.now() + endsInMs
    // Every status change is a silent FMS button press in reality, not a voice call - but
    // the dispatcher still needs to see it happen, so it's logged as a status pill rather
    // than spoken dialogue in the shared TMO feed.
    addRadioMessage(unit.id, 'status', BOS_STATUS[status].label, status)
  }

  function maybeCloseIncident(incidentId: string) {
    const incident = game.incidents[incidentId]
    if (!incident) return
    const units = incident.assignedUnitIds.map(id => game.units[id]).filter(Boolean) as UnitState[]
    if (units.length === 0) return
    const allDone = units.every(u => u.status === 'rueckfahrt' || u.status === 'frei')
    if (allDone) {
      incident.status = 'abgeschlossen'
    }
  }

  /** Posts the unit's Sprechwunsch ("kommen") - real crews call in on their own, without
   * the dispatcher hailing them first, but the actual content only follows once the
   * dispatcher explicitly accepts (see useLlmRadio's acceptProactiveReport). */
  function triggerProactiveReport(unitId: string, kind: ProactiveReportKind) {
    const { requestProactiveReport } = useLlmRadio()
    requestProactiveReport(unitId, kind)
  }

  /** Checked every clock tick for units currently vor_ort: real Sprechfunk-Disziplin has the
   * Einsatzleitung call in a Lageänderung partway through, not on a fixed status transition -
   * fires once per mission, roughly at the midpoint of the expected on-scene time. */
  const midpointReported = new Set<string>()
  function checkMidMissionReport(unitId: string) {
    const unit = game.units[unitId]
    if (!unit || unit.status !== 'vor_ort' || unit.statusEndsAt == null || !unit.missionId) return

    const key = `${unitId}:${unit.missionId}`
    if (midpointReported.has(key)) return

    const midpoint = unit.statusChangedAt + (unit.statusEndsAt - unit.statusChangedAt) * 0.5
    if (Date.now() < midpoint) return

    const incident = game.incidents[unit.missionId]
    if (!incident || !isLeadUnit(incident, unitId, game.units)) return
    midpointReported.add(key)

    // RD-only incidents that turn out worse than the dispatched crew can handle
    // occasionally call for a Notarzt instead of the generic Lageänderung.
    const assignedTypes = incident.assignedUnitIds.map(id => game.units[id]?.type)
    const needsNotarzt = incident.severity !== 'niedrig'
      && assignedTypes.includes('RTW')
      && !assignedTypes.includes('NEF')
      && !incident.backupRequested
      && Math.random() < 0.4

    if (needsNotarzt) {
      incident.backupRequested = true
      triggerProactiveReport(unitId, 'notarzt_nachforderung')
    } else {
      triggerProactiveReport(unitId, 'lageaenderung')
    }
  }

  /** Checked every clock tick, alongside checkMidMissionReport: only the longest-running
   * (kritisch) operations run long enough for a real crew to call in for Verpflegung or a
   * Tausch (relief crew) - fires once per mission, late in the expected on-scene time. */
  const lateReported = new Set<string>()
  const LATE_MISSION_FRACTION = 0.85
  function checkLateMissionReport(unitId: string) {
    const unit = game.units[unitId]
    if (!unit || unit.status !== 'vor_ort' || unit.statusEndsAt == null || !unit.missionId) return

    const key = `${unitId}:${unit.missionId}`
    if (lateReported.has(key)) return

    const incident = game.incidents[unit.missionId]
    if (!incident || incident.severity !== 'kritisch' || !isLeadUnit(incident, unitId, game.units)) return

    const threshold = unit.statusChangedAt + (unit.statusEndsAt - unit.statusChangedAt) * LATE_MISSION_FRACTION
    if (Date.now() < threshold) return

    lateReported.add(key)
    triggerProactiveReport(unitId, 'verpflegung_tausch')
  }

  async function advanceUnitIfDue(unitId: string) {
    const unit = game.units[unitId]
    if (!unit || unit.statusEndsAt == null) return
    if (Date.now() < unit.statusEndsAt) return
    if (transitioning.has(unitId)) return

    const station = catalog.getStation(unit.stationId)
    const incident = unit.missionId ? game.incidents[unit.missionId] : null

    try {
      transitioning.add(unitId)

      switch (unit.status) {
        case 'alarmiert': {
          if (!station || !incident) {
            setStatus(unit, 'frei', null)
            unit.missionId = null
            unit.contactedForMissionId = null
            unit.routeGeometry = null
            break
          }
          const eta = await getEta({ lat: station.lat, lon: station.lon }, { lat: incident.lat, lon: incident.lon })
          unit.routeGeometry = eta.geometry
          setStatus(unit, 'anfahrt', Math.max(eta.durationSeconds * 1000, MIN_TRAVEL_MS))
          if (incident.status === 'in_bearbeitung') incident.status = 'einheiten_unterwegs'
          // Departure itself is a silent FMS status change in reality, not a voice call.
          break
        }
        case 'anfahrt': {
          // Too many units already assigned for what this incident actually calls for:
          // the surplus unit realizes it on arrival and self-releases instead of tying up.
          if (incident && station && isUnitExcess(incident, unitId, game.units)) {
            unit.routeGeometry = null
            const eta = await getEta({ lat: incident.lat, lon: incident.lon }, { lat: station.lat, lon: station.lon })
            unit.routeGeometry = eta.geometry
            setStatus(unit, 'rueckfahrt', Math.max(eta.durationSeconds * 1000, MIN_TRAVEL_MS))
            if (unit.missionId) maybeCloseIncident(unit.missionId)
            triggerProactiveReport(unitId, 'stand_down')
            break
          }

          const duration = incident ? ON_SCENE_DURATION_MS[incident.severity] : ON_SCENE_DURATION_MS.mittel
          unit.routeGeometry = null
          setStatus(unit, 'vor_ort', duration)
          if (incident && incident.status !== 'vor_ort') incident.status = 'vor_ort'
          // Lage auf Sicht is only given once, by whichever unit physically arrives first -
          // that's not necessarily the Einsatzleitung (LEAD_PRIORITY), which may still be
          // en route. Later reports (Lageänderung) do come from the lead unit instead, see
          // checkMidMissionReport.
          if (incident) {
            const someoneAlreadyArrived = incident.assignedUnitIds.some((id) => {
              if (id === unitId) return false
              const other = game.units[id]
              return !!other && (['vor_ort', 'abschluss', 'rueckfahrt'] as UnitStatus[]).includes(other.status)
            })
            if (!someoneAlreadyArrived) {
              triggerProactiveReport(unitId, 'lage_auf_sicht')
            }
          }
          break
        }
        case 'vor_ort': {
          setStatus(unit, 'abschluss', ABSCHLUSS_DELAY_MS)
          break
        }
        case 'abschluss': {
          if (!station || !incident) {
            setStatus(unit, 'frei', null)
            unit.missionId = null
            unit.contactedForMissionId = null
            unit.routeGeometry = null
            break
          }
          const eta = await getEta({ lat: incident.lat, lon: incident.lon }, { lat: station.lat, lon: station.lon })
          unit.routeGeometry = eta.geometry
          setStatus(unit, 'rueckfahrt', Math.max(eta.durationSeconds * 1000, MIN_TRAVEL_MS))
          if (unit.missionId) maybeCloseIncident(unit.missionId)
          // Going Status 1 (einsatzbereit über Funk) is a silent FMS status change, not a voice call.
          break
        }
        case 'rueckfahrt': {
          const missionId = unit.missionId
          unit.routeGeometry = null
          setStatus(unit, 'frei', null)
          unit.missionId = null
          unit.contactedForMissionId = null
          if (missionId) maybeCloseIncident(missionId)
          break
        }
      }
    } finally {
      transitioning.delete(unitId)
    }
  }

  function addCallMessage(callId: string, role: CallMessage['role'], text: string) {
    const message: CallMessage = { id: uid('msg'), role, text, timestamp: Date.now() }
    game.appendCallMessage(callId, message)
    return message
  }

  function addRadioMessage(unitId: string, role: RadioMessage['role'], text: string, status?: UnitStatus) {
    const message: RadioMessage = { id: uid('radio'), role, text, status, timestamp: Date.now() }
    game.appendRadioMessage(unitId, message)
    return message
  }

  return {
    initializeUnitsForIls,
    spawnRandomCall,
    askFollowUp,
    createIncidentFromCall,
    dispatchUnit,
    advanceUnitIfDue,
    checkMidMissionReport,
    checkLateMissionReport,
    setBackupRequested,
    addCallMessage,
    addRadioMessage
  }
}
