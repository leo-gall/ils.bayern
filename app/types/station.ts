export type VehicleType
  = | 'RTW' | 'KTW' | 'NEF' | 'LF' | 'HLF' | 'TLF' | 'ELW' | 'DLK' | 'RW' | 'TSF' | 'GW' | 'MTW'
  // Added for the hand-curated per-Landkreis real data (data-source/landkreise/*.json).
    | 'MZF' | 'GW-L' | 'Boot' | 'ELW2' | 'TSF-W' | 'KdoW' | 'MLF' | 'CBRN-ErkW' | 'FR'
    | 'GW Dekon-P' | 'TSF-L' | 'KdoW-RD' | 'NKTW' | 'GW-SAN' | 'GW-Betreuung' | 'ELW-RD' | 'GW-Verpflegung'

/** 'bereitschaft': BRK/MHD Bereitschaft (SEG) - reserve/special-vehicle depot, not a staffed
 * fire or ambulance station - see data-source/landkreise/*.json `typ: "SEG"`. */
export type StationType = 'feuerwache' | 'rettungswache' | 'bereitschaft'

export interface VehicleTemplate {
  id: string
  type: VehicleType
  /** Real BOS Funkrufname, e.g. "Florian Fürstenfeldbruck 40/1" or "Rotkreuz Germering 71/2". */
  funkrufname: string
}

export interface Station {
  id: string
  osmId: string
  name: string
  type: StationType
  ilsId: string
  lat: number
  lon: number
  vehicles: VehicleTemplate[]
}
