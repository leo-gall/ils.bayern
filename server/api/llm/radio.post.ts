import { getAnthropicClient } from '../../utils/anthropic'
import { checkRateLimit } from '../../utils/rate-limit'

type ReportKind = 'lage_auf_sicht' | 'lageaenderung' | 'stand_down' | 'notarzt_nachforderung' | 'verpflegung_tausch'

interface RadioRequestBody {
  scenario: { summary: string, keyword: string, severity: string }
  unit: { callSign: string, type: string, status: string }
  history: { role: 'leitstelle' | 'einheit', text: string }[]
  /** Set for a dispatcher-initiated reply. Omitted together with dispatcherMessage for a
   * proactive, unit-initiated call - real crews only voice-report on a Lageänderung or the
   * initial Lage auf Sicht, everything else (Status 1-8) is a silent FMS button press. */
  dispatcherMessage?: string
  reportKind?: ReportKind
}

const LAGE_AUF_SICHT_PROMPT = 'Ihr seid gerade als erste Einheit am Einsatzort eingetroffen. Melde dich jetzt SELBSTSTÄNDIG per Funk bei der Leitstelle mit der ersten Lagemeldung ("Lage auf Sicht") - kurz und sachlich (1-2 Sätze), was ihr beim Eintreffen seht. Falls sich die Lage schlimmer darstellt als beim Alarmierungsstichwort angenommen (z.B. mehr Rauch, mehr Verletzte, Personen in Gefahr), fordere in derselben Meldung gezielt zusätzliche Kräfte nach (z.B. "Atemschutz-Nachforderung"). In den meisten Fällen entspricht die Lage aber dem Alarmierungsstichwort - dann ist KEINE Nachforderung nötig.'

const STAND_DOWN_PROMPT = 'Eure Einheit ist gerade am Einsatzort eingetroffen und stellt fest, dass bereits ausreichend andere Kräfte vor Ort bzw. unterwegs sind - ihr werdet hier nicht gebraucht. Melde dich SELBSTSTÄNDIG per Funk bei der Leitstelle: kurz mitteilen, dass ihr Status 1 (einsatzbereit über Funk) gebt und zur Wache zurückfahrt, weil ausreichend Kräfte da sind. Ein Satz.'

const LAGEAENDERUNG_PROMPT = 'Ihr seid als Einsatzleitung weiter am Einsatzort tätig. Melde dich jetzt SELBSTSTÄNDIG per Funk bei der Leitstelle mit einer kurzen Lageänderungsmeldung (neuer Stand, Fortschritt, ggf. Besonderheiten). Nur wenn die tatsächliche Lage es wirklich hergibt, fordere zusätzliche Kräfte nach - in den meisten Fällen ist die Lage unter der bereits alarmierten Besetzung unter Kontrolle und es gibt KEINE Nachforderung.'

const NOTARZT_NACHFORDERUNG_PROMPT = 'Eure Besatzung ist am Einsatzort und stellt fest, dass der Zustand des Patienten einen Notarzt erfordert, der bisher nicht alarmiert wurde. Melde dich SELBSTSTÄNDIG per Funk bei der Leitstelle und fordere gezielt einen Notarzt (NEF) nach - kurz, sachlich, mit knapper Begründung (1-2 Sätze).'

const VERPFLEGUNG_TAUSCH_PROMPT = 'Eure Einheit ist schon seit längerer Zeit im Einsatz. Melde dich SELBSTSTÄNDIG per Funk bei der Leitstelle und fordere entweder Verpflegung für die Einsatzkräfte vor Ort oder eine Ablösung/einen Kräftetausch an - kurz und sachlich (1-2 Sätze).'

const STATUS_HINTS: Record<string, string> = {
  alarmiert: 'Die Einheit wurde soeben alarmiert und macht sich gerade abfahrbereit.',
  anfahrt: 'Die Einheit ist auf der Anfahrt zum Einsatzort, Funkkontakt läuft während der Fahrt.',
  vor_ort: 'Die Einheit ist am Einsatzort eingetroffen und kann die Lage vor Ort schildern.',
  abschluss: 'Die Einheit schließt den Einsatz vor Ort ab (Nachsorge, Übergabe, Geräte verladen).',
  rueckfahrt: 'Die Einheit ist auf der Rückfahrt zur Wache.'
}

