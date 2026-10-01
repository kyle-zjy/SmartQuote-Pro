import catalog from '../data/quoteSheet.json'
import type { PriceCategory, PricingData } from '../types/pricing'
import { findPrice } from './priceLookup'
import { GST_RATE, money } from './quoteTotals'

export interface SheetConfig {
  code: string
  image: string
  panels: number
  widthFactor: number
  widthOffset: number
  heightFactor: number
  heightPoints: string[]
  widthPoints: string[]
}

export interface QuoteSheetCatalog {
  products: string[]
  screenTypes: string[]
  notes: string[]
  configs: SheetConfig[]
}

export const QUOTE_SHEET = catalog as QuoteSheetCatalog

export function findSheetConfig(code: string): SheetConfig | undefined {
  return QUOTE_SHEET.configs.find((config) => config.code === code)
}

export function configFamily(code: string): 'hinged' | 'sliding' | 'window' | 'other' {
  if (code === 'WS' || code.startsWith('WS')) return 'window'
  if (code.startsWith('HD')) return 'hinged'
  if (code.startsWith('SD')) return 'sliding'
  return 'other'
}

export function configLabel(code: string): string {
  const handing = configHanding(code)
  const body = code.replace(/-L$|-R$/, '')
  if (body === 'WS') return 'Window'
  if (body.startsWith('HD')) return ['Door — Hinged', handing].filter(Boolean).join(' — ')
  if (body.startsWith('SD')) {
    const layout = body.replace(/^SD/, '')
    return ['Door — Sliding', layout, handing].filter(Boolean).join(' — ')
  }
  return code
}

/** Some source drawings include handedness in their title even though the sheet code has no suffix. */
export function configHanding(code: string): 'LHS' | 'RHS' | '' {
  if (code.endsWith('-L') || code === 'SDXXO' || code === 'SDXXXO') return 'LHS'
  if (code.endsWith('-R') || code === 'SDOXX' || code === 'SDOXXX') return 'RHS'
  return ''
}

