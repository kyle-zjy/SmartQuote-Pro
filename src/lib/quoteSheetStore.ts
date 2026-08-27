import { QUOTE_SHEET } from './quoteSheet'

export const SHEET_STORAGE_KEY = 'smartquote-pro:sheet'

export interface SheetLine {
  id: string
  code: string
  height: string
  width: string
  location: string
  qty: string
  product: string
  screenType: string
  unitPrice: string
  notes: string
  priceManual: boolean
}

export interface SheetDraft {
  customer: string
  quoteDate: string
  lines: SheetLine[]
}

export function emptySheetLine(): SheetLine {
  return {
    id: crypto.randomUUID(),
    code: '',
    height: '',
    width: '',
    location: '',
    qty: '1',
    product: QUOTE_SHEET.products.includes('Supascreen') ? 'Supascreen' : QUOTE_SHEET.products[0] ?? '',
    screenType: '',
    unitPrice: '',
    notes: '',
    priceManual: false,
  }
}

export function defaultSheetDraft(): SheetDraft {
  return {
    customer: '',
    quoteDate: new Date().toISOString().slice(0, 10),
    lines: [emptySheetLine()],
  }
}

export function loadSheetDraft(storage: Storage = localStorage): SheetDraft {
  try {
    const raw = storage.getItem(SHEET_STORAGE_KEY)
    if (!raw) return defaultSheetDraft()
    const parsed = JSON.parse(raw) as Partial<SheetDraft>
    const lines = Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed.lines.map(normalizeLine) : [emptySheetLine()]
    return {
      customer: typeof parsed.customer === 'string' ? parsed.customer : '',
      quoteDate: typeof parsed.quoteDate === 'string' && parsed.quoteDate ? parsed.quoteDate : defaultSheetDraft().quoteDate,
      lines,
    }
  } catch {
    return defaultSheetDraft()
  }
}

export function saveSheetDraft(draft: SheetDraft, storage: Storage = localStorage): void {
  storage.setItem(SHEET_STORAGE_KEY, JSON.stringify(draft))
}

function normalizeLine(line: Partial<SheetLine>): SheetLine {
  return {
    ...emptySheetLine(),
    ...line,
    id: line.id || crypto.randomUUID(),
  }
}
