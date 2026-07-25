import type { ProactiveReportKind, RadioMessage } from '~/types/unit'

interface RadioApiResponse {
  unitReply: string
  requestsBackup?: boolean
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Only actual dialogue belongs in the LLM's conversation history - status pills are a UI
 * concern (see useDispatchEngine's setStatus) and would otherwise be fed back in as if the
 * unit or Leitstelle had said "Einsatz übernommen" etc. as a line of radio dialogue. */
function dialogueHistory(radioLog: RadioMessage[]) {
  return radioLog
    .filter((m): m is RadioMessage & { role: 'leitstelle' | 'einheit' } => m.role === 'leitstelle' || m.role === 'einheit')
    .map(m => ({ role: m.role, text: m.text }))
}

export function useLlmRadio() {
  const game = useGameStore()
  const engine = useDispatchEngine()

  const pending = ref(false)
  const error = ref<string | null>(null)

  async function sendDispatcherMessage(unitId: string, text: string) {
    const unit = game.units[unitId]
    if (!unit) return
    const incident = unit.missionId ? game.incidents[unit.missionId] : null
    if (!incident) return

    const history = dialogueHistory(unit.radioLog)
    engine.addRadioMessage(unitId, 'leitstelle', text)

    pending.value = true
    error.value = null
    try {
      const response = await $fetch<RadioApiResponse>('/api/llm/radio', {
        method: 'POST',
        body: {
          scenario: incident.scenario,
          unit: { callSign: unit.callSign, type: unit.type, status: unit.status },
          history,
          dispatcherMessage: text
        }
      })
      engine.addRadioMessage(unitId, 'einheit', response.unitReply)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Funkspruch fehlgeschlagen'
      engine.addRadioMessage(unitId, 'einheit', '[Funkstörung - keine Antwort]')
    } finally {
      pending.value = false
    }
  }

  /** Unit-initiated Sprechwunsch: real crews send "kommen" first and wait - the Leitstelle
   * must explicitly accept (see acceptProactiveReport) before the actual report content is
   * requested/revealed, it never gets pulled in automatically on a timer. Guards against a
   * unit stacking a second Sprechwunsch while one is still outstanding. */
  function requestProactiveReport(unitId: string, kind: ProactiveReportKind) {
    const unit = game.units[unitId]
    if (!unit || unit.pendingReportKind || !unit.missionId) return
    unit.pendingReportKind = kind
    engine.addRadioMessage(unitId, 'einheit', `${unit.callSign} an Leitstelle, kommen.`)
  }

  /** Dispatcher-triggered acceptance of an outstanding Sprechwunsch (see RadioPanel's
   * "Annehmen" action) - only now does the Leitstelle acknowledge and the unit's actual
   * report get fetched. Deliberately doesn't touch `pending`/`error` - those drive the
   * "Einheit antwortet…" indicator for messages the dispatcher is actively waiting on. */
  async function acceptProactiveReport(unitId: string) {
    const unit = game.units[unitId]
    if (!unit || !unit.pendingReportKind) return
    const kind = unit.pendingReportKind
    unit.pendingReportKind = null

    const incident = unit.missionId ? game.incidents[unit.missionId] : null
    if (!incident) return

    // The dispatcher just opened the channel by accepting - they may now reply to this
    // unit for the rest of the mission (see RadioPanel's isContacted).
    unit.contactedForMissionId = unit.missionId

    await wait(400 + Math.random() * 400)
    engine.addRadioMessage(unitId, 'leitstelle', `${unit.callSign}, kommen.`)

    const history = dialogueHistory(unit.radioLog)

    try {
      const response = await $fetch<RadioApiResponse>('/api/llm/radio', {
        method: 'POST',
        body: {
          scenario: incident.scenario,
          unit: { callSign: unit.callSign, type: unit.type, status: unit.status },
          history,
          reportKind: kind
        }
      })
      engine.addRadioMessage(unitId, 'einheit', response.unitReply)
      if (response.requestsBackup) {
        engine.setBackupRequested(incident.id, true)
      }
    } catch {
      // A missed proactive callout is just silence on the radio - not worth surfacing an error for.
    }
  }

  return { sendDispatcherMessage, requestProactiveReport, acceptProactiveReport, pending, error }
}
