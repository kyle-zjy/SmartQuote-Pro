import type { DrawStroke } from './sheetDraw'

export const MEASURE_STORAGE_KEY = 'smartquote-pro:sheet-measures'

export interface MarkerPosition {
  x: number
  y: number
}

export interface SheetMeasureDraft {
  markers: Record<string, MarkerPosition>
  values: Record<string, string>
  strokes: DrawStroke[]
  product: string
  screenType: string
  location: string
  qty: string
  notes: string
}

export function emptyMeasureDraft(screenType = ''): SheetMeasureDraft {
  return {
    markers: {},
    values: {},
    strokes: [],
    product: 'Supascreen',
    screenType,
    location: '',
    qty: '1',
    notes: '',
  }
}

export function loadMeasureDraft(code: string, fallbackType = '', storage: Storage = localStorage): SheetMeasureDraft {
  try {
    const raw = storage.getItem(MEASURE_STORAGE_KEY)
    if (!raw) return emptyMeasureDraft(fallbackType)
    const parsed = JSON.parse(raw) as Record<string, Partial<SheetMeasureDraft>>
    const draft = parsed[code]
    if (!draft) return emptyMeasureDraft(fallbackType)
    return {
      ...emptyMeasureDraft(fallbackType),
      ...draft,
      markers: draft.markers ?? {},
      values: draft.values ?? {},
      strokes: Array.isArray(draft.strokes) ? draft.strokes : [],
    }
  } catch {
    return emptyMeasureDraft(fallbackType)
  }
}

export function saveMeasureDraft(code: string, draft: SheetMeasureDraft, storage: Storage = localStorage): void {
  let all: Record<string, SheetMeasureDraft> = {}
  try {
    all = JSON.parse(storage.getItem(MEASURE_STORAGE_KEY) ?? '{}') as Record<string, SheetMeasureDraft>
  } catch {
    all = {}
  }
  all[code] = draft
  try {
    storage.setItem(MEASURE_STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Drawing data can be large; keep working in memory if this browser is full.
  }
}