const LAGE_UPDATE_TOOL = 'lage_update'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  checkRateLimit(`radio:${ip}`, { max: 40, windowMs: 60_000 })

  const body = await readBody<RadioRequestBody>(event)
  if (!body?.scenario || !body?.unit) {
    throw createError({ statusCode: 400, statusMessage: 'scenario and unit are required' })
  }

  const client = getAnthropicClient()

  const systemPrompt = `Du spielst per Funk die Besatzung des Einsatzfahrzeugs "${body.unit.callSign}" (${body.unit.type}) im Kontakt mit der Leitstelle. Antworte ausschließlich auf Deutsch, knapp und realistisch wie im Sprechfunk zwischen Einsatzkräften und Leitstelle - keine Meta-Kommentare, keine KI-Hinweise, niemals aus der Rolle fallen.

Aktueller Status: ${body.unit.status} - ${STATUS_HINTS[body.unit.status] ?? ''}

Tatsächliche Einsatzlage (nur preisgeben, soweit die Besatzung sie in ihrem aktuellen Status kennen kann, z.B. Details vor Ort erst nach Eintreffen): ${body.scenario.summary}
Einsatzstichwort: ${body.scenario.keyword}

Antworte kurz (1-3 Sätze), sachlich, mit realistischem Funkjargon, aber verständlich.`

  let proactivePrompt: string | null = null
  if (!body.dispatcherMessage) {
    if (body.reportKind === 'stand_down') proactivePrompt = STAND_DOWN_PROMPT
    else if (body.reportKind === 'lageaenderung') proactivePrompt = LAGEAENDERUNG_PROMPT
    else if (body.reportKind === 'notarzt_nachforderung') proactivePrompt = NOTARZT_NACHFORDERUNG_PROMPT
    else if (body.reportKind === 'verpflegung_tausch') proactivePrompt = VERPFLEGUNG_TAUSCH_PROMPT
    else proactivePrompt = LAGE_AUF_SICHT_PROMPT
  }

  const messages = [
    ...body.history.map(m => ({
      role: (m.role === 'leitstelle' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text
    })),
    { role: 'user' as const, content: body.dispatcherMessage ?? proactivePrompt! }
  ]

  // The initial Lage auf Sicht and the mid-mission Lageänderung both need a structured
  // "requests backup" signal (see the example "LF vor Ort: ... Atemschutz-Nachforderung")
  // - every other proactive report is plain conversational text.
  if (body.reportKind === 'lageaenderung' || body.reportKind === 'lage_auf_sicht') {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: systemPrompt,
      messages,
      tools: [{
        name: LAGE_UPDATE_TOOL,
        description: 'Lagemeldung der Einheit an die Leitstelle (Lage auf Sicht oder Lageänderung).',
        input_schema: {
          type: 'object',
          properties: {
            report: { type: 'string', description: 'Kurze Funkmeldung, 1-2 Sätze.' },
            requestsBackup: { type: 'boolean', description: 'true nur, wenn hier explizit weitere Fahrzeuge/Kräfte nachgefordert werden.' }
          },
          required: ['report', 'requestsBackup']
        }
      }],
      tool_choice: { type: 'tool', name: LAGE_UPDATE_TOOL }
    })

    const toolUse = response.content.find(block => block.type === 'tool_use' && block.name === LAGE_UPDATE_TOOL)
    const input = toolUse && toolUse.type === 'tool_use' ? toolUse.input as { report: string, requestsBackup?: boolean } : null
    if (!input) {
      throw createError({ statusCode: 502, statusMessage: 'LLM did not return a structured Lageänderung' })
    }

    return { unitReply: input.report.trim(), requestsBackup: !!input.requestsBackup }
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: systemPrompt,
    messages
  })

  let unitReply = ''
  for (const block of response.content) {
    if (block.type === 'text') unitReply += block.text
  }

  return { unitReply: unitReply.trim() }
})