// Source: Screen measuring .xlsx, Images sheet. The measurements are keyed by
// configuration; the supplied workbook does not split them further by product.
const SCREEN_MEASURE_POINTS: Record<string, { heights: string[]; widths: string[] }> = {
  'HDX-L': { heights: ['H1', 'H2'], widths: ['W1', 'W2', 'W3'] },
  'HDX-R': { heights: ['H1', 'H2'], widths: ['W1', 'W2', 'W3'] },
  'HDXX-L': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  'HDXX-R': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  SDOX: { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  'SDOXO-L': { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  'SDOXO-R': { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  SDOXX: { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2'] },
  'SDOXXO-L': { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  'SDOXXO-R': { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  SDOXXX: { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  'SDOXXXXO-L': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  'SDOXXXXO-R': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  'SDOXXXXXO-R': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3', 'W4', 'W5'] },
  'SDOXXXXXXO-L': { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3', 'W4', 'W5'] },
  SDXO: { heights: ['H1', 'H2', 'H3'], widths: ['W1'] },
  SDXXO: { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2'] },
  SDXXXO: { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] },
  WS: { heights: ['H1'], widths: ['W1'] },
}

export function measurePoints(config: SheetConfig): { heights: string[]; widths: string[] } {
  if (SCREEN_MEASURE_POINTS[config.code]) return SCREEN_MEASURE_POINTS[config.code]
  if (config.heightPoints.length > 0 || config.widthPoints.length > 0) {
    return {
      heights: config.heightPoints.length > 0 ? config.heightPoints : ['H1'],
      widths: config.widthPoints.length > 0 ? config.widthPoints : ['W1'],
    }
  }
  const family = configFamily(config.code)
  if (family === 'hinged') return { heights: ['H1', 'H2', 'H3'], widths: ['W1', 'W2', 'W3'] }
  if (family === 'sliding') return { heights: ['H1'], widths: ['W1'] }
  return { heights: ['H1'], widths: ['W1'] }
}

export function measureKeys(config: SheetConfig): string[] {
  const points = measurePoints(config)
  return [...points.heights, ...points.widths]
}

export function openingFromMeasures(values: Record<string, string>): { height: number; width: number } | null {
  const heights = Object.entries(values)
    .filter(([key, value]) => key.startsWith('H') && Number(value) > 0)
    .map(([, value]) => Number(value))
  const widths = Object.entries(values)
    .filter(([key, value]) => key.startsWith('W') && Number(value) > 0)
    .map(([, value]) => Number(value))
  if (heights.length === 0 || widths.length === 0) return null
  return { height: Math.max(...heights), width: Math.max(...widths) }
}

export function suggestedScreenType(code: string): string {
  const family = configFamily(code)
  if (family === 'hinged') return 'Hinged Door'
  if (family === 'sliding') return 'Sliding Door'
  if (family === 'window') return 'Window'
  return ''
}

export function formatSheetMm(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export interface SheetSize {
  panels: number
  openingHeight: number
  openingWidth: number
  screenHeight: number
  screenWidth: number
  openingLabel: string
  screenLabel: string
}

/** Preserve the measured opening dimensions when carrying them into product pricing. */
export function calcSheetSize(config: SheetConfig, height: number, width: number): SheetSize | null {
  if (!(height > 0) || !(width > 0)) return null
  const screenWidth = width
  const screenHeight = height
  return {
    panels: config.panels,
    openingHeight: height,
    openingWidth: width,
    screenHeight,
    screenWidth,
    openingLabel: `${formatSheetMm(height)}X${formatSheetMm(width)}`,
    screenLabel: `${formatSheetMm(screenHeight)}X${formatSheetMm(screenWidth)}`,
  }
}

export function sheetLineAmount(unitPrice: number, qty: number, panels: number): number {
  return money(Math.max(0, unitPrice) * Math.max(0, qty) * Math.max(0, panels))
}

export function sheetTotals(lineAmounts: number[], gstEnabled = true): { subtotal: number; gstAmount: number; total: number } {
  const subtotal = money(lineAmounts.reduce((sum, amount) => sum + amount, 0))
  const gstAmount = gstEnabled ? money(subtotal * GST_RATE) : 0
  return { subtotal, gstAmount, total: money(subtotal + gstAmount) }
}

const PRODUCT_KEYS: Record<string, string> = {
  Flyscreen: 'flyscreens',
  Intrudaguard: 'intrudaguard',
  Supascreen: 'supascreen',
}

export function sheetProductKey(product: string): string | undefined {
  return PRODUCT_KEYS[product]
}

export function sheetCategoryKey(productKey: string, screenType: string): string | undefined {
  if (screenType === 'Window') return 'windows'
  if (productKey === 'flyscreens') {
    if (screenType === 'Sliding Door') return 'sliding-doors'
    if (screenType === 'Hinged Door') return 'hinged-doors'
  }
  if (screenType === 'Hinged Door' || screenType === 'Sliding Door') return 'doors'
  return undefined
}

export function lookupSheetUnitPrice(
  pricing: PricingData,
  product: string,
  screenType: string,
  screenWidth: number,
  screenHeight: number,
): { price: number; matchedWidth: number; matchedHeight: number } | null {
  const productKey = sheetProductKey(product)
  const categoryKey = productKey ? sheetCategoryKey(productKey, screenType) : undefined
  if (!productKey || !categoryKey) return null
  const category = pricing.products
    .find((item) => item.key === productKey)
    ?.categories.find((item) => item.key === categoryKey) as PriceCategory | undefined
  if (!category) return null
  const result = findPrice(category, screenWidth, screenHeight)
  if (!result.ok) return null
  return { price: result.price, matchedWidth: result.matchedWidth, matchedHeight: result.matchedHeight }
}
