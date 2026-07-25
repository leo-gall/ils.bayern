import type { VehicleType } from './station'

export type IncidentSeverity = 'niedrig' | 'mittel' | 'hoch' | 'kritisch'
export type IncidentStatus = 'neu' | 'in_bearbeitung' | 'einheiten_unterwegs' | 'vor_ort' | 'abgeschlossen'

/**
 * The "ground truth" of what is actually happening at an incident. Lives in the
 * client store (there is no persistent server session to hold it) but the UI only
 * ever surfaces it progressively, through the call/radio dialogs — never rendered
 * directly as a spoiler.
 */
export interface IncidentScenario {
  summary: string
  keyword: string
  severity: IncidentSeverity
  requiredVehicleTypes: VehicleType[]
}

export interface Incident {
  id: string
  ilsId: string
  lat: number
  lon: number
  address: string | null
  status: IncidentStatus
  /** Dispatcher-entered keyword/severity - may or may not match the hidden scenario. */
  keyword: string
  severity: IncidentSeverity
  /** Hidden ground truth copied from the originating call, kept only for LLM radio context. */
  scenario: IncidentScenario
  createdAt: number
  /** Feuerwehr and Rettungsdienst units are dispatched to the same incident side by side - no domain split. */
  assignedUnitIds: string[]
  callId: string | null
  /** Set when the Einsatzleitung has radioed in a request for additional vehicles - cleared on the next dispatch. */
  backupRequested: boolean
}
