import type { IncidentScenario } from './incident'

export interface CallMessage {
  id: string
  role: 'anrufer' | 'disponent'
  text: string
  timestamp: number
}

export type CallStatus = 'klingelt' | 'aktiv' | 'beendet'

export interface CallSession {
  id: string
  ilsId: string
  incidentId: string | null
  status: CallStatus
  messages: CallMessage[]
  createdAt: number
  /** Hidden ground truth behind the call - not shown directly in the UI, only via the
   * caller's fixed opening statement/followUps (scenario.summary) and later as LLM radio context. */
  scenario: IncidentScenario
  lat: number
  lon: number
  address: string | null
  /** Name given by the caller in their opening statement. */
  callerName: string
  /** Generic follow-up questions the dispatcher can still ask, mapped to this call's fixed
   * answer - see app/data/caller-followups.ts. Removed from CallDialog's list once asked. */
  followUps: Record<string, string>
}
