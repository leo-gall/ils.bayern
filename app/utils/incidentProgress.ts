import { ALARM_DELAY_MS, ABSCHLUSS_DELAY_MS, ON_SCENE_DURATION_MS } from '~/composables/useDispatchEngine'
import { getLeadUnit } from '~/utils/incidentCommand'
import type { Incident } from '~/types/incident'
import type { UnitState } from '~/types/unit'

// Fallback used while a travel leg's real duration isn't known yet (before the unit has
// actually entered that phase and fetched a routed ETA) - once known, the exact figure
// from statusEndsAt/statusChangedAt is used instead, so the estimate self-corrects.
const TRAVEL_ESTIMATE_MS = 5 * 60_000

/** Rough 0-100 completion estimate for an incident, tracked via its Einsatzleitung unit's
 * progress through alarmiert → anfahrt → vor_ort → abschluss → rueckfahrt → frei. Phase
 * durations are the same constants the dispatch engine itself uses, so early phases are
 * exact; only not-yet-reached travel legs fall back to an estimate. */
export function getIncidentProgress(incident: Incident, units: Record<string, UnitState>): number {
  if (incident.status === 'abgeschlossen') return 100

  const lead = getLeadUnit(incident, units)
  if (!lead) return 0

  const phases: { status: UnitState['status'], duration: number }[] = [
    { status: 'alarmiert', duration: ALARM_DELAY_MS },
    { status: 'anfahrt', duration: lead.status === 'anfahrt' && lead.statusEndsAt ? lead.statusEndsAt - lead.statusChangedAt : TRAVEL_ESTIMATE_MS },
    { status: 'vor_ort', duration: ON_SCENE_DURATION_MS[incident.severity] },
    { status: 'abschluss', duration: ABSCHLUSS_DELAY_MS },
    { status: 'rueckfahrt', duration: lead.status === 'rueckfahrt' && lead.statusEndsAt ? lead.statusEndsAt - lead.statusChangedAt : TRAVEL_ESTIMATE_MS }
  ]
  const totalMs = phases.reduce((sum, p) => sum + p.duration, 0)

  if (lead.status === 'frei') return 100

  let elapsedMs = 0
  for (const phase of phases) {
    if (phase.status === lead.status) {
      elapsedMs += Math.min(phase.duration, Math.max(0, Date.now() - lead.statusChangedAt))
      break
    }
    elapsedMs += phase.duration
  }

  return Math.min(99, Math.round((elapsedMs / totalMs) * 100))
}
