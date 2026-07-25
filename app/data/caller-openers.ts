import type { IncidentSeverity } from '~/types/incident'

// Opening exclamation a caller leads with, picked randomly per call - real 112 callers in
// a genuine emergency blurt out urgency before introducing themselves; someone reporting a
// stuck cat does not. Keyed by severity so the panic level in useDispatchEngine's
// buildCallerStatement matches how serious the underlying scenario actually is.
const OPENERS: Record<IncidentSeverity, string[]> = {
  kritisch: [
    'Bitte, bitte kommen Sie schnell!',
    'Schnell, bitte, das ist ganz dringend!',
    'Oh Gott, bitte helfen Sie mir!'
  ],
  hoch: [
    'Bitte kommen Sie schnell hierher!',
    'Es ist dringend, bitte beeilen Sie sich!',
    'Bitte, das sieht wirklich schlimm aus!'
  ],
  mittel: [
    'Hallo, ich brauche Hilfe.',
    'Entschuldigung, könnten Sie bitte jemanden schicken?',
    'Hallo, ich hab hier eine Situation...'
  ],
  niedrig: [
    'Guten Tag, ist wahrscheinlich nichts Schlimmes, aber...',
    'Hallo, tut mir leid, wenn ich störe...',
    'Guten Tag, könnten Sie eventuell jemanden vorbeischicken?'
  ]
}

export function randomCallerOpener(severity: IncidentSeverity): string {
  const pool = OPENERS[severity]
  return pool[Math.floor(Math.random() * pool.length)]!
}
