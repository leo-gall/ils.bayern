import type { VehicleType } from './station'

export type UnitStatus
  = | 'frei'
    | 'alarmiert'
    | 'anfahrt'
    | 'vor_ort'
    | 'abschluss'
    | 'rueckfahrt'

/** Reasons a unit voice-initiates contact with the Leitstelle - see useDispatchEngine's
 * triggerProactiveReport and useLlmRadio's requestProactiveReport/acceptProactiveReport. */
export type ProactiveReportKind = 'lage_auf_sicht' | 'lageaenderung' | 'stand_down' | 'notarzt_nachforderung' | 'verpflegung_tausch'

export interface RadioMessage {
  id: string
  /** 'status': a silent FMS status button press, surfaced as a pill in the feed rather
   * than spoken dialogue - see useDispatchEngine's setStatus(). */
  role: 'leitstelle' | 'einheit' | 'status'
  text: string
  /** Set only for role 'status' - the status the unit just switched to. */
  status?: UnitStatus
  timestamp: number
}

export interface UnitState {
  id: string
  stationId: string
  ilsId: string
  type: VehicleType
  /** Real BOS Funkrufname, e.g. "Florian Fürstenfeldbruck 40/1". */
  callSign: string
  stationName: string
  status: UnitStatus
  missionId: string | null
  /** Set once the dispatcher has accepted this unit's current Sprechwunsch for missionId -
   * the Leitstelle never opens a channel itself and must explicitly accept before it may
   * reply (see pendingReportKind below). Cleared whenever missionId is cleared, so a fresh
   * dispatch requires the unit to call in again before the dispatcher can respond. */
  contactedForMissionId: string | null
  /** Set while a unit has voice-called in ("kommen") but the dispatcher hasn't accepted the
   * Sprechwunsch yet - the actual report content is only requested/revealed on acceptance. */
  pendingReportKind: ProactiveReportKind | null
  /** absolute timestamp (ms) the current status phase ends, if it is time-driven */
  statusEndsAt: number | null
  statusChangedAt: number
  radioLog: RadioMessage[]
  /** [lon, lat] pairs tracing the current anfahrt/rueckfahrt leg, for the map to animate
   * the unit's live position along - null when not actively driving a route. */
  routeGeometry: [number, number][] | null
}
