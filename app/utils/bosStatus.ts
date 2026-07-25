import type { UnitStatus } from '~/types/unit'

// Simplified BOS-Funkstatus codes (real German rescue/fire radio status system),
// used purely as compact status badges in unit lists - not transmitted anywhere.
export const BOS_STATUS: Record<UnitStatus, { code: number, label: string, className: string }> = {
  rueckfahrt: { code: 1, label: 'Einsatzbereit über Funk', className: 'bg-emerald-600 text-white' },
  frei: { code: 2, label: 'Einsatzbereit auf Wache', className: 'bg-emerald-700 text-white' },
  alarmiert: { code: 3, label: 'Einsatz übernommen', className: 'bg-amber-500 text-black' },
  anfahrt: { code: 3, label: 'Anfahrt zum Einsatzort', className: 'bg-amber-500 text-black' },
  vor_ort: { code: 4, label: 'Am Einsatzort eingetroffen', className: 'bg-red-600 text-white' },
  abschluss: { code: 7, label: 'Einsatz wird abgeschlossen', className: 'bg-sky-600 text-white' }
}
