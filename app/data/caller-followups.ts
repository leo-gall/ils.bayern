// Shared pool of generic dispatcher follow-up questions - deliberately reused verbatim
// across scenarios (not scenario-specific dynamic text) so the caller's initial statement
// doesn't just dump the entire situation in one breath. The player has to actually ask,
// like a real Notruf - each scenario template answers 1-3 of these (see scenario-templates.ts).
export const GENERIC_FOLLOWUP_QUESTIONS = [
  'Was ist genau passiert?',
  'Ist jemand verletzt oder in Gefahr?',
  'Wie viele Personen sind betroffen?',
  'Ist die Person ansprechbar?',
  'Sind Sie selbst in Sicherheit?'
] as const

export type FollowUpQuestion = typeof GENERIC_FOLLOWUP_QUESTIONS[number]
