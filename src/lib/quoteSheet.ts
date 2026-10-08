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

function measurementEntries(values: Record<string, string>, prefix: 'H' | 'W'): Array<{ key: string; value: number }> {
  return Object.entries(values)
    .filter(([key, value]) => key.startsWith(prefix) && Number(value) > 0)
    .sort(([left], [right]) => Number(left.slice(1)) - Number(right.slice(1)))
    .map(([key, value]) => ({ key, value: Number(value) }))
}

/** Widths that span two sliding screens in the source measurement drawings.
 * The divisor is applied before price lookup; quantity is applied to the lookup result. */
const SHARED_SLIDING_WIDTHS: Record<string, Record<string, { divisor: number; quantity: number }>> = {
  'SDOXXO-L': { W1: { divisor: 2, quantity: 2 } },
  'SDOXXO-R': { W1: { divisor: 2, quantity: 2 } },
  'SDOXXXXO-L': { W3: { divisor: 2, quantity: 2 } },
  'SDOXXXXO-R': { W3: { divisor: 2, quantity: 2 } },
  'SDOXXXXXO-R': { W5: { divisor: 2, quantity: 2 } },
  'SDOXXXXXXO-L': { W5: { divisor: 2, quantity: 2 } },
}

function measurementValues(values: Record<string, string>, prefix: 'H' | 'W'): number[] {
  return measurementEntries(values, prefix).map(({ value }) => value)
}

export function openingFromMeasures(
  values: Record<string, string>,
  config?: SheetConfig,
): { height: number; width: number } | null {
  const heights = measurementValues(values, 'H')
  const widths = measurementValues(values, 'W')
  if (heights.length === 0 || widths.length === 0) return null
  return {
    height: Math.max(...heights),
    width: config && configFamily(config.code) === 'sliding'
      ? widths.reduce((sum, width) => sum + width, 0)
      : Math.max(...widths),
  }
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
  pricingGroups: Array<{
    height: number
    width: number
    quantity: number
    measurementKey?: string
    widthDivisor?: number
  }>
}

/** Converts one measured width into its pricing size. Sliding widths already describe
 * the screen shown in the drawing; only hinged openings are split across their panels. */
export function calcSheetSize(config: SheetConfig, height: number, width: number): SheetSize | null {
  if (!(height > 0) || !(width > 0) || config.widthFactor <= 0) return null
  const screenWidth = configFamily(config.code) === 'hinged'
    ? width / config.panels
    : width
  const screenHeight = config.heightFactor * height
  return {
    panels: config.panels,
    openingHeight: height,
    openingWidth: width,
    screenHeight,
    screenWidth,
    openingLabel: `${formatSheetMm(height)}X${formatSheetMm(width)}`,
    screenLabel: `${formatSheetMm(screenHeight)}X${formatSheetMm(screenWidth)}`,
    pricingGroups: [{ height: screenHeight, width: screenWidth, quantity: config.panels }],
  }
}

/** Builds pricing groups from the W dimensions drawn on the selected configuration.
 * Most sliding W values describe one screen. Explicit shared-width rules divide a
 * combined W before lookup and multiply that lookup price by the screen quantity. */
export function sheetSizeFromMeasures(config: SheetConfig, values: Record<string, string>): SheetSize | null {
  const opening = openingFromMeasures(values, config)
  if (!opening) return null

  const family = configFamily(config.code)
  if (family !== 'sliding') return calcSheetSize(config, opening.height, opening.width)

  const widthEntries = measurementEntries(values, 'W')
  const screenHeight = config.heightFactor * opening.height
  const sharedWidths = SHARED_SLIDING_WIDTHS[config.code] ?? {}
  const pricingGroups = widthEntries.map(({ key, value }) => {
    const rule = sharedWidths[key] ?? { divisor: 1, quantity: 1 }
    return {
      height: screenHeight,
      width: value / rule.divisor,
      measurementKey: key,
      widthDivisor: rule.divisor,
      quantity: rule.quantity,
    }
  })
  const screenWidth = Math.max(...pricingGroups.map(({ width }) => width))

  return {
    panels: config.panels,
    openingHeight: opening.height,
    openingWidth: opening.width,
    screenHeight,
    screenWidth,
    openingLabel: `${formatSheetMm(opening.height)}X${formatSheetMm(opening.width)}`,
    screenLabel: `${formatSheetMm(screenHeight)}X${formatSheetMm(screenWidth)}`,
    pricingGroups,
  }
}

export function adjustedPricingGroups(
  size: SheetSize,
  interlockAdjustment: 'add' | 'remove' | 'remove-zero' | '' = '',
): SheetSize['pricingGroups'] {
  const adjustment = interlockAdjustment === 'add' ? 5 : interlockAdjustment === 'remove' ? -5 : 0
  return size.pricingGroups.map((group) => ({ ...group, width: group.width + adjustment }))
}

/** The per-panel screen size actually used to calculate price, derived from the same stored
 * fields the wizard priced against -- null when the item wasn't built through the opening/
 * measurement wizard (e.g. service-only items or legacy flat items). */
export function pricingSizeForItem(item: {
  configurationCode?: string
  measurements?: Record<string, string>
  interlockAdjustment?: 'add' | 'remove' | 'remove-zero' | ''
}): { widthMm: number; heightMm: number } | null {
  if (!item.configurationCode || !item.measurements) return null
  const config = findSheetConfig(item.configurationCode)
  if (!config) return null
  const screen = sheetSizeFromMeasures(config, item.measurements)
  if (!screen) return null
  const groups = adjustedPricingGroups(screen, item.interlockAdjustment)
  const widest = groups.reduce((current, group) => group.width > current.width ? group : current)
  return { widthMm: widest.width, heightMm: widest.height }
}

/** The price-matrix bracket the item was actually billed at -- rounded up from the per-panel
 * screen size to the next available size, e.g. a 1285 x 440 screen priced off a 1300 x 450
 * bracket. This is deliberately coarser than the real measurement so a customer-facing quote
 * can show it without revealing the precise site measurement. Null when the item wasn't built
 * through the opening/measurement wizard, or its product/category can't be found in the given
 * pricing catalog (e.g. a custom import that dropped a category). */
export function pricingBracketForItem(
  item: {
    configurationCode?: string
    measurements?: Record<string, string>
    interlockAdjustment?: 'add' | 'remove' | 'remove-zero' | ''
    productKey?: string
    categoryKey?: string
  },
  pricingData: PricingData,
): { widthMm: number; heightMm: number } | null {
  const screen = pricingSizeForItem(item)
  if (!screen) return null
  const category = pricingData.products
    .find((product) => product.key === item.productKey)
    ?.categories.find((candidate) => candidate.key === item.categoryKey) as PriceCategory | undefined
  if (!category) return null
  const lookup = findPrice(category, screen.widthMm, screen.heightMm)
  if (!lookup.ok) return null
  return { widthMm: lookup.matchedWidth, heightMm: lookup.matchedHeight }
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
