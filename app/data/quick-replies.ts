// Pre-written dispatcher phrases so the player can click instead of typing.
// The LLM-driven unit still replies dynamically to whichever phrase is sent.
// (The Notruf/call flow itself is fully scripted, no LLM - see useDispatchEngine's
// spawnRandomCall/askFollowUp.)

export const radioQuickReplies: string[] = [
  'Status?',
  'Wie ist die Lage vor Ort?',
  'Verstanden, weiter wie besprochen.',
  'Benötigt ihr Unterstützung/weitere Kräfte?',
  'Bitte meldet euch bei Ankunft am Einsatzort.',
  'Bitte Rückmeldung, sobald der Einsatz abgeschlossen ist.',
  'Rückfahrt zur Wache, wenn ihr fertig seid.',
  'Verstanden, kommen.'
]
