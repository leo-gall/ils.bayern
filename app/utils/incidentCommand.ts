import type { Incident } from '~/types/incident'
import type { UnitState } from '~/types/unit'
import type { VehicleType } from '~/types/station'

/** Who typically holds Einsatzleitung at a mixed FW/RD incident, most senior first. */
export const LEAD_PRIORITY: VehicleType[] = [
  'ELW', 'ELW2', 'ELW-RD', 'KdoW', 'KdoW-RD', 'HLF', 'RTW', 'NEF', 'LF', 'TLF', 'DLK', 'MZF', 'RW', 'KTW', 'NKTW',
  'MLF', 'TSF', 'TSF-W', 'TSF-L', 'GW', 'GW-L', 'GW-SAN', 'GW-Betreuung', 'GW-Verpflegung', 'CBRN-ErkW', 'Boot', 'FR', 'MTW'
]

/** The single unit that leads the incident and is the only one that radios in Lage
 * reports - real Sprechfunk discipline has one Einsatzleitung reporting, not every
 * vehicle individually. Ties go to whichever matching unit was dispatched first. */
export function getLeadUnit(incident: Incident, units: Record<string, UnitState>): UnitState | null {
  const assigned = incident.assignedUnitIds.map(id => units[id]).filter((u): u is UnitState => !!u)
  if (assigned.length === 0) return null
  return assigned.reduce((best, u) => {
    const bestIndex = LEAD_PRIORITY.indexOf(best.type)
    const unitIndex = LEAD_PRIORITY.indexOf(u.type)
    return unitIndex !== -1 && (bestIndex === -1 || unitIndex < bestIndex) ? u : best
  })
}

export function isLeadUnit(incident: Incident, unitId: string, units: Record<string, UnitState>): boolean {
  return getLeadUnit(incident, units)?.id === unitId
}

/** Whether this unit is surplus to what the incident actually calls for. Matched against
 * scenario.requiredVehicleTypes, but only against units that have actually reached the
 * scene (vor_ort/abschluss) - a unit merely dispatched/en route hasn't covered anything
 * yet, so it must never make an arriving unit consider itself "excess" before anyone is
 * really there. Only once every required slot is covered by units already on scene does
 * a further arrival count as surplus and can self-release. */
export function isUnitExcess(incident: Incident, unitId: string, units: Record<string, UnitState>): boolean {
  const arrivedOthers = incident.assignedUnitIds.filter((id) => {
    if (id === unitId) return false
    const u = units[id]
    return !!u && (u.status === 'vor_ort' || u.status === 'abschluss')
  })
  if (arrivedOthers.length === 0) return false

  const required = [...incident.scenario.requiredVehicleTypes]
  for (const id of arrivedOthers) {
    const slot = required.indexOf(units[id]!.type)
    if (slot !== -1) required.splice(slot, 1)
  }

  return required.length === 0
}
