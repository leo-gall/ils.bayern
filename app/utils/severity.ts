import type { IncidentSeverity } from '~/types/incident'

/**
 * Derives urgency from the official Stichwort-Kategorie code instead of asking the
 * dispatcher to separately pick a "kritisch"/"hoch"/... label - real Bavarian Stichworte
 * already encode urgency in the code itself (RD 1 vs. RD 2, B 3 vs. B 6, ...). Only used
 * internally for on-scene duration and map marker color, never rendered as text.
 */
export function severityFromCode(code: string): IncidentSeverity {
  const c = code.trim()

  if (/^MANV/.test(c)) return 'kritisch'
  if (/^B\s?[6-9]$/.test(c)) return 'kritisch'
  if (c === 'B ABC' || c === 'B Explosion') return 'kritisch'

  if (/^RD\s?2/.test(c)) return 'hoch'
  if (/^B\s?[45]$/.test(c)) return 'hoch'
  if (['B Person', 'B Elektro', 'B Schiene', 'B Wasser', 'THL groß', 'THL ABC'].includes(c)) return 'hoch'
  if (c.startsWith('VU Flugzeug') || c === 'VU Schiff' || c === 'Wassernot 3' || c === 'Eisunfall 2') return 'hoch'

  if (/^RD\s?[345]$/.test(c)) return 'mittel'
  if (/^B\s?[23]$/.test(c)) return 'mittel'
  if (/^VU\s?[23]$/.test(c)) return 'mittel'
  if (['P Rettung', 'THL Wasser', 'Bergrettung', 'Tauchunfall', 'Eisunfall 1'].includes(c)) return 'mittel'
  if (c.startsWith('Wassernot')) return 'mittel'

  return 'niedrig'
}
